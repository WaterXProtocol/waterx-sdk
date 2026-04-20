import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "../../../src/client.ts";
import { getAccountsByOwner, selectCoinsForAmount } from "../../../src/fetch.ts";
import { createAccount, transferToAccount } from "../../../src/user/account.ts";
import { pickE2eAccountIdForOwner } from "../../helpers/resolve-e2e-reference-account.ts";
import { assertSuccess } from "../setup.ts";

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
}

export function accountIdFromAccountCreatedEvent(
  events: Array<{ type: string; parsedJson: unknown }>,
): string {
  const ev = events.find((e) => e.type.includes("AccountCreated"));
  const j = ev?.parsedJson as Record<string, unknown> | null | undefined;
  const id = j?.account_id ?? j?.accountId;
  if (typeof id !== "string") {
    throw new Error(
      "Missing AccountCreated event or account_id field. Event types: " +
        events.map((e) => e.type).join(", "),
    );
  }
  return id;
}

/**
 * Resolve UserAccount: env `WATERX_INTEGRATION_ACCOUNT_ID` (must belong to owner), else first
 * on-chain account, else create via `createAccount`.
 */
export async function ensureUserAccountForIntegration(
  client: WaterXClient,
  signer: Ed25519Keypair,
  execTx: (
    tx: Transaction,
    signer: Ed25519Keypair,
    opts?: { gasBudget?: number },
  ) => Promise<{ events: Array<{ type: string; parsedJson: unknown }> }>,
): Promise<{ accountId: string; created: boolean }> {
  const owner = signer.getPublicKey().toSuiAddress();
  const fromEnv = process.env.WATERX_INTEGRATION_ACCOUNT_ID?.trim();
  const accounts = await getAccountsByOwner(client, owner);

  if (fromEnv) {
    const match = accounts.find((a) => normAddr(a.accountId) === normAddr(fromEnv));
    if (!match) {
      throw new Error(
        `WATERX_INTEGRATION_ACCOUNT_ID=${fromEnv} is not listed for owner ${owner}. ` +
          `Remove it from .env to auto-pick / create, or set it to an account you own.`,
      );
    }
    return { accountId: match.accountId, created: false };
  }

  if (accounts.length > 0) {
    return { accountId: pickE2eAccountIdForOwner(owner, accounts), created: false };
  }

  const tx = new Transaction();
  createAccount(client, tx, "integration-bootstrap");
  const result = await execTx(tx, signer, { gasBudget: 50_000_000 });
  assertSuccess(result);
  return { accountId: accountIdFromAccountCreatedEvent(result.events), created: true };
}

/**
 * Build a PTB that moves `amount` USDC (smallest units) from the signer's wallet into the
 * UserAccount via TTO (`transferToAccount`). Caller must sign as `owner`.
 */
export async function buildDepositUsdcFromWalletTx(
  client: WaterXClient,
  owner: string,
  accountId: string,
  amount: bigint,
): Promise<Transaction> {
  const usdcType = client.config.collaterals.USDC.type;
  const { coins, totalBalance } = await selectCoinsForAmount(client, owner, usdcType, amount);
  if (totalBalance < amount) {
    throw new Error(
      `Wallet USDC insufficient: need ${amount}, have ${totalBalance} at ${owner}. ` +
        `Fund the integration wallet with mock USDC on testnet.`,
    );
  }

  const tx = new Transaction();
  tx.setSender(owner);

  if (coins.length === 1 && totalBalance === amount) {
    transferToAccount(client, tx, {
      accountObjectAddress: accountId,
      coin: coins[0]!.objectId,
      coinType: usdcType,
    });
    return tx;
  }

  const primary = tx.object(coins[0]!.objectId);
  if (coins.length > 1) {
    tx.mergeCoins(
      primary,
      coins.slice(1).map((c) => tx.object(c.objectId)),
    );
  }

  if (totalBalance === amount) {
    transferToAccount(client, tx, {
      accountObjectAddress: accountId,
      coin: primary,
      coinType: usdcType,
    });
    return tx;
  }

  const [depositCoin] = tx.splitCoins(primary, [amount]);
  transferToAccount(client, tx, {
    accountObjectAddress: accountId,
    coin: depositCoin,
    coinType: usdcType,
  });
  tx.transferObjects([primary], owner);
  return tx;
}

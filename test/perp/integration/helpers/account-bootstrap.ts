import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "../../../../src/client.ts";
import { getAccountsByOwner } from "../../../../src/fetch.ts";
import { createAccount, transferToAccount } from "../../../../src/user/account.ts";
import type { NormalizedIntegrationTxResult } from "../../helpers/e2e/integration-tx-result.ts";
import { assertIntegrationTxSuccess } from "../../helpers/integration/integration-exec.ts";
import { integrationGasBudget } from "./integration-gas.ts";

export async function selectWalletCoinsCoveringAmount(
  client: WaterXClient,
  owner: string,
  coinType: string,
  minAmount: bigint,
): Promise<{ coins: Array<{ objectId: string; balance: bigint }>; totalBalance: bigint }> {
  const { objects } = await client.listCoins({ owner, coinType });
  const sorted = [...objects]
    .map((o) => ({
      objectId: o.objectId,
      balance: BigInt(o.balance ?? "0"),
    }))
    .filter((c) => c.objectId && c.balance > 0n);
  sorted.sort((a, b) => (a.balance > b.balance ? -1 : 1));

  let total = 0n;
  const coins: typeof sorted = [];
  for (const c of sorted) {
    if (total >= minAmount) break;
    coins.push(c);
    total += c.balance;
  }
  return { coins, totalBalance: total };
}

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
  ) => Promise<NormalizedIntegrationTxResult>,
): Promise<{ accountId: string; created: boolean }> {
  const owner = signer.getPublicKey().toSuiAddress();
  const fromEnv = process.env.WATERX_INTEGRATION_ACCOUNT_ID?.trim();
  const accounts = await getAccountsByOwner(client, owner);

  if (fromEnv) {
    const match = accounts.find((a) => normAddr(a) === normAddr(fromEnv));
    if (!match) {
      throw new Error(
        `WATERX_INTEGRATION_ACCOUNT_ID=${fromEnv} is not listed for owner ${owner}. ` +
          `Remove it from .env to auto-pick / create, or set it to an account you own.`,
      );
    }
    return { accountId: match, created: false };
  }

  if (accounts.length > 0) {
    return { accountId: accounts[0]!, created: false };
  }

  const tx = new Transaction();
  createAccount(client, tx, { alias: "integration-bootstrap" });
  const result = await execTx(tx, signer, { gasBudget: integrationGasBudget("accountBootstrap") });
  assertIntegrationTxSuccess(result);
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
  const usdcType = client.getPoolTokenType("USDCUSD");
  const { coins, totalBalance } = await selectWalletCoinsCoveringAmount(
    client,
    owner,
    usdcType,
    amount,
  );
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
      accountId,
      coin: tx.object(coins[0]!.objectId),
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
      accountId,
      coin: primary,
      coinType: usdcType,
    });
    return tx;
  }

  const [depositCoin] = tx.splitCoins(primary, [amount]);
  transferToAccount(client, tx, {
    accountId,
    coin: depositCoin,
    coinType: usdcType,
  });
  tx.transferObjects([primary], owner);
  return tx;
}

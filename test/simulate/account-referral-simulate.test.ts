/** E2E: account/delegate/referral SDK wrappers (simulate only). */
import { Transaction } from "@mysten/sui/transactions";
import {
  addDelegate,
  createAccount,
  getAccountCoins,
  getAccountsByOwner,
  receiveCoin,
  removeDelegate,
  setReferralCode,
  TESTNET_TYPES,
  transferToAccount,
  updateDelegatePermissions,
} from "@waterx/perp-sdk";
import { describe, it } from "vitest";

import { INTEGRATION_REFERENCE_WALLET_ADDRESS as OWNER } from "../helpers/integration-reference-wallet.ts";
import { pickE2eAccountIdForOwner } from "../helpers/resolve-e2e-reference-account.ts";
import { assertSimulateSuccess } from "../helpers/simulate-assertions.ts";
import { client } from "../helpers/testnet.ts";

function randomCode(prefix = "e2e"): string {
  return `${prefix}${Date.now().toString(36).slice(-6)}`;
}

async function referenceAccountId(ctx: {
  skip: (reason?: string) => void;
}): Promise<string | null> {
  const accounts = await getAccountsByOwner(client, OWNER);
  if (!accounts.length) {
    ctx.skip(`No WaterX UserAccount for ${OWNER}.`);
    return null;
  }
  try {
    return pickE2eAccountIdForOwner(OWNER, accounts);
  } catch (e) {
    ctx.skip(e instanceof Error ? e.message : String(e));
    return null;
  }
}

describe("account / delegate / referral wrappers (simulate)", () => {
  it("createAccount wrapper", async () => {
    const tx = new Transaction();
    tx.setSender(OWNER);
    tx.setGasBudget(120_000_000);
    createAccount(client, tx, `sim-${Date.now().toString(36).slice(-5)}`);
    const result = await client.simulate(tx);
    assertSimulateSuccess(result, 1, { transaction: tx });
  }, 60_000);

  it("add/update/remove delegate wrappers in one PTB", async (ctx) => {
    const accountId = await referenceAccountId(ctx);
    if (!accountId) return;
    const delegate = "0x1111111111111111111111111111111111111111111111111111111111111111";

    const tx = new Transaction();
    tx.setSender(OWNER);
    tx.setGasBudget(150_000_000);

    addDelegate(client, tx, {
      accountObjectAddress: accountId,
      delegate,
      permissions: 63,
    });
    updateDelegatePermissions(client, tx, {
      accountObjectAddress: accountId,
      delegate,
      newPermissions: 127,
    });
    removeDelegate(client, tx, {
      accountObjectAddress: accountId,
      delegate,
    });

    const result = await client.simulate(tx);
    assertSimulateSuccess(result, 3, { transaction: tx });
  }, 60_000);

  it("transferToAccount + receiveCoin wrappers", async (ctx) => {
    const accountId = await referenceAccountId(ctx);
    if (!accountId) return;

    const walletUsdc = await client.listCoins({
      owner: OWNER,
      coinType: TESTNET_TYPES.USDC,
    });
    if (!walletUsdc.objects.length) {
      ctx.skip(`No wallet-level USDC at ${OWNER}.`);
      return;
    }

    const accountUsdc = await getAccountCoins(client, accountId, TESTNET_TYPES.USDC);
    if (!accountUsdc.length) {
      ctx.skip("No account-level USDC coin available for receiveCoin wrapper.");
      return;
    }
    const recv = accountUsdc[0]!;

    const tx = new Transaction();
    tx.setSender(OWNER);
    tx.setGasBudget(200_000_000);

    transferToAccount(client, tx, {
      accountObjectAddress: accountId,
      coin: walletUsdc.objects[0]!.objectId,
      coinType: TESTNET_TYPES.USDC,
    });

    const received = receiveCoin(client, tx, {
      accountObjectAddress: accountId,
      coins: [{ objectId: recv.objectId, version: recv.version, digest: recv.digest }],
      coinType: TESTNET_TYPES.USDC,
    });
    tx.transferObjects([received], OWNER);

    const result = await client.simulate(tx);
    assertSimulateSuccess(result, 2, { transaction: tx });
  }, 60_000);

  it("setReferralCode wrapper", async () => {
    const tx = new Transaction();
    tx.setSender(OWNER);
    tx.setGasBudget(80_000_000);
    setReferralCode(client, tx, { code: randomCode() });
    const result = await client.simulate(tx);
    assertSimulateSuccess(result, 1, { transaction: tx });
  }, 60_000);
});

import { Transaction } from "@mysten/sui/transactions";
import {
  addDelegate,
  createAccount,
  deposit,
  removeDelegate,
  setDelegatePredictionPermission,
  transferCoinToAccount,
  whitelistPredictionProtocol,
  withdraw,
} from "~predict/account.ts";
import type { PredictClient } from "~predict/client.ts";
import { beforeAll, describe, it } from "vitest";

import { PTB_DUMMY } from "../fixtures/ptb-params.ts";
import { createE2eClient, discoverFixtures, type E2eFixtures } from "../helpers/e2e-context.ts";
import { fixtureGuards } from "../helpers/e2e-skip.ts";
import {
  expectSimulateSuccess,
  expectSimulateSuccessAsCoinOwner,
  resolveObjectOwner,
} from "../helpers/simulate.ts";

describe("account PTB simulate (testnet)", () => {
  let client: PredictClient;
  let fx: E2eFixtures;
  let guard: ReturnType<typeof fixtureGuards>;
  let accountAdminCap: string;

  beforeAll(async () => {
    client = await createE2eClient();
    fx = await discoverFixtures(client);
    guard = fixtureGuards(fx, client);
    accountAdminCap = requireWaterxAccountAdminCap(client);
  }, 120_000);

  it("createAccount", async () => {
    const tx = new Transaction();
    createAccount(client, tx, { alias: `e2e-${Date.now()}` });
    await expectSimulateSuccess(client, tx);
  });

  it("transferCoinToAccount", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    const coin = guard.skipUnlessUsdCoin(ctx);
    const tx = new Transaction();
    transferCoinToAccount(client, tx, { accountId: fx.accountId, coin });
    await expectSimulateSuccessAsCoinOwner(client, tx, coin);
  });

  it("deposit (request_deposit + consume_deposit_direct)", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    const coin = guard.skipUnlessUsdCoin(ctx);
    const tx = new Transaction();
    deposit(client, tx, { accountId: fx.accountId, coin });
    await expectSimulateSuccessAsCoinOwner(client, tx, coin);
  });

  it("requestWithdraw", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(ctx);
    const owner = await guard.skipUnlessAccountOwner(ctx);
    const tx = new Transaction();
    withdraw(client, tx, {
      accountId: fx.accountId,
      amount: 1n,
      recipient: PTB_DUMMY.recipient,
    });
    try {
      await expectSimulateSuccess(client, tx, owner);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/EPolicyMismatch|PolicyMismatch|withdraw policy/i.test(msg)) {
        guard.skipPermanent(ctx, `withdraw policy is not DirectRule on this testnet: ${msg}`);
      }
      throw err;
    }
  });

  it("delegate lifecycle PTBs", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(ctx);
    const owner = await guard.skipUnlessAccountOwner(ctx);
    const tx = new Transaction();
    addDelegate(client, tx, {
      accountId: fx.accountId,
      delegate: PTB_DUMMY.delegate,
      alias: "e2e",
      permissions: 7,
      expiresAtMs: null,
    });
    setDelegatePredictionPermission(client, tx, {
      accountId: fx.accountId,
      delegate: PTB_DUMMY.delegate,
      permissions: 1,
    });
    removeDelegate(client, tx, { accountId: fx.accountId, delegate: PTB_DUMMY.delegate });
    await expectSimulateSuccess(client, tx, owner);
  });

  it("whitelistPredictionProtocol", async (ctx) => {
    const tx = new Transaction();
    whitelistPredictionProtocol(client, tx, { adminCap: accountAdminCap });
    const sender = await resolveObjectOwner(client, accountAdminCap);
    try {
      await expectSimulateSuccess(client, tx, sender);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already|listed|whitelist/i.test(msg)) {
        guard.skipPermanent(ctx, `prediction protocol already whitelisted on this testnet: ${msg}`);
      }
      throw err;
    }
  });
});

function requireWaterxAccountAdminCap(client: PredictClient): string {
  return client.waterxAccountAdminCap();
}

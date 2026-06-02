import { Transaction } from "@mysten/sui/transactions";
import {
  addKeeper,
  adminWithdraw,
  createMarketRegistry,
  depositSettlement,
  pauseMarket,
  removeKeeper,
  setMinReserve,
  setOrderCancelCooldownMs,
  unpauseMarket,
} from "~predict/admin.ts";
import type { PredictClient } from "~predict/client.ts";
import { PREDICTION_ERROR_CODES } from "~predict/constants.ts";
import { getRegistry } from "~predict/fetch.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { PTB_DUMMY } from "../fixtures/ptb-params.ts";
import { createE2eClient, discoverFixtures, type E2eFixtures } from "../helpers/e2e-context.ts";
import { fixtureGuards } from "../helpers/e2e-skip.ts";
import {
  expectSimulateFailure,
  expectSimulateSuccess,
  parseMoveAbortCode,
  resolveObjectOwner,
  simulateErrorMessage,
} from "../helpers/simulate.ts";

describe("admin PTB simulate (testnet)", () => {
  let client: PredictClient;
  let fx: E2eFixtures;
  let guard: ReturnType<typeof fixtureGuards>;
  let cap: string;

  beforeAll(async () => {
    client = await createE2eClient();
    fx = await discoverFixtures(client);
    guard = fixtureGuards(fx);
    cap = requirePredictionAdminCap(client);
  }, 120_000);

  it("createMarketRegistry", async () => {
    const tx = new Transaction();
    createMarketRegistry(client, tx, { adminCap: cap });
    await expectSimulateSuccess(client, tx);
  });

  it("depositSettlement", async (ctx) => {
    if (!fx.adminUsdCoinObjectId) {
      guard.skipPermanent(
        ctx,
        `depositSettlement dry-run requires a settlement coin owned by the AdminCap holder. Transfer USD to that wallet (see scripts/probe-admin-coins.ts to confirm).`,
      );
    }
    const adminOwner = await resolveObjectOwner(client, cap);
    const tx = new Transaction();
    depositSettlement(client, tx, { adminCap: cap, payment: fx.adminUsdCoinObjectId });
    await expectSimulateSuccess(client, tx, adminOwner);
  });

  it("adminWithdraw when registry balance is above min_reserve", async (ctx) => {
    const registry = await getRegistry(client);
    const headroom =
      registry.balance > registry.minReserve ? registry.balance - registry.minReserve : 0n;
    if (headroom === 0n) {
      ctx.skip(
        true,
        `Registry balance ${registry.balance} has no withdraw headroom above minReserve ${registry.minReserve}.`,
      );
    }

    const tx = new Transaction();
    adminWithdraw(client, tx, {
      adminCap: cap,
      amount: headroom >= 1n ? 1n : headroom,
      recipient: PTB_DUMMY.recipient,
    });
    await expectSimulateSuccess(client, tx);
  });

  it("adminWithdraw aborts with EBelowMinReserve when amount exceeds headroom", async (ctx) => {
    const registry = await getRegistry(client);
    const headroom =
      registry.balance > registry.minReserve ? registry.balance - registry.minReserve : 0n;
    if (headroom === 0n) {
      ctx.skip(true, "Registry has no withdraw headroom; cannot assert EBelowMinReserve path.");
    }

    const tx = new Transaction();
    adminWithdraw(client, tx, {
      adminCap: cap,
      amount: headroom + 1n,
      recipient: PTB_DUMMY.recipient,
    });
    const result = await expectSimulateFailure(client, tx);
    const code = parseMoveAbortCode(simulateErrorMessage(result));
    expect(code).toBe(PREDICTION_ERROR_CODES.EBelowMinReserve);
  });

  it("parameter tuning PTBs", async () => {
    const txMin = new Transaction();
    setMinReserve(client, txMin, { adminCap: cap, newReserve: 1n });
    await expectSimulateSuccess(client, txMin);

    const txCd = new Transaction();
    setOrderCancelCooldownMs(client, txCd, { adminCap: cap, cooldownMs: 1n });
    await expectSimulateSuccess(client, txCd);
  });

  it("pause / unpause market", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.marketIdBytes, "marketIdBytes");
    const txP = new Transaction();
    pauseMarket(client, txP, { adminCap: cap, marketId: fx.marketIdBytes });
    await expectSimulateSuccess(client, txP);

    const txU = new Transaction();
    unpauseMarket(client, txU, { adminCap: cap, marketId: fx.marketIdBytes });
    await expectSimulateSuccess(client, txU);
  });

  it("keeper admin PTBs", async () => {
    const txAdd = new Transaction();
    addKeeper(client, txAdd, { adminCap: cap, keeper: PTB_DUMMY.delegate });
    await expectSimulateSuccess(client, txAdd);

    const txRm = new Transaction();
    removeKeeper(client, txRm, { adminCap: cap, keeper: PTB_DUMMY.delegate });
    await expectSimulateSuccess(client, txRm);
  });
});

function requirePredictionAdminCap(client: PredictClient): string {
  return client.predictionAdminCap();
}

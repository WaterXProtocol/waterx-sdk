/**
 * E2E: low-level user builders composed into single PTB shapes (simulate-only).
 */
import { Transaction } from "@mysten/sui/transactions";
import { createAccount, executeTrading, increasePositionRequest } from "@waterx/perp-sdk";
import { beforeAll, describe, expect, it } from "vitest";

import {
  discoverStatefulSimulatePosition,
  DISCOVERY_OPTS_STATEFUL_SIMULATE,
  type DiscoveredPosition,
} from "../helpers/e2e/discover-on-chain-position.ts";
import { client, DUMMY_SENDER, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";
import { lifecycleTickerRow } from "../helpers/e2e/lifecycle-test-markets.ts";
import {
  simulateWithTransientRetry,
  skipSimulateIfOracleTransient,
} from "../helpers/e2e/simulate-assertions.ts";

describe(`builders compose (${e2eNetwork})`, () => {
  let discovered: DiscoveredPosition | null;

  beforeAll(async () => {
    discovered = await discoverStatefulSimulatePosition(
      client,
      DISCOVERY_OPTS_STATEFUL_SIMULATE,
    );
  }, 300_000);

  it("createAccount + simulate", async () => {
    const tx = new Transaction();
    tx.setSender(DUMMY_SENDER);
    tx.setGasBudget(40_000_000);
    createAccount(client, tx, { alias: `compose-${Date.now()}` });
    const sim = await client.simulate(tx);
    expect(sim).toBeDefined();
  }, 120_000);

  it("increasePositionRequest + executeTrading in one PTB when discovery hits", async (ctx) => {
    const d = discovered;
    if (!d) {
      ctx.skip("No eligible discovered position");
      return;
    }
    const row = lifecycleTickerRow(d.ticker);
    const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
    const tx = new Transaction();
    tx.setGasBudget(400_000_000);
    const req = increasePositionRequest(client, tx, {
      accountId: d.accountObjectAddress,
      ticker: d.ticker,
      collateralType,
      positionId: d.positionId,
      collateralAmount: row.e2ePtb.increaseCollateral,
      size: row.e2ePtb.increaseSize,
      acceptablePrice: rawPrice(Math.max(1, Math.ceil(row.approxUsdHint * 4))),
    });
    executeTrading(client, tx, {
      ticker: d.ticker,
      collateralType,
      request: req,
    });
    tx.setSender(d.ownerAddress);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    expect(sim).toBeDefined();
  }, 180_000);
});

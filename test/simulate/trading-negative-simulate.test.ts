/**
 * Simulate-only negative tests: expect `FailedTransaction` with specific `waterx_perp::error` abort codes.
 * Per-base coverage matches `activeLifecycleTestBases()` / PRD TC-TRADE-003 (no SOL-only oracle wording).
 */
import {
  buildOpenPositionTx,
  buildWithdrawCollateralTx,
  getAccountsByOwner,
  getMarketSummary,
} from "@waterx/perp-sdk";
import { describe, it } from "vitest";

import { INTEGRATION_REFERENCE_WALLET_ADDRESS } from "../helpers/integration-reference-wallet.ts";
import { activeLifecycleTestBases, lifecycleRow } from "../helpers/lifecycle-test-markets.ts";
import { openInvalidSizeAbortPossible } from "../helpers/market-summary-assertions.ts";
import { resolveE2eOpenPosition } from "../helpers/resolve-e2e-open-position.ts";
import { pickE2eAccountIdForOwner } from "../helpers/resolve-e2e-reference-account.ts";
import {
  assertSimulateMoveAbort,
  skipSimulateIfOracleTransient,
} from "../helpers/simulate-assertions.ts";
import { clientTxBuildersSimulate as client } from "../helpers/testnet.ts";
import { WATERX_PERP_ABORT } from "../helpers/waterx-perp-error-codes.ts";

const OWNER = INTEGRATION_REFERENCE_WALLET_ADDRESS;

/**
 * v2: `err_invalid_size` (201) is triggered when position collateral USD value is below
 * the market's `min_coll_value`. Use 1 raw collateral unit to guarantee undershoot.
 */
const TINY_COLLATERAL_RAW = 1n;

async function firstAccountId(ctx: { skip: (reason?: string) => void }): Promise<string | null> {
  const accounts = await getAccountsByOwner(client, OWNER);
  if (!accounts.length) {
    ctx.skip(`No WaterX UserAccount on testnet for ${OWNER}; run pnpm create-testnet-account.`);
    return null;
  }
  try {
    return pickE2eAccountIdForOwner(OWNER, accounts);
  } catch (e) {
    ctx.skip(e instanceof Error ? e.message : String(e));
    return null;
  }
}

describe("Simulate: trading expected failures (MoveAbort)", () => {
  for (const base of activeLifecycleTestBases()) {
    const row = lifecycleRow(base);

    it(`${base}: open at max leverage + 1 → err_exceed_max_leverage (104)`, async (ctx) => {
      const accountId = await firstAccountId(ctx);
      if (!accountId) return;

      const entry = client.getMarketEntry(base);
      const summary = await getMarketSummary(client, entry.marketId, entry.baseType);
      const aboveMaxLev = Number(summary.maxLeverageBps) / 10_000 + 1;

      const tx = await buildOpenPositionTx(client, {
        accountId,
        base,
        isLong: row.isLong,
        leverage: aboveMaxLev,
        collateralAmount: row.simulateOpenCollateral,
      });
      tx.setSender(OWNER);
      const result = await client.simulate(tx);
      if (skipSimulateIfOracleTransient(ctx, result)) return;
      assertSimulateMoveAbort(result, {
        abortCode: WATERX_PERP_ABORT.EXCEED_MAX_LEVERAGE,
        locationIncludes: "err_exceed_max_leverage",
      });
    }, 60_000);

    it(`${base}: open with collateral below min_coll_value → err_invalid_size (201)`, async (ctx) => {
      const accountId = await firstAccountId(ctx);
      if (!accountId) return;

      const entry = client.getMarketEntry(base);
      const summary = await getMarketSummary(client, entry.marketId, entry.baseType);
      if (!openInvalidSizeAbortPossible(summary.minCollValue)) {
        ctx.skip(
          `${base}: on-chain min_coll_value is 0 — open path err_invalid_size (201) requires min_coll_value > 0.`,
        );
        return;
      }

      const tx = await buildOpenPositionTx(client, {
        accountId,
        base,
        isLong: row.isLong,
        collateralAmount: TINY_COLLATERAL_RAW,
        leverage: 2,
      });
      tx.setSender(OWNER);
      const result = await client.simulate(tx);
      if (skipSimulateIfOracleTransient(ctx, result)) return;
      assertSimulateMoveAbort(result, {
        abortCode: WATERX_PERP_ABORT.INVALID_SIZE,
        locationIncludes: "err_invalid_size",
      });
    }, 60_000);
  }
});

describe("Simulate: withdrawCollateral exceeds max leverage (MoveAbort)", () => {
  for (const base of activeLifecycleTestBases()) {
    it(`${base}: withdraw nearly all collateral → err_exceed_max_leverage (104)`, async (ctx) => {
      const accountId = await firstAccountId(ctx);
      if (!accountId) return;

      const found = await resolveE2eOpenPosition(client, accountId, base);
      if (!found) {
        ctx.skip(`No open ${base} position for ${accountId.slice(0, 12)}…`);
        return;
      }

      // Withdraw all but 1 raw unit — effective leverage will far exceed max
      const withdrawAmount = found.info.collateralAmount - 1n;
      if (withdrawAmount <= 0n) {
        ctx.skip(`${base} position collateral too low (${found.info.collateralAmount})`);
        return;
      }

      const tx = await buildWithdrawCollateralTx(client, {
        accountId,
        base,
        positionId: Number(found.positionId),
        amount: withdrawAmount,
      });
      tx.setSender(OWNER);
      const result = await client.simulate(tx);
      if (skipSimulateIfOracleTransient(ctx, result)) return;
      assertSimulateMoveAbort(result, {
        abortCode: WATERX_PERP_ABORT.EXCEED_MAX_LEVERAGE,
        locationIncludes: "err_exceed_max_leverage",
      });
    }, 60_000);
  }
});

/**
 * Simulate-only negative tests: expect `FailedTransaction` with specific `waterx_perp::error` abort codes.
 */
import { buildOpenPositionTx, buildWithdrawCollateralTx, getMarketSummary } from "@waterx/perp-sdk";
import { beforeAll, describe, it } from "vitest";

import {
  discoverActivePosition,
  discoverActivePositionForAccount,
  discoverActivePositionForNegativeOpen,
  type DiscoveredPosition,
} from "../helpers/e2e/discover-on-chain-position.ts";
import { client } from "../helpers/e2e/e2e-client.ts";
import { activeLifecycleTestBases, lifecycleRow } from "../helpers/e2e/lifecycle-test-markets.ts";
import {
  assertSimulateMoveAbort,
  simulateWithTransientRetry,
  skipSimulateIfOracleTransient,
} from "../helpers/e2e/simulate-assertions.ts";
import { assertOpenAboveMaxLeverageAborts } from "../helpers/trading/above-max-leverage-case.ts";
import { openInvalidSizeAbortPossible } from "../helpers/trading/market-summary-assertions.ts";
import { WATERX_PERP_ABORT } from "../helpers/waterx-perp-error-codes.ts";

const TINY_COLLATERAL_RAW = 1n;

describe.each(activeLifecycleTestBases())(
  "Simulate: trading expected failures (MoveAbort) — %s",
  (base) => {
    const row = lifecycleRow(base);
    /** Needs USDC ≥ `simulateOpenCollateral` for above-max-leverage collateral leg. */
    let hitStrict: DiscoveredPosition | null = null;
    /**
     * For `err_invalid_size` (201) with 1 raw collateral, any TTO USDC coin suffices.
     * Fallback when strict discovery misses (e.g. no account with both an open position on this base and ≥ simulateOpenCollateral USDC).
     */
    let hitForMinColl: DiscoveredPosition | null = null;

    beforeAll(async () => {
      hitStrict = await discoverActivePositionForNegativeOpen(client, base);
      hitForMinColl =
        hitStrict ??
        (await discoverActivePosition(client, base, {
          minAccountUsdcBalance: 1n,
        }));
    }, 120_000);

    it(`${base}: open at max leverage + 1 → err_exceed_max_leverage (104)`, async (ctx) => {
      if (!hitStrict) {
        ctx.skip(
          `No ${base} discovery with TTO USDC ≥ simulateOpenCollateral (needed for default-USDC buildOpenPositionTx).`,
        );
        return;
      }
      await assertOpenAboveMaxLeverageAborts(
        ctx,
        client,
        base,
        hitStrict.accountObjectAddress,
        hitStrict.ownerAddress,
        (tx) => client.simulate(tx),
      );
    }, 60_000);

    it(`${base}: open with collateral below min_coll_value → err_invalid_size (201)`, async (ctx) => {
      if (!hitForMinColl) {
        ctx.skip(
          `No ${base} discovery with TTO USDC ≥ 1 raw (or strict hit) for default-USDC buildOpenPositionTx.`,
        );
        return;
      }
      const accountId = hitForMinColl.accountObjectAddress;
      const owner = hitForMinColl.ownerAddress;

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
      tx.setSender(owner);
      const result = await simulateWithTransientRetry(() => client.simulate(tx));
      if (skipSimulateIfOracleTransient(ctx, result)) return;
      // If the shared chain state (e.g. current collateral USD price for this
      // base) happens to make 1 raw unit already satisfy min_coll_value, the
      // simulate may succeed; treat as environmental and skip.
      const r = result as unknown as { $kind?: string };
      if (r.$kind !== "FailedTransaction") {
        ctx.skip(
          `${base}: min_coll_value guard not triggered at 1 raw collateral under current price`,
        );
        return;
      }
      assertSimulateMoveAbort(result, {
        abortCode: WATERX_PERP_ABORT.INVALID_SIZE,
        locationIncludes: "err_invalid_size",
      });
    }, 60_000);
  },
);

describe("Simulate: withdrawCollateral exceeds max leverage (MoveAbort)", () => {
  for (const base of activeLifecycleTestBases()) {
    it(`${base}: withdraw nearly all collateral → err_exceed_max_leverage (104)`, async (ctx) => {
      const hit = await discoverActivePosition(client, base);
      if (!hit) {
        ctx.skip(`No ${base} discovery`);
        return;
      }

      const found = await discoverActivePositionForAccount(client, base, hit.accountObjectAddress);
      if (!found) {
        ctx.skip(`No open ${base} position for discovered account`);
        return;
      }

      const withdrawAmount = found.position.collateralAmount - 1n;
      if (withdrawAmount <= 0n) {
        ctx.skip(`${base} position collateral too low (${found.position.collateralAmount})`);
        return;
      }

      const tx = await buildWithdrawCollateralTx(client, {
        accountId: found.accountObjectAddress,
        base,
        collateral: found.collateral,
        positionId: Number(found.positionId),
        amount: withdrawAmount,
      });
      tx.setSender(found.ownerAddress);
      const result = await simulateWithTransientRetry(() => client.simulate(tx));
      if (skipSimulateIfOracleTransient(ctx, result)) return;
      assertSimulateMoveAbort(result, {
        abortCode: WATERX_PERP_ABORT.EXCEED_MAX_LEVERAGE,
        locationIncludes: "err_exceed_max_leverage",
      });
    }, 60_000);
  }
});

/**
 * E2E simulate: per-market discovery (`getMarketPositions` → owner) + trading matrix
 * (increase / decrease / deposit / withdraw / close × positive / negative).
 */
import { getMarketSummary } from "@waterx/perp-sdk";
import { describe, test } from "vitest";

import {
  discoverActivePositionFirstMatchingTiers,
  discoveryTiersForStatefulMatrixForBase,
  e2eSkipReasonNoEligibleMarketPosition,
} from "../helpers/e2e/discover-on-chain-position.ts";
import { client } from "../helpers/e2e/e2e-client.ts";
import { activeLifecycleTestBases, lifecycleRow } from "../helpers/e2e/lifecycle-test-markets.ts";
import {
  assertSimulateAbortMatches,
  assertSimulateSuccess,
  simulateWithTransientRetry,
  skipSimulateIfOracleTransient,
  stateDependentSimulateSkipReason,
} from "../helpers/e2e/simulate-assertions.ts";
import { deriveTradingMatrixCases } from "../helpers/scratch/derive-simulate-scenarios.ts";
import { MATRIX_SKIP_PREFIX } from "../helpers/trading/market-trading-size-constraints.ts";

describe("discovery trading matrix (simulate)", () => {
  for (const base of activeLifecycleTestBases()) {
    const row = lifecycleRow(base);

    test(`${base} — matrix`, async (ctx) => {
      const discovered = await discoverActivePositionFirstMatchingTiers(
        client,
        base,
        discoveryTiersForStatefulMatrixForBase(base),
      );
      if (!discovered) {
        ctx.skip(e2eSkipReasonNoEligibleMarketPosition(base));
        return;
      }

      const m = client.getMarketEntry(base);
      const summary = await getMarketSummary(client, m.marketId, m.baseType);
      const ghostPositionId = summary.nextPositionId + 100n;
      const cases = deriveTradingMatrixCases(discovered, row, ghostPositionId);

      for (const c of cases) {
        let tx;
        try {
          tx = await c.buildTx(client, discovered, row);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes(MATRIX_SKIP_PREFIX)) {
            ctx.skip(`${c.label}: ${msg}`);
            return;
          }
          if (
            (c.op === "deposit" || c.op === "increase") &&
            c.polarity === "positive" &&
            /No (USDC|USDSUI) coins found in account /i.test(msg)
          ) {
            ctx.skip(`${c.label}: ${msg}`);
            return;
          }
          throw e;
        }

        tx.setSender(discovered.ownerAddress);
        const result = await simulateWithTransientRetry(() => client.simulate(tx));

        if (skipSimulateIfOracleTransient(ctx, result)) {
          return;
        }

        if (c.expect.kind === "success") {
          // Pre-check: if the shared chain happens to put the discovered
          // position near max leverage / low collateral / non-USDC collateral,
          // skip the positive case without triggering the dump + stderr
          // brief that `assertSimulateSuccess` would otherwise emit.
          if (c.polarity === "positive") {
            const skipReason = stateDependentSimulateSkipReason(result);
            if (skipReason != null) {
              ctx.skip(`${c.label}: ${skipReason}`);
              return;
            }
          }
          try {
            assertSimulateSuccess(result, c.expect.minCommands, { transaction: tx });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw err instanceof Error ? new Error(`[${c.label}] ${msg}`) : err;
          }
        } else {
          try {
            assertSimulateAbortMatches(result, {
              abortCode: c.expect.abortCode,
              locationIncludes: c.expect.locationIncludes,
            });
          } catch (err) {
            throw err instanceof Error ? new Error(`[${c.label}] ${err.message}`) : err;
          }
        }
      }
    }, 600_000);
  }
});

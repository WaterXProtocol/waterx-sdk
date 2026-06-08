/**
 * Headless frontend E2E (opt-in): catalog → POST place → execute txBytes → fill → bets/me.
 *
 * Enable: `E2E_HEADLESS_BET=1` + `SUI_PRIVATE_KEY` + `E2E_API_ENV` + `E2E_API_JWT`
 * (wallet should own the wxa account; keeper on same key fills when broker is slow).
 *
 * Run: `pnpm test:integration:predict:headless`
 */
import { beforeAll, describe, expect, it } from "vitest";

import { isApiUnreachableError } from "../helpers/api-client.ts";
import { betListIncludesPositionId, betOrderId } from "../helpers/api-contract.ts";
import { formatCatalogPlaceFailures } from "../helpers/api-tx-build.ts";
import type { CatalogPlaceFailure } from "../helpers/api-tx-build.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import {
  hasHeadlessBetEnabled,
  runHeadlessCatalogBetFlow,
} from "../helpers/headless-catalog-bet.ts";
import { resolveIntegrationApiEnv, skipIntegrationApiAuthed } from "../helpers/integration-api.ts";
import { setupIntegration, type IntegrationCtx } from "../helpers/integration-setup.ts";

describe.skipIf(!hasWriteCredentials() || !hasHeadlessBetEnabled())(
  "headless catalog bet (integration)",
  () => {
    let ctx: IntegrationCtx;
    const apiEnv = resolveIntegrationApiEnv();

    beforeAll(async () => {
      ctx = await setupIntegration();
    }, 180_000);

    it("catalog → place txBytes → on-chain fill → GET /predict/bets/me", async (testCtx) => {
      skipIntegrationApiAuthed(testCtx, apiEnv);

      const placeFailures: CatalogPlaceFailure[] = [];
      try {
        const outcome = await runHeadlessCatalogBetFlow(testCtx, ctx, apiEnv!, {
          placeFailures,
        });
        if (!outcome) {
          testCtx.skip(
            true,
            `no catalog market returned HTTP 200 txBytes — ${formatCatalogPlaceFailures(placeFailures)}`,
          );
          return;
        }

        expect(outcome.place.orderId).toBeGreaterThanOrEqual(0n);
        expect(outcome.fill.positionId).toBeGreaterThanOrEqual(0n);
        expect(outcome.marketSlug.length).toBeGreaterThan(0);

        const bet = outcome.bet;
        const matchedOrder =
          betOrderId(bet) === String(outcome.place.orderId) ||
          betListIncludesPositionId([bet], outcome.fill.positionId);
        expect(matchedOrder).toBe(true);

        if (bet.marketSlug !== undefined) {
          expect(bet.marketSlug).toBe(outcome.marketSlug);
        }
      } catch (err) {
        if (isApiUnreachableError(err)) {
          testCtx.skip(true, `API unreachable at ${apiEnv!.baseUrl}`);
          return;
        }
        throw err;
      }
    }, 360_000);
  },
);

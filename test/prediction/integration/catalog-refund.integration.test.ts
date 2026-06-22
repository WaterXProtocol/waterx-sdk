/**
 * Refund probe (opt-in): unfillable `priceCapBps` → OrderCancelled → full wxa refund.
 *
 * Enable: `E2E_CATALOG_REFUND=1` + `SUI_PRIVATE_KEY` + `E2E_API_ENV=staging`
 * Run: `pnpm test:integration:predict:refund`
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { CatalogPlaceFailure } from "../helpers/api-catalog-pure.ts";
import { isApiUnreachableError } from "../helpers/api-client.ts";
import {
  formatCatalogPlaceFailures,
  hasCatalogRefundEnabled,
  runCatalogRefundProbe,
} from "../helpers/catalog-refund.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { resolveIntegrationApiEnv, skipIntegrationApiBets } from "../helpers/integration-api.ts";
import { setupIntegration, type IntegrationCtx } from "../helpers/integration-setup.ts";

describe.skipIf(!hasWriteCredentials() || !hasCatalogRefundEnabled())(
  "catalog refund probe (integration)",
  () => {
    let ctx: IntegrationCtx;
    const apiEnv = resolveIntegrationApiEnv();

    beforeAll(async () => {
      ctx = await setupIntegration();
    }, 180_000);

    it("tight priceCap → OrderCancelled refunds maxSpend to wxa balance", async (testCtx) => {
      skipIntegrationApiBets(testCtx, apiEnv, ctx.ownerAddress);

      const placeFailures: CatalogPlaceFailure[] = [];
      try {
        const outcome = await runCatalogRefundProbe(ctx, apiEnv!, { placeFailures });
        if (!outcome) {
          testCtx.skip(
            true,
            `no catalog market for refund probe — ${formatCatalogPlaceFailures(placeFailures)}`,
          );
          return;
        }

        expect(outcome.refundAmount).toBe(outcome.maxSpend);
        expect(outcome.balances.afterRefund).toBe(outcome.balances.beforePlace);
        expect(outcome.balances.afterPlace).toBe(outcome.balances.beforePlace - outcome.maxSpend);
        expect(Number(outcome.priceCapBps)).toBeLessThan(outcome.quoteBps);
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

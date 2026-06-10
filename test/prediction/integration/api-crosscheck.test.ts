import { beforeAll, describe, expect, it } from "vitest";

import { isApiUnreachableError } from "../helpers/api-client.ts";
import {
  assertCrosscheckFillChainAndApi,
  crosscheckBetsMePollMs,
  logCrosscheckChainRefs,
  pollBetsMeForChainFixtureSoft,
  resolveCrosscheckFillEventAsync,
  runCatalogCrosscheckPlaceFill,
  runSoftBetsMeFieldAudit,
} from "../helpers/api-crosscheck-soft.ts";
import type { CatalogPlaceFailure } from "../helpers/api-tx-build.ts";
import { formatCatalogPlaceFailures } from "../helpers/api-tx-build.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import {
  hasApiCrosscheckEnabled,
  resolveIntegrationApiEnv,
  skipIntegrationApiCrosscheck,
} from "../helpers/integration-api.ts";
import { setupIntegration, type IntegrationCtx } from "../helpers/integration-setup.ts";
import { assertBetsMeContainsFixture } from "../helpers/journey-assertions.ts";

/**
 * Catalog chain → HTTP cross-check: feed → POST place → on-chain fill → poll
 * `GET /predict/bets/me`, then hard-assert OrderFilled ↔ API wire.
 *
 * Enable with `E2E_API_CROSSCHECK=1` (defaults `E2E_API_ENV=staging`) + wallet
 * (`E2E_API_ADDRESS` or JWT `suiAddress`; same as `SUI_PRIVATE_KEY`). Skips when catalog
 * cannot produce txBytes or indexer lag; hard-asserts when a catalog row is found.
 * Set `E2E_API_CROSSCHECK_STRICT=1` to also fail on supplemental field-audit mismatches.
 */
describe.skipIf(!hasWriteCredentials() || !hasApiCrosscheckEnabled())(
  "predict API cross-check (integration + HTTP)",
  () => {
    let ctx: IntegrationCtx;
    const apiEnv = resolveIntegrationApiEnv();

    beforeAll(async () => {
      ctx = await setupIntegration();
    }, 180_000);

    it("catalog place (+ fill) eventually appears in GET /predict/bets/me", async (testCtx) => {
      skipIntegrationApiCrosscheck(testCtx, apiEnv, ctx.ownerAddress);

      const placeFailures: CatalogPlaceFailure[] = [];
      let catalog: Awaited<ReturnType<typeof runCatalogCrosscheckPlaceFill>>;
      try {
        catalog = await runCatalogCrosscheckPlaceFill(ctx, apiEnv!, { placeFailures });
      } catch (err) {
        if (isApiUnreachableError(err)) {
          testCtx.skip(true, `API unreachable at ${apiEnv!.baseUrl}`);
          return;
        }
        throw err;
      }

      if (!catalog) {
        testCtx.skip(
          true,
          `no catalog market returned HTTP 200 txBytes — ${formatCatalogPlaceFailures(placeFailures)}`,
        );
        return;
      }

      const { placeResult, fillResult, orderId, marketSlug, chainIds, bypassFillInPlace } = catalog;

      const fillEv = await resolveCrosscheckFillEventAsync(
        ctx.client,
        placeResult,
        fillResult,
        orderId,
      );
      if (!fillEv) {
        testCtx.skip(
          true,
          "no OrderFilled on chain — broker/keeper fill required for API fill cross-check",
        );
        return;
      }

      const pollFixture = {
        orderId: chainIds.orderId,
        ...(chainIds.positionId !== undefined ? { positionId: chainIds.positionId } : {}),
      };

      const chainLog = logCrosscheckChainRefs({
        wallet: ctx.ownerAddress,
        accountId: ctx.accountId,
        marketSlug,
        orderId,
        chainIds,
        placeResult,
        fillResult,
        bypassFillInPlace,
      });

      try {
        const polled = await pollBetsMeForChainFixtureSoft(testCtx, apiEnv!, pollFixture, {
          wallet: ctx.ownerAddress,
          timeoutMs: crosscheckBetsMePollMs(),
        });

        if (polled.kind === "empty") {
          testCtx.skip(
            true,
            "GET /predict/bets/me returned no rows for this wallet — wallet→account resolver (#498) or indexer not wired",
          );
          return;
        }

        if (polled.kind === "stale") {
          testCtx.skip(
            true,
            `GET /predict/bets/me had bets but not orderId=${orderId}${chainIds.positionId !== undefined ? ` / positionId=${chainIds.positionId}` : ""} within poll window` +
              (polled.lastSample ? ` (sample: ${polled.lastSample})` : "") +
              ` — indexer lag or bypass wire (API positionId may equal orderId, not chain position_id); catalog ${marketSlug}; chain refs:\n${chainLog}`,
          );
          return;
        }

        assertBetsMeContainsFixture(polled.data, pollFixture);
        if (polled.bet.marketSlug !== undefined) {
          expect(polled.bet.marketSlug).toBe(marketSlug);
        }

        await assertCrosscheckFillChainAndApi(ctx.client, {
          accountId: ctx.accountId,
          chainIds,
          bet: polled.bet,
          placeResult,
          fillResult,
        });
        await runSoftBetsMeFieldAudit(ctx.client, {
          accountId: ctx.accountId,
          chainIds,
          apiData: polled.data,
          apiEnv: apiEnv!,
          wallet: ctx.ownerAddress,
        });
      } catch (err) {
        if (isApiUnreachableError(err)) {
          testCtx.skip(true, `API unreachable at ${apiEnv!.baseUrl}`);
          return;
        }
        throw err;
      }
    }, 180_000);
  },
);

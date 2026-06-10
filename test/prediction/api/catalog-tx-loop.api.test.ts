import { describe, it, type TestContext } from "vitest";

import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { skipIfNoApiEnv, skipIfUnreachable } from "../helpers/api-skip.ts";
import {
  assertCatalogPlaceTxBuildResult,
  formatCatalogPlaceFailures,
  hasTxBuildSmokeEnabled,
  resolvePlaceBetCredentials,
  tryCatalogPlaceTxBuild,
  type CatalogPlaceFailure,
} from "../helpers/api-tx-build.ts";

/**
 * Closed loop: feed → market detail (`trade.marketId`) → POST /predict/bets/place → `txBytes`.
 *
 * Staging (`pnpm test:api:staging`) enables tx-build by default. Needs place credentials in `.env.local`:
 *   E2E_API_PLACE_ACCOUNT_ID=0x…   # wxa registry account (or E2E_ACCOUNT_ID)
 *   E2E_API_PLACE_SENDER=0x…       # wallet sender (or E2E_ACCOUNT_OWNER / JWT suiAddress)
 */
describe("predict catalog → tx-build closed loop", () => {
  const env = resolveApiEnvironment();

  it("POST /predict/bets/place returns txBytes from catalog trade side", async (ctx: TestContext) => {
    if (!hasTxBuildSmokeEnabled()) {
      ctx.skip(
        true,
        "E2E_API_TX_BUILD disabled — set E2E_API_TX_BUILD=1 or use staging (default on)",
      );
    }
    skipIfNoApiEnv(ctx, env);
    const creds = resolvePlaceBetCredentials(env!);
    if (!creds) {
      ctx.skip(
        true,
        "Need place credentials — set E2E_ACCOUNT_ID (or seed accountId) + E2E_API_ADDRESS / E2E_API_PLACE_SENDER",
      );
      return;
    }

    try {
      const failures: CatalogPlaceFailure[] = [];
      const hit = await tryCatalogPlaceTxBuild(env!, creds, { failures });
      if (!hit) {
        ctx.skip(
          true,
          `no catalog market produced HTTP 200 txBytes — ${formatCatalogPlaceFailures(failures)}`,
        );
        return;
      }
      assertCatalogPlaceTxBuildResult(hit.envelope);
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });
});

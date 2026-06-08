import { describe, it, type TestContext } from "vitest";

import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { skipIfNoApiEnv, skipIfUnreachable } from "../helpers/api-skip.ts";
import {
  assertCatalogPlaceTxBuildResult,
  hasTxBuildSmokeEnabled,
  resolvePlaceBetCredentials,
  tryCatalogPlaceTxBuild,
} from "../helpers/api-tx-build.ts";

/**
 * Closed loop: feed → market detail (`trade.marketId`) → POST /predict/bets/place → `txBytes`.
 *
 * Enable:
 *   E2E_API_TX_BUILD=1
 *   E2E_API_PLACE_ACCOUNT_ID=0x…   # wxa registry account (or E2E_ACCOUNT_ID)
 *   E2E_API_PLACE_SENDER=0x…       # wallet sender (or E2E_ACCOUNT_OWNER / JWT suiAddress)
 *
 * Example:
 *   E2E_API_ENV=staging E2E_API_TX_BUILD=1 pnpm test:api:staging -- catalog-tx-loop
 */
describe("predict catalog → tx-build closed loop (opt-in)", () => {
  const env = resolveApiEnvironment();

  it("POST /predict/bets/place returns txBytes from catalog trade side", async (ctx: TestContext) => {
    if (!hasTxBuildSmokeEnabled()) {
      ctx.skip(
        true,
        "Set E2E_API_TX_BUILD=1 to run catalog → detail → POST /predict/bets/place closed loop",
      );
    }
    skipIfNoApiEnv(ctx, env);
    const creds = resolvePlaceBetCredentials(env!);
    if (!creds) {
      ctx.skip(
        true,
        "Set E2E_API_PLACE_ACCOUNT_ID + E2E_API_PLACE_SENDER (or E2E_ACCOUNT_ID + E2E_ACCOUNT_OWNER / JWT wallet)",
      );
      return;
    }

    try {
      const hit = await tryCatalogPlaceTxBuild(env!, creds);
      if (!hit) {
        ctx.skip(
          true,
          "no catalog market produced HTTP 200 txBytes — account may be unknown on API chain, market paused, or simulate aborted",
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

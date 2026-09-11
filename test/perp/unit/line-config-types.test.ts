import { describe, expectTypeOf, it } from "vitest";

import type {
  PackageEntry,
  PerpLineConfig,
  PredictionLineConfig,
  WaterXConfig,
} from "../../../src/config.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import { PredictClient } from "../../../src/prediction/client.ts";

/**
 * The line config types are only worth having if a CLIENT hands one back: they
 * name the guarantee each client's `assertLinePackages` call establishes at
 * construction, over and above what the loader checks. They were once exported
 * but attached to neither client, so `client.config` still exposed only the
 * shared core and the stronger type was unreachable.
 *
 * `expectTypeOf` erases at runtime — these are enforced by `pnpm typecheck`
 * (which covers `test/perp/unit`), so a regression fails the build, not a run.
 */
describe("line config types are reachable through the clients that establish them", () => {
  it("PerpClient['config'] is a PerpLineConfig", () => {
    expectTypeOf<PerpClient["config"]>().toEqualTypeOf<PerpLineConfig>();
    // Structurally present, not an index-signature guess.
    expectTypeOf<PerpClient["config"]["packages"]["waterx_perp"]>().toEqualTypeOf<PackageEntry>();
    expectTypeOf<PerpClient["config"]["packages"]["wlp"]>().toEqualTypeOf<PackageEntry>();
  });

  it("PredictClient['config'] is a PredictionLineConfig", () => {
    expectTypeOf<PredictClient["config"]>().toEqualTypeOf<PredictionLineConfig>();
    expectTypeOf<
      PredictClient["config"]["packages"]["waterx_prediction"]
    >().toEqualTypeOf<PackageEntry>();
  });

  it("each line config is a WaterXConfig, and the loader's result is neither", () => {
    expectTypeOf<PerpLineConfig>().toMatchTypeOf<WaterXConfig>();
    expectTypeOf<PredictionLineConfig>().toMatchTypeOf<WaterXConfig>();
    // The loader promises only the shared core: a bare parse result must NOT
    // satisfy a line config, or the over-promise this all fixed is back.
    expectTypeOf<WaterXConfig>().not.toMatchTypeOf<PerpLineConfig>();
    expectTypeOf<WaterXConfig>().not.toMatchTypeOf<PredictionLineConfig>();
  });
});

import { PredictClient } from "~predict/client.ts";
import { describe, expect, it } from "vitest";

import type { WxaClientLike } from "../../../src/account/client.ts";
import { PerpClient } from "../../../src/perp/client.ts";

/**
 * Architectural guard: the account/ base owns the generic wxa builders
 * (createAccount / delegates / alias …), typed to the narrow `WxaClientLike`
 * capability interface. BOTH line clients must satisfy it so the builders are
 * genuinely shared (no per-line duplicate of the wxa framework). These are
 * compile-time assignability checks — tsc fails the build if either line's
 * config drifts to drop `waterx_account` / `bucket_framework`.
 */
describe("WxaClientLike capability", () => {
  it("PredictClient structurally satisfies WxaClientLike", () => {
    const asWxa = (c: PredictClient): WxaClientLike => c;
    expect(asWxa).toBeTypeOf("function");
  });

  it("PerpClient structurally satisfies WxaClientLike", () => {
    const asWxa = (c: PerpClient): WxaClientLike => c;
    expect(asWxa).toBeTypeOf("function");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `packages/predict-stress` is a standalone workspace package that cannot
 * import across its own root, so `pnpm sync` VENDORS shared modules into it.
 * A vendored copy that drifts from its source is invisible — the package
 * typechecks and its tests pass against the stale copy, and the bug only
 * surfaces when someone runs the stress harness.
 *
 * That already happened once: the env URL helper was hand-copied, then its
 * source was fixed (a legacy `…/testnet.json?ref=x` requested for mainnet was
 * returned unswapped), and the copy kept the bug. This pins the two together
 * so the next drift fails here instead of in a stress run.
 */
describe("predict-stress vendored modules", () => {
  it("waterx-config-url.ts is byte-identical to its source", () => {
    const source = readFileSync(
      new URL("../../../scripts/waterx-config-url.ts", import.meta.url),
      "utf8",
    );
    const vendored = readFileSync(
      new URL("../../../packages/predict-stress/src/helpers/waterx-config-url.ts", import.meta.url),
      "utf8",
    );
    expect(vendored).toBe(source);
  });
});

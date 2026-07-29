/**
 * The e2e `EMissingPriceSource` skip gate must never mask a real regression:
 * it may only fire when the live aggregator is proven to weight a rule this
 * build does not feed. These cases pin both directions of that gate.
 */
import { describe, expect, it, vi } from "vitest";

import { skipSimulateIfWeightedSourceMissing } from "../helpers/e2e/simulate-assertions.ts";

const MISSING_SOURCE_ABORT = {
  $kind: "FailedTransaction",
  FailedTransaction: {
    status: {
      error: {
        message:
          "MoveAbort in 9th command, 'EMissingPriceSource': Collector missing a weighted price " +
          "source, in '0x3833::aggregator::remove_outliers' (line 363)",
      },
    },
  },
};

const UNFED = ["0xa741::waterx_rule::WaterxRule"];

describe("skipSimulateIfWeightedSourceMissing", () => {
  it("skips when the aggregator weights a rule this build does not feed", () => {
    const ctx = { skip: vi.fn() };
    expect(skipSimulateIfWeightedSourceMissing(ctx, MISSING_SOURCE_ABORT, UNFED)).toBe(true);
    expect(ctx.skip).toHaveBeenCalledWith(expect.stringContaining("waterx_rule::WaterxRule"));
  });

  it("does NOT skip the same abort when every weighted rule IS fed (real regression)", () => {
    // The environment is satisfiable, so an EMissingPriceSource here means the
    // build dropped a collector feed — exactly what these suites must catch.
    const ctx = { skip: vi.fn() };
    expect(skipSimulateIfWeightedSourceMissing(ctx, MISSING_SOURCE_ABORT, [])).toBe(false);
    expect(ctx.skip).not.toHaveBeenCalled();
  });

  it("does not swallow a different abort even when the environment is unsatisfiable", () => {
    const ctx = { skip: vi.fn() };
    const otherAbort = {
      $kind: "FailedTransaction",
      FailedTransaction: { status: { error: { message: "MoveAbort … 'EInsufficientMargin'" } } },
    };
    expect(skipSimulateIfWeightedSourceMissing(ctx, otherAbort, UNFED)).toBe(false);
    expect(ctx.skip).not.toHaveBeenCalled();
  });

  it("ignores a successful simulate", () => {
    const ctx = { skip: vi.fn() };
    expect(skipSimulateIfWeightedSourceMissing(ctx, { $kind: "Transaction" }, UNFED)).toBe(false);
    expect(ctx.skip).not.toHaveBeenCalled();
  });
});

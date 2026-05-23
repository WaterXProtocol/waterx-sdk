/**
 * Unit tests for integration gas budget + SUI error detection helpers.
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  integrationGasBudget,
  integrationMinSuiMist,
  isInsufficientSuiGasError,
} from "../integration/helpers/integration-gas.ts";

describe("integration gas helpers", () => {
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("integrationGasBudget uses low defaults and global env override", () => {
    expect(integrationGasBudget("custodyMint")).toBe(10_000_000);
    prev.WATERX_INTEGRATION_GAS_BUDGET = process.env.WATERX_INTEGRATION_GAS_BUDGET;
    process.env.WATERX_INTEGRATION_GAS_BUDGET = "12000000";
    expect(integrationGasBudget("wlp")).toBe(12_000_000);
  });

  it("integrationMinSuiMist is disabled by default", () => {
    delete process.env.WATERX_INTEGRATION_MIN_SUI_MIST;
    expect(integrationMinSuiMist()).toBeNull();
    prev.WATERX_INTEGRATION_MIN_SUI_MIST = process.env.WATERX_INTEGRATION_MIN_SUI_MIST;
    process.env.WATERX_INTEGRATION_MIN_SUI_MIST = "999";
    expect(integrationMinSuiMist()).toBe(999n);
  });

  it("isInsufficientSuiGasError matches gas selection failures", () => {
    expect(
      isInsufficientSuiGasError(
        new Error(
          "Unable to perform gas selection due to insufficient SUI balance for account 0x2",
        ),
      ),
    ).toBe(true);
    expect(isInsufficientSuiGasError(new Error("Move abort"))).toBe(false);
  });
});

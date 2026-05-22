import { afterEach, describe, expect, it } from "vitest";

import { shouldRunE2ePersistentPreflight } from "../helpers/e2e/e2e-persistent-preflight.ts";

describe("e2e persistent preflight flags", () => {
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("is off by default (pnpm test:e2e does not auto-run preflight)", () => {
    prev.WATERX_E2E_PREFLIGHT = process.env.WATERX_E2E_PREFLIGHT;
    delete process.env.WATERX_E2E_PREFLIGHT;
    expect(shouldRunE2ePersistentPreflight()).toBe(false);
  });

  it("runs from Vitest setup only when WATERX_E2E_PREFLIGHT=1 and key is configured", () => {
    prev.WATERX_E2E_PREFLIGHT = process.env.WATERX_E2E_PREFLIGHT;
    process.env.WATERX_E2E_PREFLIGHT = "1";
    expect(shouldRunE2ePersistentPreflight()).toBe(
      Boolean(process.env.WATERX_INTEGRATION_PRIVATE_KEY?.trim()),
    );
  });
});

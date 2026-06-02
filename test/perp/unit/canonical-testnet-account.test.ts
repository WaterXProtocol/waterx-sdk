import { afterEach, describe, expect, it } from "vitest";

import {
  E2E_CANONICAL_TESTNET_WXA_ACCOUNT_ID,
  e2eCanonicalWxaAccountIds,
  wxaAccountIdHints,
} from "../helpers/e2e/canonical-testnet-account.ts";

describe("canonical testnet wxa account", () => {
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("includes built-in account on testnet when env is unset", () => {
    for (const k of [
      "WATERX_E2E_WXA_ACCOUNT_ID",
      "WATERX_INTEGRATION_ACCOUNT_ID",
      "WATERX_E2E_DISABLE_CANONICAL_WXA",
    ]) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
    expect(e2eCanonicalWxaAccountIds("testnet")).toEqual([E2E_CANONICAL_TESTNET_WXA_ACCOUNT_ID]);
    expect(wxaAccountIdHints("testnet")).toEqual([E2E_CANONICAL_TESTNET_WXA_ACCOUNT_ID]);
  });

  it("prefers env account over canonical", () => {
    prev.WATERX_E2E_WXA_ACCOUNT_ID = process.env.WATERX_E2E_WXA_ACCOUNT_ID;
    process.env.WATERX_E2E_WXA_ACCOUNT_ID = "0xabc";
    expect(wxaAccountIdHints("testnet")[0]).toBe("0xabc");
  });

  it("returns empty on mainnet", () => {
    expect(e2eCanonicalWxaAccountIds("mainnet")).toEqual([]);
  });
});

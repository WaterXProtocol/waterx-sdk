import { afterEach, describe, expect, it, vi } from "vitest";

import { MARKET_DETAIL_FIXTURE } from "../fixtures/api-wire-fixtures.ts";
import type { ApiEnvironment } from "../helpers/api-env.ts";
import {
  buildPlaceBetRequest,
  hasTxBuildSmokeEnabled,
  oddsCentsToPriceCapBps,
  pickTradeableSide,
  resolvePlaceBetCredentials,
} from "../helpers/api-tx-build.ts";

describe("api-tx-build helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("pickTradeableSide reads detail.round.sides[].trade", () => {
    const side = pickTradeableSide(MARKET_DETAIL_FIXTURE);
    expect(side?.key).toBe("up");
    expect(side?.trade?.marketId).toBe("0xabc");
    expect(side?.trade?.selection).toBe("YES");
  });

  it("oddsCentsToPriceCapBps and buildPlaceBetRequest", () => {
    expect(oddsCentsToPriceCapBps(52)).toBe("5201");
    expect(oddsCentsToPriceCapBps(60)).toBe("6001");
    const side = pickTradeableSide(MARKET_DETAIL_FIXTURE)!;
    const body = buildPlaceBetRequest({ accountId: "0xacc1", sender: "0xsender1" }, side, {
      maxSpend: "500000",
    });
    expect(body.marketId).toBe("0xabc");
    expect(body.selection).toBe("YES");
    expect(body.priceCapBps).toBe("5201");
    expect(body.maxSpend).toBe("500000");
    expect(body.accountId).toBe("0xacc1");
    expect(body.sender).toBe("0xsender1");
  });

  it("hasTxBuildSmokeEnabled defaults on for staging", () => {
    vi.stubEnv("E2E_API_ENV", "staging");
    vi.stubEnv("E2E_API_TX_BUILD", undefined);
    expect(hasTxBuildSmokeEnabled()).toBe(true);
    vi.stubEnv("E2E_API_TX_BUILD", "0");
    expect(hasTxBuildSmokeEnabled()).toBe(false);
  });

  it("resolvePlaceBetCredentials falls back to E2E_API_ADDRESS for sender", () => {
    const wallet = `0x${"a".repeat(64)}`;
    const account = `0x${"b".repeat(64)}`;
    vi.stubEnv("E2E_API_PLACE_ACCOUNT_ID", undefined);
    vi.stubEnv("E2E_API_PLACE_SENDER", undefined);
    vi.stubEnv("E2E_ACCOUNT_OWNER", undefined);
    vi.stubEnv("E2E_ACCOUNT_ID", account);
    vi.stubEnv("E2E_API_ADDRESS", wallet);
    const env = { name: "t", baseUrl: "http://x" } satisfies ApiEnvironment;
    expect(resolvePlaceBetCredentials(env)).toEqual({
      accountId: account,
      sender: wallet,
    });
  });

  it("resolvePlaceBetCredentials prefers explicit place env", () => {
    vi.stubEnv("E2E_API_PLACE_ACCOUNT_ID", "0xaccount");
    vi.stubEnv("E2E_API_PLACE_SENDER", "0xsender");
    const env = { name: "t", baseUrl: "http://x" } satisfies ApiEnvironment;
    expect(resolvePlaceBetCredentials(env)).toEqual({
      accountId: "0xaccount",
      sender: "0xsender",
    });
  });
});

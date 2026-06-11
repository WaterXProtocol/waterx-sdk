import { describe, expect, it } from "vitest";

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
    const prev = {
      E2E_API_TX_BUILD: process.env.E2E_API_TX_BUILD,
      E2E_API_ENV: process.env.E2E_API_ENV,
    };
    delete process.env.E2E_API_TX_BUILD;
    process.env.E2E_API_ENV = "staging";
    expect(hasTxBuildSmokeEnabled()).toBe(true);
    process.env.E2E_API_TX_BUILD = "0";
    expect(hasTxBuildSmokeEnabled()).toBe(false);
    process.env.E2E_API_TX_BUILD = prev.E2E_API_TX_BUILD;
    process.env.E2E_API_ENV = prev.E2E_API_ENV;
  });

  it("resolvePlaceBetCredentials falls back to E2E_API_ADDRESS for sender", () => {
    const prev = {
      E2E_API_PLACE_ACCOUNT_ID: process.env.E2E_API_PLACE_ACCOUNT_ID,
      E2E_API_PLACE_SENDER: process.env.E2E_API_PLACE_SENDER,
      E2E_ACCOUNT_ID: process.env.E2E_ACCOUNT_ID,
      E2E_ACCOUNT_OWNER: process.env.E2E_ACCOUNT_OWNER,
      E2E_API_ADDRESS: process.env.E2E_API_ADDRESS,
    };
    const wallet = `0x${"a".repeat(64)}`;
    const account = `0x${"b".repeat(64)}`;
    delete process.env.E2E_API_PLACE_ACCOUNT_ID;
    delete process.env.E2E_API_PLACE_SENDER;
    delete process.env.E2E_ACCOUNT_OWNER;
    process.env.E2E_ACCOUNT_ID = account;
    process.env.E2E_API_ADDRESS = wallet;
    const env = { name: "t", baseUrl: "http://x" } satisfies ApiEnvironment;
    expect(resolvePlaceBetCredentials(env)).toEqual({
      accountId: account,
      sender: wallet,
    });
    process.env.E2E_API_PLACE_ACCOUNT_ID = prev.E2E_API_PLACE_ACCOUNT_ID;
    process.env.E2E_API_PLACE_SENDER = prev.E2E_API_PLACE_SENDER;
    process.env.E2E_ACCOUNT_ID = prev.E2E_ACCOUNT_ID;
    process.env.E2E_ACCOUNT_OWNER = prev.E2E_ACCOUNT_OWNER;
    process.env.E2E_API_ADDRESS = prev.E2E_API_ADDRESS;
  });

  it("resolvePlaceBetCredentials prefers explicit place env", () => {
    const prev = {
      E2E_API_PLACE_ACCOUNT_ID: process.env.E2E_API_PLACE_ACCOUNT_ID,
      E2E_API_PLACE_SENDER: process.env.E2E_API_PLACE_SENDER,
    };
    process.env.E2E_API_PLACE_ACCOUNT_ID = "0xaccount";
    process.env.E2E_API_PLACE_SENDER = "0xsender";
    const env = { name: "t", baseUrl: "http://x" } satisfies ApiEnvironment;
    expect(resolvePlaceBetCredentials(env)).toEqual({
      accountId: "0xaccount",
      sender: "0xsender",
    });
    process.env.E2E_API_PLACE_ACCOUNT_ID = prev.E2E_API_PLACE_ACCOUNT_ID;
    process.env.E2E_API_PLACE_SENDER = prev.E2E_API_PLACE_SENDER;
  });
});

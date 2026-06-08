import { describe, expect, it } from "vitest";

import { MARKET_DETAIL_FIXTURE } from "../fixtures/api-wire-fixtures.ts";
import type { ApiEnvironment } from "../helpers/api-env.ts";
import {
  buildPlaceBetRequest,
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
    expect(oddsCentsToPriceCapBps(52)).toBe("5200");
    const side = pickTradeableSide(MARKET_DETAIL_FIXTURE)!;
    const body = buildPlaceBetRequest({ accountId: "0xacc1", sender: "0xsender1" }, side, {
      maxSpend: "500000",
    });
    expect(body.marketId).toBe("0xabc");
    expect(body.selection).toBe("YES");
    expect(body.priceCapBps).toBe("5200");
    expect(body.maxSpend).toBe("500000");
    expect(body.accountId).toBe("0xacc1");
    expect(body.sender).toBe("0xsender1");
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

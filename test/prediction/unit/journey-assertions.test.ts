import { describe, expect, it } from "vitest";

import {
  BETS_ME_FIXTURE,
  FEED_LIST_FIXTURE,
  MARKET_DETAIL_FIXTURE,
  QUOTES_FIXTURE,
} from "../fixtures/api-wire-fixtures.ts";
import {
  assertBetsMeContainsFixture,
  assertCatalogApiChain,
  assertCatalogBrowseAndDetail,
  assertSimulateSucceeded,
} from "../helpers/journey-assertions.ts";
import { mockCommandResults, mockFailedTransaction } from "../helpers/mock-simulate.ts";

describe("journey-assertions", () => {
  it("assertSimulateSucceeded accepts commandResults", () => {
    expect(() => assertSimulateSucceeded(mockCommandResults([]), "place")).not.toThrow();
  });

  it("assertSimulateSucceeded rejects FailedTransaction", () => {
    expect(() => assertSimulateSucceeded(mockFailedTransaction("abort"), "fill")).toThrow();
  });

  it("assertCatalogBrowseAndDetail", () => {
    const item = FEED_LIST_FIXTURE.items[0]!;
    assertCatalogBrowseAndDetail(
      FEED_LIST_FIXTURE,
      MARKET_DETAIL_FIXTURE,
      "crypto-btc-updown-5m",
      item,
    );
  });

  it("assertCatalogApiChain", () => {
    const item = FEED_LIST_FIXTURE.items[0]!;
    assertCatalogApiChain(
      item,
      MARKET_DETAIL_FIXTURE,
      QUOTES_FIXTURE,
      "crypto-btc-updown-5m",
      "r1",
    );
  });

  it("assertBetsMeContainsFixture finds order id", () => {
    const bet = assertBetsMeContainsFixture(BETS_ME_FIXTURE, { orderId: 42n });
    expect(bet.orderId ?? bet.order_id).toBeDefined();
  });
});

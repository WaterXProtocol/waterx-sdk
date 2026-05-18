import {
  buildClosePositionTx,
  buildPlaceOrderTx,
  claimReward,
  closePositionRequest,
  executeTrading,
  getMarketData,
  mintWlp,
  placeOrderRequest,
  stake,
  WaterXClient,
} from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

describe("SDK package wiring (v3)", () => {
  it("exports WaterXClient async factories", () => {
    expect(WaterXClient).toBeDefined();
    expect(typeof WaterXClient.create).toBe("function");
    expect(typeof WaterXClient.testnet).toBe("function");
  });

  it("exports trading request + execute + high-level builders", () => {
    expect(typeof closePositionRequest).toBe("function");
    expect(typeof executeTrading).toBe("function");
    expect(typeof buildClosePositionTx).toBe("function");
    expect(typeof placeOrderRequest).toBe("function");
    expect(typeof buildPlaceOrderTx).toBe("function");
  });

  it("exports fetch + WLP + staking", () => {
    expect(typeof getMarketData).toBe("function");
    expect(typeof mintWlp).toBe("function");
    expect(typeof stake).toBe("function");
    expect(typeof claimReward).toBe("function");
  });
});

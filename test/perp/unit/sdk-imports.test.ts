import {
  buildClosePositionTx,
  buildPlaceOrderTx,
  buildRedeemVaaTx,
  buildRequestCreditWithdrawTx,
  claimReward,
  closePositionRequest,
  custodyMint,
  executeTrading,
  fetchDepositVaa,
  getMarketData,
  mintCredit,
  mintCreditFromRequest,
  mintCreditToAccount,
  mintWlp,
  nativeCustodyCalls,
  placeOrderRequest,
  stake,
  WaterXClient,
} from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { Client, perp, prediction } from "../../../src/sdk.ts";

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

  it("exports native-custody builders + generated calls", () => {
    expect(typeof mintCredit).toBe("function");
    expect(typeof mintCreditFromRequest).toBe("function");
    expect(typeof mintCreditToAccount).toBe("function");
    expect(typeof nativeCustodyCalls.mint).toBe("function");
  });

  it("exports credit-bridge builders and wormhole helpers", () => {
    expect(typeof buildRedeemVaaTx).toBe("function");
    expect(typeof buildRequestCreditWithdrawTx).toBe("function");
    expect(typeof custodyMint).toBe("function");
    expect(typeof fetchDepositVaa).toBe("function");
  });

  it("exports unified Client facade from @waterx/sdk", () => {
    expect(typeof Client).toBe("function");
    expect(typeof Client.create).toBe("function");
    expect(typeof Client.fromClients).toBe("function");
    expect(typeof perp).toBe("object");
    expect(typeof prediction).toBe("object");
    expect(perp.WaterXClient).toBe(WaterXClient);
  });
});

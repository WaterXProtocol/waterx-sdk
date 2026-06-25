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
  getSpendableCreditBalance,
  mintCredit,
  mintCreditFromRequest,
  mintCreditToAccount,
  mintWlp,
  nativeCustodyCalls,
  PerpClient,
  placeOrderRequest,
  stake,
} from "@waterx/sdk";
import { describe, expect, it } from "vitest";

import { Client, perp, prediction, WaterXClient } from "../../../src/sdk.ts";

describe("SDK package wiring (v3)", () => {
  it("exports the perp sub-client PerpClient with async factories", () => {
    expect(PerpClient).toBeDefined();
    expect(typeof PerpClient.create).toBe("function");
    expect(typeof PerpClient.testnet).toBe("function");
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
    expect(typeof getSpendableCreditBalance).toBe("function");
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

  it("exports the umbrella WaterXClient (with deprecated Client alias) from @waterx/sdk", () => {
    expect(typeof WaterXClient).toBe("function");
    expect(typeof WaterXClient.create).toBe("function");
    expect(typeof WaterXClient.fromClients).toBe("function");
    // Deprecated alias kept one major cycle.
    expect(Client).toBe(WaterXClient);
    expect(typeof perp).toBe("object");
    expect(typeof prediction).toBe("object");
    // The perp sub-client is reachable flat (`perp.PerpClient`).
    expect(perp.PerpClient).toBe(PerpClient);
    expect(typeof prediction.buildPlaceOrderTx).toBe("function");
    expect(typeof prediction.buildBatchClaimTx).toBe("function");
  });
});

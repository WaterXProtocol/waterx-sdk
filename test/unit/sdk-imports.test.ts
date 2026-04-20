import {
  buildClaimRewardDistributorTx,
  buildDepositCollateralTx,
  buildMintAndStakeWlpTx,
  buildStakeRewardDistributorTx,
  buildUnstakeAndRequestRedeemWlpTx,
  calculateRewardDistributorApr,
  calculateRewardDistributorIncentive,
  claimRewardDistributor,
  decreasePosition,
  getPoolSummary,
  increasePosition,
  mintWlpCoin,
  redeemRewardDistributorCoin,
  stakeRewardDistributor,
  WaterXClient,
} from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

describe("SDK package wiring", () => {
  it("exports WaterXClient", () => {
    expect(WaterXClient).toBeDefined();
    expect(typeof WaterXClient.testnet).toBe("function");
  });

  it("exports WL-777 helpers (increase/decrease, WLP view via getPoolSummary)", () => {
    expect(typeof increasePosition).toBe("function");
    expect(typeof decreasePosition).toBe("function");
    expect(typeof buildDepositCollateralTx).toBe("function");
    expect(typeof getPoolSummary).toBe("function");
  });

  it("exports reward distributor helpers", () => {
    expect(typeof mintWlpCoin).toBe("function");
    expect(typeof redeemRewardDistributorCoin).toBe("function");
    expect(typeof stakeRewardDistributor).toBe("function");
    expect(typeof claimRewardDistributor).toBe("function");
    expect(typeof buildMintAndStakeWlpTx).toBe("function");
    expect(typeof buildStakeRewardDistributorTx).toBe("function");
    expect(typeof buildClaimRewardDistributorTx).toBe("function");
    expect(typeof buildUnstakeAndRequestRedeemWlpTx).toBe("function");
    expect(typeof calculateRewardDistributorApr).toBe("function");
    expect(typeof calculateRewardDistributorIncentive).toBe("function");
  });
});

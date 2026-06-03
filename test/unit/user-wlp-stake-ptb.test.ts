import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import {
  buildCancelRedeemAndStakeWlpTx,
  buildMintAndStakeWlpTx,
  buildUnstakeAndRequestRedeemWlpTx,
} from "../../src/tx-builders.ts";
import { MOCK_USDC_TYPE } from "../helpers/fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const client = createUnitTestClient();
const accountId = PTB_DUMMY_ACCOUNT_ID;

describe("WLP atomic mint+stake / unstake+redeem / cancel+restake builders (v3)", () => {
  it("buildMintAndStakeWlpTx chains mintWlp -> stake (with auto-settled rewarders)", async () => {
    const tx = await buildMintAndStakeWlpTx(client, {
      accountId,
      depositTicker: "USDCUSD",
      depositTokenType: MOCK_USDC_TYPE,
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
      skipOraclePriceRefresh: true,
      consolidateToUsd: false,
    });
    // mint_wlp + staking::deposit + 1 rewarder settle (mock MOCK_DEEP) + destroy_deposit_checker
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(4);
  });

  it("buildUnstakeAndRequestRedeemWlpTx chains unstake -> request_redeem (with auto-settled rewarders)", async () => {
    const tx = await buildUnstakeAndRequestRedeemWlpTx(client, {
      accountId,
      redeemTokenType: MOCK_USDC_TYPE,
      withdrawalAmount: 500_000n,
      skipOraclePriceRefresh: true,
      consolidateToUsd: false,
    });
    // staking::redeem + 1 rewarder settle + destroy_withdraw_checker + request_redeem
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(4);
  });

  it("buildCancelRedeemAndStakeWlpTx chains cancel_redeem -> stake (with auto-settled rewarders)", () => {
    const tx = buildCancelRedeemAndStakeWlpTx(client, {
      accountId,
      requestId: 1n,
      stakeAmount: 1_000_000n,
    });
    // cancel_redeem + staking::deposit + 1 rewarder settle + destroy_deposit_checker
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(4);
  });

  it("buildMintAndStakeWlpTx accepts a custom stakeAlias", async () => {
    const tx = await buildMintAndStakeWlpTx(client, {
      accountId,
      depositTicker: "USDCUSD",
      depositTokenType: MOCK_USDC_TYPE,
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
      stakeAlias: "WLP",
      skipOraclePriceRefresh: true,
      consolidateToUsd: false,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(4);
  });
});

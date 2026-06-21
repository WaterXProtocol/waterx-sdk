import { toHex } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCancelRedeemAndStakeWlpTx,
  buildClaimRewardsToAccountTx,
  buildMintAndStakeWlpTx,
  buildUnstakeAndRequestRedeemWlpTx,
} from "../../../src/tx-builders.ts";
import { MOCK_USDC_TYPE } from "../helpers/fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const client = createUnitTestClient();
const accountId = PTB_DUMMY_ACCOUNT_ID;
const rewardType = "0x896e53015216c5034825c056bcde37a694263601df2534ae5c91b8a3d9150c78::sui::SUI";
const originalFetch = globalThis.fetch;

function clientWithConfiguredRewarders() {
  const c = createUnitTestClient();
  c.config = {
    ...c.config,
    packages: {
      ...c.config.packages,
      waterx_staking: {
        ...c.config.packages.waterx_staking!,
        rewarders: {
          WLP: {
            SUI: {
              rewarder_id: "0xrewarder",
              coin_type: rewardType,
              decimals: 9,
            },
          },
        },
      },
    },
  };
  return c;
}

describe("WLP atomic mint+stake / unstake+redeem / cancel+restake builders (v3)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });
  it("buildMintAndStakeWlpTx chains mintWlp -> stake with rewarder settlement", async () => {
    const tx = await buildMintAndStakeWlpTx(client, {
      accountId,
      depositTicker: "USDCUSD",
      depositTokenType: MOCK_USDC_TYPE,
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
      rewarderTypes: [rewardType],
      skipOraclePriceRefresh: true,
      consolidateToUsd: false,
    });
    // mint_wlp + staking::deposit + 1 rewarder settle + destroy_deposit_checker
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(4);
  });

  it("buildMintAndStakeWlpTx without rewarderTypes still produces mint + stake calls", async () => {
    const tx = await buildMintAndStakeWlpTx(client, {
      accountId,
      depositTicker: "USDCUSD",
      depositTokenType: MOCK_USDC_TYPE,
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
      skipOraclePriceRefresh: true,
      consolidateToUsd: false,
    });
    // mint_wlp + staking::deposit + destroy_deposit_checker (no rewarder loop on empty rewarders)
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(3);
  });

  it("buildUnstakeAndRequestRedeemWlpTx chains unstake -> request_redeem with rewarder settlement", async () => {
    const tx = await buildUnstakeAndRequestRedeemWlpTx(client, {
      accountId,
      redeemTokenType: MOCK_USDC_TYPE,
      withdrawalAmount: 500_000n,
      rewarderTypes: [rewardType],
      skipOraclePriceRefresh: true,
      consolidateToUsd: false,
    });
    // staking::redeem + 1 rewarder settle + destroy_withdraw_checker + request_redeem
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(4);
  });

  it("buildCancelRedeemAndStakeWlpTx chains cancel_redeem -> stake with rewarder settlement", () => {
    const tx = buildCancelRedeemAndStakeWlpTx(client, {
      accountId,
      requestId: 1n,
      stakeAmount: 1_000_000n,
      rewarderTypes: [rewardType],
    });
    // cancel_redeem + staking::deposit + 1 rewarder settle + destroy_deposit_checker
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(4);
  });

  it("buildMintAndStakeWlpTx refreshes oracles when not skipped", async () => {
    const { attachPythGrpcMocks, mockAccumulatorUpdate } =
      await import("../helpers/fixtures/pyth-mock-grpc.ts");
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ binary: { data: [toHex(mockAccumulatorUpdate())] } }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;
    attachPythGrpcMocks(client);

    const tx = await buildMintAndStakeWlpTx(client, {
      accountId,
      depositTicker: "USDCUSD",
      depositTokenType: MOCK_USDC_TYPE,
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
      rewarderTypes: [rewardType],
      consolidateToUsd: false,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(8);
  });

  it("buildUnstakeAndRequestRedeemWlpTx refreshes oracles when not skipped", async () => {
    const { attachPythGrpcMocks, mockAccumulatorUpdate } =
      await import("../helpers/fixtures/pyth-mock-grpc.ts");
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ binary: { data: [toHex(mockAccumulatorUpdate())] } }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;
    attachPythGrpcMocks(client);

    const tx = await buildUnstakeAndRequestRedeemWlpTx(client, {
      accountId,
      redeemTokenType: MOCK_USDC_TYPE,
      withdrawalAmount: 500_000n,
      rewarderTypes: [rewardType],
      consolidateToUsd: false,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(8);
  });

  it("buildClaimRewardsToAccountTx claims each configured rewarder", () => {
    const tx = buildClaimRewardsToAccountTx(client, {
      accountId,
      rewarderTypes: [rewardType],
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("buildUnstakeAndRequestRedeemWlpTx defaults rewarderTypes from config", async () => {
    const rewarded = clientWithConfiguredRewarders();
    const tx = await buildUnstakeAndRequestRedeemWlpTx(rewarded, {
      accountId,
      redeemTokenType: MOCK_USDC_TYPE,
      withdrawalAmount: 500_000n,
      skipOraclePriceRefresh: true,
      consolidateToUsd: false,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(4);
  });

  it("buildCancelRedeemAndStakeWlpTx defaults rewarderTypes from config", () => {
    const rewarded = clientWithConfiguredRewarders();
    const tx = buildCancelRedeemAndStakeWlpTx(rewarded, {
      accountId,
      requestId: 1n,
      stakeAmount: 1_000_000n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(4);
  });

  it("buildClaimRewardsToAccountTx defaults rewarderTypes from config", () => {
    const rewarded = clientWithConfiguredRewarders();
    const tx = buildClaimRewardsToAccountTx(rewarded, { accountId });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("buildClaimRewardsToAccountTx throws when stake pool has no rewarders", () => {
    expect(() =>
      buildClaimRewardsToAccountTx(client, {
        accountId,
        rewarderTypes: [],
      }),
    ).toThrow(/no rewarders configured/);
  });

  it("buildMintAndStakeWlpTx accepts a custom stakeAlias", async () => {
    const tx = await buildMintAndStakeWlpTx(client, {
      accountId,
      depositTicker: "USDCUSD",
      depositTokenType: MOCK_USDC_TYPE,
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
      stakeAlias: "WLP",
      rewarderTypes: [rewardType],
      skipOraclePriceRefresh: true,
      consolidateToUsd: false,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(4);
  });

  it("buildMintAndStakeWlpTx with oracle refresh", async () => {
    const { attachPythGrpcMocks, mockAccumulatorUpdate } =
      await import("../helpers/fixtures/pyth-mock-grpc.ts");
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ binary: { data: [toHex(mockAccumulatorUpdate())] } }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;

    attachPythGrpcMocks(client);
    const tx = await buildMintAndStakeWlpTx(client, {
      accountId,
      depositTicker: "USDCUSD",
      depositTokenType: MOCK_USDC_TYPE,
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
      rewarderTypes: [rewardType],
      consolidateToUsd: false,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(5);
  });

  it("buildUnstakeAndRequestRedeemWlpTx with oracle refresh", async () => {
    const { attachPythGrpcMocks, mockAccumulatorUpdate } =
      await import("../helpers/fixtures/pyth-mock-grpc.ts");
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ binary: { data: [toHex(mockAccumulatorUpdate())] } }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;

    attachPythGrpcMocks(client);
    const tx = await buildUnstakeAndRequestRedeemWlpTx(client, {
      accountId,
      redeemTokenType: MOCK_USDC_TYPE,
      withdrawalAmount: 500_000n,
      rewarderTypes: [rewardType],
      consolidateToUsd: false,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(5);
  });
});

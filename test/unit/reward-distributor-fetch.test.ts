import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestnetConfig, WaterXClient } from "../../src/client.ts";
import { TESTNET_PACKAGE_IDS, TESTNET_TYPES } from "../../src/constants.ts";
import {
  calculateRewardDistributorApr,
  calculateRewardDistributorIncentive,
  getRewardDistributorStakeData,
} from "../../src/fetch.ts";
import { Double as RewardDistributorDoubleBcs } from "../../src/generated/reward_distributor/deps/bucket_v2_framework/double.ts";
import { StakeDataDisplay as RewardDistributorStakeDataBcs } from "../../src/generated/reward_distributor/reward_distributor.ts";
import { PoolData as PoolDataBcs } from "../../src/generated/waterx_perp/view.ts";
import { mockSuiAddress } from "../helpers/sui-mock-fixtures.ts";

const DOUBLE_SCALE = 1_000_000_000_000_000_000n;

function getFirstMoveCall(tx: Transaction) {
  const moveCall = tx
    .getData()
    .commands?.find(
      (command): command is { $kind: "MoveCall"; MoveCall: any } => command.$kind === "MoveCall",
    );
  return moveCall?.MoveCall;
}

function getMoveCallFunctions(tx: Transaction) {
  return tx
    .getData()
    .commands?.flatMap((command) =>
      command.$kind === "MoveCall" ? [command.MoveCall.function] : [],
    );
}

describe("reward distributor fetch helpers", () => {
  const account = mockSuiAddress("ab");

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calculateRewardDistributorIncentive parses u64 and uses default reward config", async () => {
    const client = WaterXClient.testnet();
    const simulate = vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [
        {
          returnValues: [
            {
              bcs: Uint8Array.from(bcs.u64().serialize(321n).toBytes()),
            },
          ],
        },
      ],
    } as any);

    await expect(
      calculateRewardDistributorIncentive(client, {
        account,
        stakeTokenType: TESTNET_TYPES.WLP,
      }),
    ).resolves.toBe(321n);

    const tx = simulate.mock.calls[0]?.[0] as Transaction;
    const moveCall = getFirstMoveCall(tx);
    expect(moveCall?.package).toBe(TESTNET_PACKAGE_IDS.REWARD_DISTRIBUTOR);
    expect(moveCall?.function).toBe("realtime_reward_amount");
    expect(moveCall?.typeArguments).toEqual([TESTNET_TYPES.WLP, TESTNET_TYPES.SUI]);
  });

  it("getRewardDistributorStakeData parses StakeDataDisplay into bigint fields", async () => {
    const client = WaterXClient.testnet();
    const simulate = vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [
        {
          returnValues: [
            {
              bcs: Uint8Array.from(
                RewardDistributorStakeDataBcs.serialize({
                  stake_coin_type: TESTNET_TYPES.WLP,
                  reward_coin_type: TESTNET_TYPES.SUI,
                  stake_amount: 100n,
                  claimable_reward_amount: 7n,
                  cumulative_reward_amount: 88n,
                }).toBytes(),
              ),
            },
          ],
        },
      ],
    } as any);

    await expect(
      getRewardDistributorStakeData(client, {
        account,
        stakeTokenType: TESTNET_TYPES.WLP,
      }),
    ).resolves.toEqual({
      stakeCoinType: TESTNET_TYPES.WLP,
      rewardCoinType: TESTNET_TYPES.SUI,
      stakeAmount: 100n,
      claimableRewardAmount: 7n,
      cumulativeRewardAmount: 88n,
    });

    const tx = simulate.mock.calls[0]?.[0] as Transaction;
    const moveCall = getFirstMoveCall(tx);
    expect(moveCall?.package).toBe(TESTNET_PACKAGE_IDS.REWARD_DISTRIBUTOR);
    expect(moveCall?.function).toBe("get_stake_data");
    expect(moveCall?.typeArguments).toEqual([TESTNET_TYPES.WLP, TESTNET_TYPES.SUI]);
  });

  it("calculateRewardDistributorApr derives WLP price from pool summary", async () => {
    const client = WaterXClient.testnet();
    const totalStakeAmount = 100_000_000_000n;
    const rewardFlowRate = DOUBLE_SCALE;
    const simulate = vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [
        {
          returnValues: [
            {
              bcs: Uint8Array.from(
                RewardDistributorDoubleBcs.serialize({
                  value: rewardFlowRate,
                }).toBytes(),
              ),
            },
          ],
        },
        {
          returnValues: [
            {
              bcs: Uint8Array.from(bcs.u64().serialize(totalStakeAmount).toBytes()),
            },
          ],
        },
        {
          returnValues: [
            {
              bcs: Uint8Array.from(
                PoolDataBcs.serialize({
                  lp_token: { name: "0x0::wlp::WLP" },
                  is_active: true,
                  lp_decimal: 9,
                  total_lp_supply: totalStakeAmount,
                  tvl_usd: 200_000_000_000n,
                  token_count: 1n,
                }).toBytes(),
              ),
            },
          ],
        },
      ],
    } as any);

    const quote = await calculateRewardDistributorApr(client, {
      stakeTokenType: TESTNET_TYPES.WLP,
      rewardTokenType: TESTNET_TYPES.SUI,
      rewardTokenPriceUsd: 0.5,
      rewardTokenDecimals: 9,
    });

    expect(quote).toMatchObject({
      stakeCoinType: TESTNET_TYPES.WLP,
      rewardCoinType: TESTNET_TYPES.SUI,
      totalStakeAmount,
      rewardFlowRate,
      annualRewardAmount: 31_536_000_000n,
      stakeTokenPriceUsd: 2,
      stakeTokenDecimals: 9,
      stakePriceSource: "wlp_pool",
      rewardAprBps: 788n,
    });
    expect(quote.annualRewardValueUsd).toBeCloseTo(15.768, 9);
    expect(quote.totalStakedValueUsd).toBeCloseTo(200, 9);
    expect(quote.rewardApr).toBeCloseTo(7.88, 9);

    const tx = simulate.mock.calls[0]?.[0] as Transaction;
    expect(getMoveCallFunctions(tx)).toEqual([
      "rewarder_flow_rate",
      "total_stake_amount",
      "pool_data",
    ]);
  });

  it("calculateRewardDistributorApr uses explicit stake pricing for non-WLP assets", async () => {
    const client = WaterXClient.testnet();
    const stakeTokenType = "0x123::stake::STAKE";
    const totalStakeAmount = 50_000_000n;
    const rewardFlowRate = 2n * DOUBLE_SCALE;
    const simulate = vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [
        {
          returnValues: [
            {
              bcs: Uint8Array.from(
                RewardDistributorDoubleBcs.serialize({
                  value: rewardFlowRate,
                }).toBytes(),
              ),
            },
          ],
        },
        {
          returnValues: [
            {
              bcs: Uint8Array.from(bcs.u64().serialize(totalStakeAmount).toBytes()),
            },
          ],
        },
      ],
    } as any);

    const quote = await calculateRewardDistributorApr(client, {
      stakeTokenType,
      rewardTokenType: TESTNET_TYPES.SUI,
      rewardTokenPriceUsd: 1.1,
      rewardTokenDecimals: 8,
      stakeTokenPriceUsd: 3.2,
      stakeTokenDecimals: 6,
    });

    expect(quote).toMatchObject({
      stakeCoinType: stakeTokenType,
      rewardCoinType: TESTNET_TYPES.SUI,
      totalStakeAmount,
      rewardFlowRate,
      annualRewardAmount: 63_072_000_000n,
      stakeTokenPriceUsd: 3.2,
      stakeTokenDecimals: 6,
      stakePriceSource: "params",
      rewardAprBps: 43_362n,
    });
    expect(quote.annualRewardValueUsd).toBeCloseTo(693.792, 9);
    expect(quote.totalStakedValueUsd).toBeCloseTo(160, 9);
    expect(quote.rewardApr).toBeCloseTo(433.62, 9);

    const tx = simulate.mock.calls[0]?.[0] as Transaction;
    expect(getMoveCallFunctions(tx)).toEqual(["rewarder_flow_rate", "total_stake_amount"]);
  });

  it("calculateRewardDistributorApr returns zero reward APR when there is no stake", async () => {
    const client = WaterXClient.testnet();
    const simulate = vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [
        {
          returnValues: [
            {
              bcs: Uint8Array.from(
                RewardDistributorDoubleBcs.serialize({
                  value: 5n * DOUBLE_SCALE,
                }).toBytes(),
              ),
            },
          ],
        },
        {
          returnValues: [
            {
              bcs: Uint8Array.from(bcs.u64().serialize(0n).toBytes()),
            },
          ],
        },
      ],
    } as any);

    const quote = await calculateRewardDistributorApr(client, {
      stakeTokenType: TESTNET_TYPES.WLP,
      rewardTokenType: TESTNET_TYPES.SUI,
      rewardTokenPriceUsd: 1,
      rewardTokenDecimals: 9,
      stakeTokenPriceUsd: 2,
      stakeTokenDecimals: 9,
    });

    expect(quote.rewardAprBps).toBe(0n);
    expect(quote.totalStakedValueUsd).toBe(0);

    const tx = simulate.mock.calls[0]?.[0] as Transaction;
    expect(getMoveCallFunctions(tx)).toEqual(["rewarder_flow_rate", "total_stake_amount"]);
  });

  it("throws when reward token type is missing from both params and client config", async () => {
    const client = new WaterXClient({
      ...createTestnetConfig(),
      rewardDistributorRewardTokenTypes: undefined,
    });

    await expect(
      calculateRewardDistributorIncentive(client, {
        account,
        stakeTokenType: TESTNET_TYPES.WLP,
      }),
    ).rejects.toThrow(/Reward token type is required/);
  });

  it("throws when stake pricing is missing for non-WLP stake tokens", async () => {
    const client = WaterXClient.testnet();

    await expect(
      calculateRewardDistributorApr(client, {
        stakeTokenType: "0x123::stake::STAKE",
        rewardTokenType: TESTNET_TYPES.SUI,
        rewardTokenPriceUsd: 1,
        rewardTokenDecimals: 9,
      }),
    ).rejects.toThrow(/Stake token USD price is required/);
  });
});

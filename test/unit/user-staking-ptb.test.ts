import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { claimReward, stake, unstake } from "../../src/user/staking.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const client = createUnitTestClient();
const accountId = PTB_DUMMY_ACCOUNT_ID;
const stakeType = client.wlpType();
const rewardType = "0x896e53015216c5034825c056bcde37a694263601df2534ae5c91b8a3d9150c78::sui::SUI";

describe("user/staking PTB builders (v3)", () => {
  it("stake settles every rewarder configured for the pool", () => {
    const tx = new Transaction();
    stake(client, tx, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      stakeAmount: 1_000_000n,
    });
    // deposit + 1 rewarder settle (mock config declares MOCK_DEEP) + destroy_deposit_checker
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(3);
  });

  it("unstake settles every rewarder configured for the pool", () => {
    const tx = new Transaction();
    unstake(client, tx, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      withdrawalAmount: 500_000n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(3);
  });

  it("stake / unstake on a pool with no configured rewarders skip the settle loop", () => {
    const bare = createUnitTestClient();
    const stakingCfg = structuredClone(bare.config.packages.waterx_staking!);
    stakingCfg.rewarders = {};
    bare.config = {
      ...bare.config,
      packages: { ...bare.config.packages, waterx_staking: stakingCfg },
    };

    const stakeWithRewarder = new Transaction();
    stake(client, stakeWithRewarder, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      stakeAmount: 1_000_000n,
    });
    const stakeWithoutRewarder = new Transaction();
    stake(bare, stakeWithoutRewarder, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      stakeAmount: 1_000_000n,
    });
    expect(stakeWithoutRewarder.getData().commands!.length).toBeLessThan(
      stakeWithRewarder.getData().commands!.length,
    );

    const unstakeWithRewarder = new Transaction();
    unstake(client, unstakeWithRewarder, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      withdrawalAmount: 500_000n,
    });
    const unstakeWithoutRewarder = new Transaction();
    unstake(bare, unstakeWithoutRewarder, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      withdrawalAmount: 500_000n,
    });
    expect(unstakeWithoutRewarder.getData().commands!.length).toBeLessThan(
      unstakeWithRewarder.getData().commands!.length,
    );
  });

  it("claimReward", () => {
    const tx = new Transaction();
    claimReward(client, tx, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      rewardType,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("throws when staking pool alias missing", () => {
    const bare = createUnitTestClient();
    const stakingCfg = structuredClone(bare.config.packages.waterx_staking!);
    delete stakingCfg.pools!.WLP;
    bare.config = {
      ...bare.config,
      packages: { ...bare.config.packages, waterx_staking: stakingCfg },
    };
    const tx = new Transaction();
    expect(() =>
      stake(bare, tx, { accountId, stakeAlias: "WLP", stakeType, stakeAmount: 1n }),
    ).toThrow(/not set/);
  });

  it("throws when waterx_staking package is not configured", () => {
    const bare = createUnitTestClient();
    delete (bare.config.packages as { waterx_staking?: unknown }).waterx_staking;
    const tx = new Transaction();
    expect(() =>
      stake(bare, tx, { accountId, stakeAlias: "WLP", stakeType, stakeAmount: 1n }),
    ).toThrow(/waterx_staking is not configured/);
  });
});

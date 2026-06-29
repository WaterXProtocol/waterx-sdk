import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { claimReward, stake, unstake } from "../../../src/perp/user/staking.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const client = createUnitTestClient();
const accountId = PTB_DUMMY_ACCOUNT_ID;
const stakeType = client.wlpType();
const rewardType = "0x896e53015216c5034825c056bcde37a694263601df2534ae5c91b8a3d9150c78::sui::SUI";

describe("user/staking PTB builders (v3)", () => {
  it("stake with rewarder settlement", () => {
    const tx = new Transaction();
    stake(client, tx, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      stakeAmount: 1_000_000n,
      rewarderTypes: [rewardType],
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(3);
  });

  it("unstake with rewarder settlement", () => {
    const tx = new Transaction();
    unstake(client, tx, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      withdrawalAmount: 500_000n,
      rewarderTypes: [rewardType],
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(3);
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

  it("stake and unstake without rewarderTypes skip settlement loops", () => {
    const withRewarder = new Transaction();
    stake(client, withRewarder, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      stakeAmount: 1_000_000n,
      rewarderTypes: [rewardType],
    });
    const withoutRewarder = new Transaction();
    stake(client, withoutRewarder, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      stakeAmount: 1_000_000n,
    });
    expect(withoutRewarder.getData().commands!.length).toBeLessThan(
      withRewarder.getData().commands!.length,
    );

    const unstakeWith = new Transaction();
    unstake(client, unstakeWith, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      withdrawalAmount: 500_000n,
      rewarderTypes: [rewardType],
    });
    const unstakeWithout = new Transaction();
    unstake(client, unstakeWithout, {
      accountId,
      stakeAlias: "WLP",
      stakeType,
      withdrawalAmount: 500_000n,
    });
    expect(unstakeWithout.getData().commands!.length).toBeLessThan(
      unstakeWith.getData().commands!.length,
    );
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

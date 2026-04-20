import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { createTestnetConfig, WaterXClient } from "../../src/client.ts";
import { TESTNET_PACKAGE_IDS, TESTNET_TYPES } from "../../src/constants.ts";
import {
  claimRewardDistributor,
  redeemRewardDistributorCoin,
  stakeRewardDistributor,
  unstakeRewardDistributor,
} from "../../src/user/reward-distributor.ts";
import {
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_COIN_CC,
  PTB_DUMMY_DEPOSIT_COIN,
  PTB_DUMMY_OBJECT_DD,
} from "../helpers/ptb-test-dummies.ts";

function getMoveCalls(tx: Transaction) {
  return (tx.getData().commands ?? [])
    .filter(
      (command): command is { $kind: "MoveCall"; MoveCall: any } => command.$kind === "MoveCall",
    )
    .map((command) => command.MoveCall);
}

function getCommandKinds(tx: Transaction) {
  return (tx.getData().commands ?? []).map((command) => command.$kind);
}

function createClientWithConfig(overrides: Partial<ReturnType<typeof createTestnetConfig>> = {}) {
  return new WaterXClient({
    ...createTestnetConfig(),
    ...overrides,
  });
}

describe("user/reward-distributor PTB builders", () => {
  it("stakeRewardDistributor uses testnet defaults and settles the default rewarder", () => {
    const client = WaterXClient.testnet();
    const tx = new Transaction();

    stakeRewardDistributor(client, tx, {
      stakeTokenType: TESTNET_TYPES.WLP,
      stakeCoin: PTB_DUMMY_COIN_CC,
    });

    const moveCalls = getMoveCalls(tx);
    expect(moveCalls).toHaveLength(4);
    expect(moveCalls.map((call) => `${call.module}::${call.function}`)).toEqual([
      "account::request",
      "reward_distributor::deposit",
      "reward_distributor::settle_rewarder_on_deposit",
      "reward_distributor::destroy_deposit_checker",
    ]);
    expect(moveCalls.map((call) => call.package)).toEqual([
      TESTNET_PACKAGE_IDS.BUCKET_FRAMEWORK,
      TESTNET_PACKAGE_IDS.REWARD_DISTRIBUTOR,
      TESTNET_PACKAGE_IDS.REWARD_DISTRIBUTOR,
      TESTNET_PACKAGE_IDS.REWARD_DISTRIBUTOR,
    ]);
    expect(moveCalls[2]?.typeArguments).toEqual([TESTNET_TYPES.WLP, TESTNET_TYPES.SUI]);
  });

  it("stakeRewardDistributor accepts TransactionArgument stakeCoin and de-dupes reward token types", () => {
    const client = WaterXClient.testnet();
    const tx = new Transaction();
    const stakeCoin = tx.object(PTB_DUMMY_OBJECT_DD);

    stakeRewardDistributor(client, tx, {
      stakeTokenType: TESTNET_TYPES.WLP,
      stakeCoin,
      rewardTokenTypes: [TESTNET_TYPES.SUI, TESTNET_TYPES.USDC, TESTNET_TYPES.SUI],
    });

    const moveCalls = getMoveCalls(tx);
    expect(moveCalls.map((call) => `${call.module}::${call.function}`)).toEqual([
      "account::request",
      "reward_distributor::deposit",
      "reward_distributor::settle_rewarder_on_deposit",
      "reward_distributor::settle_rewarder_on_deposit",
      "reward_distributor::destroy_deposit_checker",
    ]);
    expect(moveCalls[2]?.typeArguments).toEqual([TESTNET_TYPES.WLP, TESTNET_TYPES.SUI]);
    expect(moveCalls[3]?.typeArguments).toEqual([TESTNET_TYPES.WLP, TESTNET_TYPES.USDC]);
  });

  it("unstakeRewardDistributor redeems immediately, settles rewarders, and transfers the stake coin", () => {
    const client = WaterXClient.testnet();
    const tx = new Transaction();
    tx.setSender(PTB_DUMMY_ACCOUNT_ID);

    unstakeRewardDistributor(client, tx, {
      stakeTokenType: TESTNET_TYPES.WLP,
      withdrawalAmount: 42n,
      rewardTokenTypes: [TESTNET_TYPES.SUI, TESTNET_TYPES.USDC, TESTNET_TYPES.SUI],
    });

    const moveCalls = getMoveCalls(tx);
    expect(moveCalls).toHaveLength(5);
    expect(moveCalls.map((call) => `${call.module}::${call.function}`)).toEqual([
      "account::request",
      "reward_distributor::redeem",
      "reward_distributor::settle_rewarder_on_withdraw",
      "reward_distributor::settle_rewarder_on_withdraw",
      "reward_distributor::destroy_withdraw_checker",
    ]);
    expect(moveCalls[0]?.package).toBe(TESTNET_PACKAGE_IDS.BUCKET_FRAMEWORK);
    expect(moveCalls[1]?.package).toBe(TESTNET_PACKAGE_IDS.REWARD_DISTRIBUTOR);
    expect(moveCalls[1]?.typeArguments).toEqual([TESTNET_TYPES.WLP]);
    expect(moveCalls[2]?.typeArguments).toEqual([TESTNET_TYPES.WLP, TESTNET_TYPES.SUI]);
    expect(moveCalls[3]?.typeArguments).toEqual([TESTNET_TYPES.WLP, TESTNET_TYPES.USDC]);
    expect(getCommandKinds(tx)).toEqual([
      "MoveCall",
      "MoveCall",
      "MoveCall",
      "MoveCall",
      "MoveCall",
      "TransferObjects",
    ]);
  });

  it("redeemRewardDistributorCoin leaves the redeemed coin inside the PTB", () => {
    const client = WaterXClient.testnet();
    const tx = new Transaction();

    const stakeCoin = redeemRewardDistributorCoin(client, tx, {
      stakeTokenType: TESTNET_TYPES.WLP,
      withdrawalAmount: 42n,
      rewardTokenTypes: [TESTNET_TYPES.SUI, TESTNET_TYPES.USDC],
    });

    expect(stakeCoin).toBeDefined();
    expect(getCommandKinds(tx)).toEqual([
      "MoveCall",
      "MoveCall",
      "MoveCall",
      "MoveCall",
      "MoveCall",
    ]);
  });

  it("claimRewardDistributor creates AccountRequest, claims reward, and transfers the reward coin", () => {
    const client = WaterXClient.testnet();
    const tx = new Transaction();
    tx.setSender(PTB_DUMMY_ACCOUNT_ID);

    claimRewardDistributor(client, tx, {
      stakeTokenType: TESTNET_TYPES.WLP,
    });

    const moveCalls = getMoveCalls(tx);
    expect(moveCalls).toHaveLength(2);
    expect(moveCalls.map((call) => `${call.module}::${call.function}`)).toEqual([
      "account::request",
      "reward_distributor::claim",
    ]);
    expect(moveCalls[1]?.typeArguments).toEqual([TESTNET_TYPES.WLP, TESTNET_TYPES.SUI]);
    expect(getCommandKinds(tx)).toEqual(["MoveCall", "MoveCall", "TransferObjects"]);
  });

  it("throws when reward distributor package id is missing", () => {
    const client = createClientWithConfig({ rewardDistributorPackageId: undefined });
    const tx = new Transaction();

    expect(() =>
      stakeRewardDistributor(client, tx, {
        stakeTokenType: TESTNET_TYPES.WLP,
        stakeCoin: PTB_DUMMY_COIN_CC,
      }),
    ).toThrow(/Reward distributor package ID is required/);
  });

  it("throws when reward distributor id is missing", () => {
    const client = createClientWithConfig({ rewardDistributorId: undefined });
    const tx = new Transaction();
    tx.setSender(PTB_DUMMY_ACCOUNT_ID);

    expect(() =>
      unstakeRewardDistributor(client, tx, {
        stakeTokenType: TESTNET_TYPES.WLP,
        withdrawalAmount: 1n,
        recipient: PTB_DUMMY_ACCOUNT_ID,
      }),
    ).toThrow(/Reward distributor ID is required/);
  });

  it("throws when reward token type is missing for claim", () => {
    const client = createClientWithConfig({ rewardDistributorRewardTokenTypes: undefined });
    const tx = new Transaction();

    expect(() =>
      claimRewardDistributor(client, tx, {
        stakeTokenType: TESTNET_TYPES.WLP,
        recipient: PTB_DUMMY_ACCOUNT_ID,
      }),
    ).toThrow(/Reward token type is required/);
  });

  it("throws when unstake recipient is missing and tx sender is unset", () => {
    const client = WaterXClient.testnet();
    const tx = new Transaction();

    expect(() =>
      unstakeRewardDistributor(client, tx, {
        stakeTokenType: TESTNET_TYPES.WLP,
        withdrawalAmount: 1_000n,
      }),
    ).toThrow(/Recipient address is required/);
  });

  it("throws when claim recipient is missing and tx sender is unset", () => {
    const client = WaterXClient.testnet();
    const tx = new Transaction();

    expect(() =>
      claimRewardDistributor(client, tx, {
        stakeTokenType: TESTNET_TYPES.WLP,
      }),
    ).toThrow(/Recipient address is required/);
  });

  it("unstakeRewardDistributor accepts an explicit recipient without tx sender", () => {
    const client = WaterXClient.testnet();
    const tx = new Transaction();

    unstakeRewardDistributor(client, tx, {
      stakeTokenType: TESTNET_TYPES.WLP,
      withdrawalAmount: 1_000n,
      recipient: PTB_DUMMY_DEPOSIT_COIN,
    });

    expect(getCommandKinds(tx)).toContain("TransferObjects");
  });
});

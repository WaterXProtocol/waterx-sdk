import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it, vi } from "vitest";

import { WaterXClient } from "../../src/client.ts";
import { TESTNET_TYPES } from "../../src/constants.ts";
import {
  buildClaimRewardDistributorTx,
  buildStakeRewardDistributorTx,
  buildUnstakeRewardDistributorTx,
} from "../../src/tx-builders.ts";
import {
  claimRewardDistributor,
  stakeRewardDistributor,
  unstakeRewardDistributor,
} from "../../src/user/index.ts";
import { PTB_DUMMY_ACCOUNT_ID, PTB_DUMMY_COIN_CC } from "../helpers/ptb-test-dummies.ts";

vi.mock("../../src/user/index.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/user/index.ts")>();
  return {
    ...actual,
    stakeRewardDistributor: vi.fn((...args: Parameters<typeof actual.stakeRewardDistributor>) =>
      actual.stakeRewardDistributor(...args),
    ),
    unstakeRewardDistributor: vi.fn((...args: Parameters<typeof actual.unstakeRewardDistributor>) =>
      actual.unstakeRewardDistributor(...args),
    ),
    claimRewardDistributor: vi.fn((...args: Parameters<typeof actual.claimRewardDistributor>) =>
      actual.claimRewardDistributor(...args),
    ),
  };
});

describe("reward distributor tx builders", () => {
  const client = WaterXClient.testnet();

  it("buildStakeRewardDistributorTx forwards params and applies the default gas budget", () => {
    vi.mocked(stakeRewardDistributor).mockClear();

    const tx = buildStakeRewardDistributorTx(client, {
      stakeTokenType: TESTNET_TYPES.WLP,
      stakeCoin: PTB_DUMMY_COIN_CC,
      rewardTokenTypes: [TESTNET_TYPES.SUI],
    });

    expect(tx).toBeInstanceOf(Transaction);
    expect(tx.getData().gasData.budget).toBe("100000000");
    expect(vi.mocked(stakeRewardDistributor)).toHaveBeenCalledWith(client, tx, {
      distributorId: undefined,
      stakeTokenType: TESTNET_TYPES.WLP,
      stakeCoin: PTB_DUMMY_COIN_CC,
      account: undefined,
      rewardTokenTypes: [TESTNET_TYPES.SUI],
      packageId: undefined,
    });
  });

  it("buildUnstakeRewardDistributorTx forwards params and applies the default gas budget", () => {
    vi.mocked(unstakeRewardDistributor).mockClear();

    const tx = buildUnstakeRewardDistributorTx(client, {
      stakeTokenType: TESTNET_TYPES.WLP,
      withdrawalAmount: 50n,
      rewardTokenTypes: [TESTNET_TYPES.SUI],
      recipient: PTB_DUMMY_ACCOUNT_ID,
    });

    expect(tx.getData().gasData.budget).toBe("50000000");
    expect(vi.mocked(unstakeRewardDistributor)).toHaveBeenCalledWith(client, tx, {
      distributorId: undefined,
      stakeTokenType: TESTNET_TYPES.WLP,
      withdrawalAmount: 50n,
      rewardTokenTypes: [TESTNET_TYPES.SUI],
      recipient: PTB_DUMMY_ACCOUNT_ID,
      packageId: undefined,
    });
  });

  it("buildClaimRewardDistributorTx forwards params and applies the default gas budget", () => {
    vi.mocked(claimRewardDistributor).mockClear();

    const tx = buildClaimRewardDistributorTx(client, {
      stakeTokenType: TESTNET_TYPES.WLP,
      recipient: PTB_DUMMY_ACCOUNT_ID,
    });

    expect(tx.getData().gasData.budget).toBe("50000000");
    expect(vi.mocked(claimRewardDistributor)).toHaveBeenCalledWith(client, tx, {
      distributorId: undefined,
      stakeTokenType: TESTNET_TYPES.WLP,
      rewardTokenType: undefined,
      recipient: PTB_DUMMY_ACCOUNT_ID,
      packageId: undefined,
    });
  });
});

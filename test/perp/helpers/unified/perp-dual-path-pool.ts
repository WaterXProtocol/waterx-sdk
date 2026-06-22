import { claimReward, stake, unstake } from "../../../../src/user/staking.ts";
import {
  cancelRedeemWlp,
  mintWlp,
  requestRedeemWlp,
  settleRedeemWlp,
  updateTokenValue,
} from "../../../../src/user/wlp.ts";
import {
  ACCOUNT_ID,
  caseMutate,
  COLLATERAL_TYPE,
  REWARD_TYPE,
  WLP_TYPE,
  type PerpDualPathCase,
} from "./perp-dual-path-shared.ts";

export const perpPoolDualPathCases: PerpDualPathCase[] = [
  caseMutate(
    "stake",
    (c, tx) => {
      stake(c, tx, {
        accountId: ACCOUNT_ID,
        stakeAlias: "WLP",
        stakeType: c.wlpType(),
        stakeAmount: 1_000_000n,
        rewarderTypes: [REWARD_TYPE],
      });
    },
    (p, tx) => {
      p.stake(tx, {
        accountId: ACCOUNT_ID,
        stakeAlias: "WLP",
        stakeType: WLP_TYPE,
        stakeAmount: 1_000_000n,
        rewarderTypes: [REWARD_TYPE],
      });
    },
  ),
  caseMutate(
    "unstake",
    (c, tx) => {
      unstake(c, tx, {
        accountId: ACCOUNT_ID,
        stakeAlias: "WLP",
        stakeType: c.wlpType(),
        withdrawalAmount: 500_000n,
        rewarderTypes: [REWARD_TYPE],
      });
    },
    (p, tx) => {
      p.unstake(tx, {
        accountId: ACCOUNT_ID,
        stakeAlias: "WLP",
        stakeType: WLP_TYPE,
        withdrawalAmount: 500_000n,
        rewarderTypes: [REWARD_TYPE],
      });
    },
  ),
  caseMutate(
    "claimReward",
    (c, tx) => {
      claimReward(c, tx, {
        accountId: ACCOUNT_ID,
        stakeAlias: "WLP",
        stakeType: c.wlpType(),
        rewardType: REWARD_TYPE,
      });
    },
    (p, tx) => {
      p.claimReward(tx, {
        accountId: ACCOUNT_ID,
        stakeAlias: "WLP",
        stakeType: WLP_TYPE,
        rewardType: REWARD_TYPE,
      });
    },
  ),
  caseMutate(
    "mintWlp",
    (c, tx) => {
      mintWlp(c, tx, {
        accountId: ACCOUNT_ID,
        depositTokenType: COLLATERAL_TYPE,
        depositAmount: 10_000_000n,
        minLpAmount: 0n,
      });
    },
    (p, tx) => {
      p.mintWlp(tx, {
        accountId: ACCOUNT_ID,
        depositTokenType: COLLATERAL_TYPE,
        depositAmount: 10_000_000n,
        minLpAmount: 0n,
      });
    },
  ),
  caseMutate(
    "requestRedeemWlp",
    (c, tx) => {
      requestRedeemWlp(c, tx, {
        accountId: ACCOUNT_ID,
        redeemTokenType: COLLATERAL_TYPE,
        lpAmount: 1_000_000n,
      });
    },
    (p, tx) => {
      p.requestRedeemWlp(tx, {
        accountId: ACCOUNT_ID,
        redeemTokenType: COLLATERAL_TYPE,
        lpAmount: 1_000_000n,
      });
    },
  ),
  caseMutate(
    "cancelRedeemWlp",
    (c, tx) => cancelRedeemWlp(c, tx, { requestId: 1n }),
    (p, tx) => p.cancelRedeemWlp(tx, { requestId: 1n }),
  ),
  caseMutate(
    "settleRedeemWlp",
    (c, tx) => settleRedeemWlp(c, tx, { redeemTokenType: COLLATERAL_TYPE, requestId: 1n }),
    (p, tx) => p.settleRedeemWlp(tx, { redeemTokenType: COLLATERAL_TYPE, requestId: 1n }),
  ),
  caseMutate(
    "updateTokenValue",
    (c, tx) => updateTokenValue(c, tx, { tokenType: COLLATERAL_TYPE }),
    (p, tx) => p.updateTokenValue(tx, { tokenType: COLLATERAL_TYPE }),
  ),
];

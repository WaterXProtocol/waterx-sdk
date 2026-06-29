import {
  addDelegate,
  createAccount,
  receive,
  removeDelegate,
  requestDeposit,
  requestDepositFromFunds,
  requestDepositFromReceivings,
  requestWithdraw,
  setAlias,
  setDelegateProtocolPermission,
  transferToAccount,
} from "../../../../src/account/account.ts";
import { setReferralCode, useReferralCode } from "../../../../src/account/referral.ts";
import { PERM_ALL_TRADING } from "../../../../src/perp/constants.ts";
import { PTB_DUMMY_DEPOSIT_COIN } from "../fixtures/ptb-test-dummies.ts";
import {
  ACCOUNT_ID,
  caseMutate,
  COLLATERAL_TYPE,
  PERP_PROTOCOL_TYPE,
  receivingRef,
  type PerpDualPathCase,
} from "./perp-dual-path-shared.ts";

export const perpAccountDualPathCases: PerpDualPathCase[] = [
  caseMutate(
    "createAccount",
    (c, tx) => createAccount(c, tx, { alias: "dual-path" }),
    (p, tx) => p.account.createAccount(tx, { alias: "dual-path" }),
  ),
  caseMutate(
    "setAlias",
    (c, tx) => setAlias(c, tx, { accountId: ACCOUNT_ID, alias: "renamed" }),
    (p, tx) => p.account.setAlias(tx, { accountId: ACCOUNT_ID, alias: "renamed" }),
  ),
  caseMutate(
    "addDelegate",
    (c, tx) =>
      addDelegate(c, tx, {
        accountId: ACCOUNT_ID,
        delegateAddress: PTB_DUMMY_DEPOSIT_COIN,
        alias: "bot",
        permissions: PERM_ALL_TRADING,
      }),
    (p, tx) =>
      p.account.addDelegate(tx, {
        accountId: ACCOUNT_ID,
        delegateAddress: PTB_DUMMY_DEPOSIT_COIN,
        alias: "bot",
        permissions: PERM_ALL_TRADING,
      }),
  ),
  caseMutate(
    "removeDelegate",
    (c, tx) =>
      removeDelegate(c, tx, { accountId: ACCOUNT_ID, delegateAddress: PTB_DUMMY_DEPOSIT_COIN }),
    (p, tx) =>
      p.account.removeDelegate(tx, {
        accountId: ACCOUNT_ID,
        delegateAddress: PTB_DUMMY_DEPOSIT_COIN,
      }),
  ),
  caseMutate(
    "setDelegateProtocolPermission",
    (c, tx) =>
      setDelegateProtocolPermission(c, tx, {
        accountId: ACCOUNT_ID,
        delegateAddress: PTB_DUMMY_DEPOSIT_COIN,
        protocolType: PERP_PROTOCOL_TYPE,
        permissions: PERM_ALL_TRADING,
      }),
    (p, tx) =>
      p.account.setDelegateProtocolPermission(tx, {
        accountId: ACCOUNT_ID,
        delegateAddress: PTB_DUMMY_DEPOSIT_COIN,
        protocolType: PERP_PROTOCOL_TYPE,
        permissions: PERM_ALL_TRADING,
      }),
  ),
  caseMutate(
    "requestDeposit",
    (c, tx) => {
      requestDeposit(c, tx, {
        accountId: ACCOUNT_ID,
        coinType: COLLATERAL_TYPE,
        coin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      });
    },
    (p, tx) => {
      p.account.requestDeposit(tx, {
        accountId: ACCOUNT_ID,
        coinType: COLLATERAL_TYPE,
        coin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      });
    },
  ),
  caseMutate(
    "requestDepositFromReceivings",
    (c, tx) => {
      requestDepositFromReceivings(c, tx, {
        accountId: ACCOUNT_ID,
        coinType: COLLATERAL_TYPE,
        receivings: [receivingRef(tx)],
      });
    },
    (p, tx) => {
      p.account.requestDepositFromReceivings(tx, {
        accountId: ACCOUNT_ID,
        coinType: COLLATERAL_TYPE,
        receivings: [receivingRef(tx)],
      });
    },
  ),
  caseMutate(
    "requestDepositFromFunds",
    (c, tx) => {
      requestDepositFromFunds(c, tx, { accountId: ACCOUNT_ID, coinType: COLLATERAL_TYPE });
    },
    (p, tx) => {
      p.account.requestDepositFromFunds(tx, { accountId: ACCOUNT_ID, coinType: COLLATERAL_TYPE });
    },
  ),
  caseMutate(
    "requestWithdraw",
    (c, tx) => {
      requestWithdraw(c, tx, {
        accountId: ACCOUNT_ID,
        coinType: COLLATERAL_TYPE,
        amount: 1_000_000n,
        recipient: PTB_DUMMY_DEPOSIT_COIN,
      });
    },
    (p, tx) => {
      p.account.requestWithdraw(tx, {
        accountId: ACCOUNT_ID,
        coinType: COLLATERAL_TYPE,
        amount: 1_000_000n,
        recipient: PTB_DUMMY_DEPOSIT_COIN,
      });
    },
  ),
  caseMutate(
    "transferToAccount",
    (c, tx) => {
      transferToAccount(c, tx, {
        accountId: ACCOUNT_ID,
        coin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
        coinType: COLLATERAL_TYPE,
      });
    },
    (p, tx) => {
      p.account.transferToAccount(tx, {
        accountId: ACCOUNT_ID,
        coin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
        coinType: COLLATERAL_TYPE,
      });
    },
  ),
  caseMutate(
    "receive",
    (c, tx) => {
      receive(c, tx, {
        accountId: ACCOUNT_ID,
        receiving: receivingRef(tx),
        receivingType: COLLATERAL_TYPE,
      });
    },
    (p, tx) => {
      p.account.receive(tx, {
        accountId: ACCOUNT_ID,
        receiving: receivingRef(tx),
        receivingType: COLLATERAL_TYPE,
      });
    },
  ),
  caseMutate(
    "setReferralCode",
    (c, tx) => setReferralCode(c, tx, { code: "DUALPATH" }),
    (p, tx) => p.perp.setReferralCode(tx, { code: "DUALPATH" }),
  ),
  caseMutate(
    "useReferralCode",
    (c, tx) => useReferralCode(c, tx, { code: "REFCODE" }),
    (p, tx) => p.perp.useReferralCode(tx, { code: "REFCODE" }),
  ),
];

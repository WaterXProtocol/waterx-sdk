import {
  consumeCreditDeposit,
  custodyMint,
  enqueueWithdrawal,
  executeWithdrawalNative,
  executeWithdrawalWormhole,
  redeemVaa,
  requestCreditWithdraw,
  routeNative,
  routeWormhole,
} from "../../../../src/perp/user/credit.ts";
import { MOCK_CUSTODY_ASSET_TYPE } from "../fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_DEPOSIT_COIN } from "../fixtures/ptb-test-dummies.ts";
import {
  ACCOUNT_ID,
  caseMutate,
  EVM_ADDR,
  EVM_ADDR_2,
  type PerpDualPathCase,
} from "./perp-dual-path-shared.ts";

export const perpCreditDualPathCases: PerpDualPathCase[] = [
  caseMutate(
    "redeemVaa",
    (c, tx) => {
      redeemVaa(c, tx, { vaaBytes: new Uint8Array([0xde, 0xad]) });
    },
    (p, tx) => {
      p.account.redeemVaa(tx, { vaaBytes: new Uint8Array([0xde, 0xad]) });
    },
  ),
  caseMutate(
    "consumeCreditDeposit",
    (c, tx) => {
      const req = redeemVaa(c, tx, { vaaBytes: new Uint8Array([0xaa]) });
      consumeCreditDeposit(c, tx, { depositRequest: req });
    },
    (p, tx) => {
      const req = p.account.redeemVaa(tx, { vaaBytes: new Uint8Array([0xaa]) });
      p.account.consumeCreditDeposit(tx, { depositRequest: req });
    },
  ),
  caseMutate(
    "routeWormhole",
    (c, tx) => {
      routeWormhole(c, tx, {
        evmDestinationChain: 10002,
        evmRecipient: EVM_ADDR,
        evmToken: EVM_ADDR_2,
      });
    },
    (p, tx) => {
      p.account.routeWormhole(tx, {
        evmDestinationChain: 10002,
        evmRecipient: EVM_ADDR,
        evmToken: EVM_ADDR_2,
      });
    },
  ),
  caseMutate(
    "routeNative",
    (c, tx) => {
      routeNative(c, tx, { assetType: MOCK_CUSTODY_ASSET_TYPE });
    },
    (p, tx) => {
      p.account.routeNative(tx, { assetType: MOCK_CUSTODY_ASSET_TYPE });
    },
  ),
  caseMutate(
    "requestCreditWithdraw",
    (c, tx) => {
      const route = routeWormhole(c, tx, {
        evmDestinationChain: 10002,
        evmRecipient: EVM_ADDR,
        evmToken: EVM_ADDR_2,
      });
      requestCreditWithdraw(c, tx, {
        accountId: ACCOUNT_ID,
        amount: 1_000n,
        recipient: ACCOUNT_ID,
        route,
      });
    },
    (p, tx) => {
      const route = p.account.routeWormhole(tx, {
        evmDestinationChain: 10002,
        evmRecipient: EVM_ADDR,
        evmToken: EVM_ADDR_2,
      });
      p.account.requestCreditWithdraw(tx, {
        accountId: ACCOUNT_ID,
        amount: 1_000n,
        recipient: ACCOUNT_ID,
        route,
      });
    },
  ),
  caseMutate(
    "enqueueWithdrawal",
    (c, tx) => {
      const route = routeWormhole(c, tx, {
        evmDestinationChain: 10002,
        evmRecipient: EVM_ADDR,
        evmToken: EVM_ADDR_2,
      });
      const wreq = requestCreditWithdraw(c, tx, {
        accountId: ACCOUNT_ID,
        amount: 1_000n,
        recipient: ACCOUNT_ID,
        route,
      });
      enqueueWithdrawal(c, tx, { withdrawRequest: wreq });
    },
    (p, tx) => {
      const route = p.account.routeWormhole(tx, {
        evmDestinationChain: 10002,
        evmRecipient: EVM_ADDR,
        evmToken: EVM_ADDR_2,
      });
      const wreq = p.account.requestCreditWithdraw(tx, {
        accountId: ACCOUNT_ID,
        amount: 1_000n,
        recipient: ACCOUNT_ID,
        route,
      });
      p.account.enqueueWithdrawal(tx, { withdrawRequest: wreq });
    },
  ),
  caseMutate(
    "executeWithdrawalWormhole",
    (c, tx) => {
      executeWithdrawalWormhole(c, tx, {
        key: 1n,
        wormholeFee: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      });
    },
    (p, tx) => {
      p.account.executeWithdrawalWormhole(tx, {
        key: 1n,
        wormholeFee: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      });
    },
  ),
  caseMutate(
    "executeWithdrawalNative",
    (c, tx) => {
      executeWithdrawalNative(c, tx, {
        key: 2n,
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      });
    },
    (p, tx) => {
      p.account.executeWithdrawalNative(tx, {
        key: 2n,
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      });
    },
  ),
  caseMutate(
    "custodyMint",
    (c, tx) => {
      custodyMint(c, tx, {
        accountId: ACCOUNT_ID,
        assetCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      });
    },
    (p, tx) => {
      p.account.custodyMint(tx, {
        accountId: ACCOUNT_ID,
        assetCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      });
    },
  ),
];

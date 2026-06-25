import {
  mintCredit,
  mintCreditFromRequest,
  mintCreditToAccount,
} from "../../../../src/perp/user/custody.ts";
import { MOCK_CUSTODY_ASSET_TYPE } from "../fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_DEPOSIT_COIN } from "../fixtures/ptb-test-dummies.ts";
import { ACCOUNT_ID, caseMutate, type PerpDualPathCase } from "./perp-dual-path-shared.ts";

export const perpCustodyDualPathCases: PerpDualPathCase[] = [
  caseMutate(
    "mintCredit",
    (c, tx) => {
      mintCredit(c, tx, {
        accountId: ACCOUNT_ID,
        assetCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      });
    },
    (p, tx) => {
      p.account.mintCredit(tx, {
        accountId: ACCOUNT_ID,
        assetCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      });
    },
  ),
  caseMutate(
    "mintCreditFromRequest",
    (c, tx) => {
      mintCreditFromRequest(c, tx, {
        depositRequest: tx.object(PTB_DUMMY_DEPOSIT_COIN),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      });
    },
    (p, tx) => {
      p.account.mintCreditFromRequest(tx, {
        depositRequest: tx.object(PTB_DUMMY_DEPOSIT_COIN),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      });
    },
  ),
  caseMutate(
    "mintCreditToAccount",
    (c, tx) => {
      mintCreditToAccount(c, tx, {
        accountId: ACCOUNT_ID,
        assetCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      });
    },
    (p, tx) => {
      p.account.mintCreditToAccount(tx, {
        accountId: ACCOUNT_ID,
        assetCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      });
    },
  ),
];

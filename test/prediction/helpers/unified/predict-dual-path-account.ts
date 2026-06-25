import {
  allowPredictionProtocolAsset,
  disallowPredictionProtocolAsset,
  setDelegatePredictionPermission,
  whitelistPredictionProtocol,
} from "../../../../src/prediction/account.ts";
import { minimalAccountOpsParams, PTB_DUMMY } from "../../fixtures/ptb-params.ts";
import { caseMutate, type PredictDualPathCase } from "./predict-dual-path-shared.ts";

const baseAcc = minimalAccountOpsParams();

// Generic waterx_account ops (createAccount / deposit / withdraw / delegate / …)
// are no longer bound on `client.predict` — they live on the single shared
// `client.account` namespace. Only the prediction-SPECIFIC account ops remain on
// the predict facade, so only those are dual-path tested here.
export const predictAccountDualPathCases: PredictDualPathCase[] = [
  caseMutate(
    "setDelegatePredictionPermission",
    (c, tx) => setDelegatePredictionPermission(c, tx, { ...baseAcc, permissions: 7 }),
    (p, tx) => p.setDelegatePredictionPermission(tx, { ...baseAcc, permissions: 7 }),
  ),
  caseMutate(
    "whitelistPredictionProtocol",
    (c, tx) => whitelistPredictionProtocol(c, tx, { adminCap: PTB_DUMMY.adminCap }),
    (p, tx) => p.whitelistPredictionProtocol(tx, { adminCap: PTB_DUMMY.adminCap }),
  ),
  caseMutate(
    "allowPredictionProtocolAsset",
    (c, tx) => allowPredictionProtocolAsset(c, tx, { adminCap: PTB_DUMMY.adminCap }),
    (p, tx) => p.allowPredictionProtocolAsset(tx, { adminCap: PTB_DUMMY.adminCap }),
  ),
  caseMutate(
    "disallowPredictionProtocolAsset",
    (c, tx) => disallowPredictionProtocolAsset(c, tx, { adminCap: PTB_DUMMY.adminCap }),
    (p, tx) => p.disallowPredictionProtocolAsset(tx, { adminCap: PTB_DUMMY.adminCap }),
  ),
];

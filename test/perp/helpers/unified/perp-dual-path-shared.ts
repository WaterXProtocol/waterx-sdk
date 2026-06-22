/**
 * Shared constants + helpers for perp dual-path PTB cases.
 */
import { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "../../../../src/client.ts";
import type { PerpModule } from "../../../../src/unified-client.ts";
import { executeTrading, increasePositionRequest } from "../../../../src/user/trading.ts";
import { rawPrice } from "../../../../src/utils/math.ts";
import type { DualPathTxCase } from "../../../helpers/unified-dual-path.ts";
import { MOCK_TESTNET_CONFIG, MOCK_USDC_TYPE } from "../fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_ACCOUNT_ID, PTB_DUMMY_DEPOSIT_COIN } from "../fixtures/ptb-test-dummies.ts";

export const TICKER = "BTCUSD";
export const ACCOUNT_ID = PTB_DUMMY_ACCOUNT_ID;
export const COLLATERAL_TYPE = MOCK_USDC_TYPE;
export const EVM_ADDR = "0x1111111111111111111111111111111111111111";
export const EVM_ADDR_2 = "0x2222222222222222222222222222222222222222";
export const REWARD_TYPE =
  "0x896e53015216c5034825c056bcde37a694263601df2534ae5c91b8a3d9150c78::sui::SUI";
export const RECEIVING_DIGEST = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
export const PERP_PROTOCOL_TYPE = `${MOCK_TESTNET_CONFIG.packages.waterx_perp.original_id}::account_data::WaterXPerp`;
export const WLP_TYPE = `${MOCK_TESTNET_CONFIG.packages.wlp.original_id}::wlp::WLP`;

export const commonTxOpts = {
  skipOraclePriceRefresh: true,
  useSponsor: false,
  consolidateToUsd: false,
} as const;

export const baseOrderMain = {
  isLong: true,
  isStopOrder: false,
  reduceOnly: false,
  size: rawPrice(0.001),
  acceptablePrice: rawPrice(100_000),
  collateralAmount: 10_000_000n,
};

export type PerpDualPathCase = DualPathTxCase<WaterXClient, PerpModule>;

export function receivingRef(tx: Transaction) {
  return tx.receivingRef({
    objectId: PTB_DUMMY_DEPOSIT_COIN,
    version: 1,
    digest: RECEIVING_DIGEST,
  });
}

export function caseMutate(
  name: string,
  legacy: (c: WaterXClient, tx: Transaction) => void,
  facade: (p: PerpModule, tx: Transaction) => void,
): PerpDualPathCase {
  return {
    name,
    buildLegacy: (c) => {
      const tx = new Transaction();
      legacy(c, tx);
      return tx;
    },
    buildFacade: (p) => {
      const tx = new Transaction();
      facade(p, tx);
      return tx;
    },
  };
}

export function caseAsyncTx(
  name: string,
  legacy: (c: WaterXClient) => Promise<Transaction>,
  facade: (p: PerpModule) => Promise<Transaction>,
): PerpDualPathCase {
  return { name, buildLegacy: legacy, buildFacade: facade };
}

export function caseFactory(
  name: string,
  legacy: (c: WaterXClient) => Transaction,
  facade: (p: PerpModule) => Transaction,
): PerpDualPathCase {
  return { name, buildLegacy: legacy, buildFacade: facade };
}

export function buildExecuteTradingTx(client: WaterXClient): Transaction {
  const tx = new Transaction();
  const req = increasePositionRequest(client, tx, {
    collateralType: COLLATERAL_TYPE,
    ticker: TICKER,
    accountId: ACCOUNT_ID,
    positionId: 1n,
    collateralAmount: 1_000_000n,
    size: rawPrice(0.001),
    acceptablePrice: rawPrice(100_000),
  });
  executeTrading(client, tx, {
    collateralType: COLLATERAL_TYPE,
    ticker: TICKER,
    request: req,
  });
  return tx;
}

export function buildExecuteTradingFacade(perp: PerpModule): Transaction {
  const tx = new Transaction();
  const req = perp.increasePositionRequest(tx, {
    collateralType: COLLATERAL_TYPE,
    ticker: TICKER,
    accountId: ACCOUNT_ID,
    positionId: 1n,
    collateralAmount: 1_000_000n,
    size: rawPrice(0.001),
    acceptablePrice: rawPrice(100_000),
  });
  perp.executeTrading(tx, {
    collateralType: COLLATERAL_TYPE,
    ticker: TICKER,
    request: req,
  });
  return tx;
}

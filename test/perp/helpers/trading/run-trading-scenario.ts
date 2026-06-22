/**
 * Shared **simulate vs execute** paths for PTBs built by SDK tx-builders (`build*Tx`).
 */

import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "../../../../src/client.ts";
import { ORDER_LIMIT_BUY, ORDER_LIMIT_SELL } from "../../../../src/constants.ts";
import { matchOrders } from "../../../../src/user/trading.ts";
import { DUMMY_SENDER } from "../e2e/e2e-client.ts";
import {
  simulateWithTransientRetry,
  skipHermesIfFeedUnavailable,
  skipSimulateIfOracleTransient,
} from "../e2e/simulate-assertions.ts";
import { refreshOraclePricesForTradingEdge } from "./oracle-trading-edge.ts";

export { refreshOraclePricesForTradingEdge };

export type TradingRunMode = "simulate" | "execute";

/** Keeper `matchOrders` after oracle refresh (fills parked market-form rests). */
export async function buildMatchOrdersAfterRefreshTx(
  client: WaterXClient,
  args: {
    ticker: string;
    /** LONG entry rests on BUY book; SHORT on SELL. */
    isLong: boolean;
    maxFills?: bigint;
    tx?: Transaction;
  },
): Promise<Transaction> {
  const tx = args.tx ?? new Transaction();
  await refreshOraclePricesForTradingEdge(tx, client, [args.ticker]);
  matchOrders(client, tx, {
    ticker: args.ticker,
    collateralType: client.getPoolTokenType("USDCUSD"),
    orderTypeTag: args.isLong ? ORDER_LIMIT_BUY : ORDER_LIMIT_SELL,
    triggerPrice: 0n,
    maxFills: args.maxFills ?? 8n,
  });
  return tx;
}

/** Dry-run (`simulate`) or sign+send (`execute`) one builder-produced PTB. */
export async function runBuiltTradingTx(opts: {
  client: WaterXClient;
  mode: TradingRunMode;
  buildTx: () => Promise<Transaction>;
  simulateSender?: string;
  signer?: Ed25519Keypair;
  execBuilt?: (
    tx: Transaction,
    signer: Ed25519Keypair,
    execOpts?: { gasBudget?: number },
  ) => Promise<unknown>;
  execGasBudget?: number;
  oracleTransientCtx?: { skip: (reason?: string) => void };
}): Promise<unknown> {
  let built: Transaction;
  try {
    built = await opts.buildTx();
  } catch (e) {
    if (opts.oracleTransientCtx && skipHermesIfFeedUnavailable(opts.oracleTransientCtx, e)) {
      return;
    }
    throw e;
  }
  if (opts.mode === "simulate") {
    built.setSender(opts.simulateSender ?? DUMMY_SENDER);
    const sim = await simulateWithTransientRetry(() => opts.client.simulate(built));
    if (opts.oracleTransientCtx) {
      skipSimulateIfOracleTransient(opts.oracleTransientCtx, sim);
    }
    return sim;
  }
  if (!opts.signer || !opts.execBuilt) {
    throw new Error("runBuiltTradingTx execute mode requires signer + execBuilt");
  }
  return opts.execBuilt(built, opts.signer, {
    ...(opts.execGasBudget != null ? { gasBudget: opts.execGasBudget } : {}),
  });
}

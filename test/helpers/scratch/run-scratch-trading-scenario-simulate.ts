/**
 * Legacy v2 scratch simulate runners (approx oracle open / explicit size / resize).
 * v3 opens via limit `placeOrderRequest`; use `test/simulate/trade-*.test.ts` instead.
 */
import type { Transaction } from "@mysten/sui/transactions";
import type { WaterXClient } from "@waterx/perp-sdk";

import type { ScratchTradingScenario } from "./scratch-trading-scenarios.ts";

export type SimulateScratchCtx = { skip: (reason?: string) => void };

const SKIP =
  "Scratch simulate runners removed for v3 — use buildPlaceOrderTx / trade-* e2e tests instead";

export async function scratchSimulateOpenApproxOracle(
  ctx: SimulateScratchCtx,
  _client: WaterXClient,
  _accountId: string,
  _scenario: ScratchTradingScenario,
  _setSender: (tx: Transaction) => void,
): Promise<void> {
  ctx.skip(SKIP);
}

export async function scratchSimulateOpenExplicitSizeWithFee(
  ctx: SimulateScratchCtx,
  _client: WaterXClient,
  _accountId: string,
  _scenario: ScratchTradingScenario,
  _setSender: (tx: Transaction) => void,
): Promise<void> {
  ctx.skip(SKIP);
}

export async function scratchSimulateOpenResize(
  ctx: SimulateScratchCtx,
  _client: WaterXClient,
  _accountId: string,
  _scenario: ScratchTradingScenario,
  _setSender: (tx: Transaction) => void,
): Promise<void> {
  ctx.skip(SKIP);
}

export async function scratchSimulateOpenTableApproxPrice(
  ctx: SimulateScratchCtx,
  _client: WaterXClient,
  _accountId: string,
  _scenario: ScratchTradingScenario,
  _setSender: (tx: Transaction) => void,
  _trySimulate: (ctx: SimulateScratchCtx, tx: Transaction, minCommands: number) => Promise<void>,
): Promise<void> {
  ctx.skip(SKIP);
}

export async function scratchSimulateStatefulOps(
  ctx: SimulateScratchCtx,
  _client: WaterXClient,
  _accountId: string,
  _scenario: ScratchTradingScenario,
  _positionId: number,
  _setSender: (tx: Transaction) => void,
  _trySimulate: (ctx: SimulateScratchCtx, tx: Transaction, minCommands: number) => Promise<void>,
  _opts: {
    currentSize?: bigint;
    currentCollateralAmount?: bigint;
    collateral?: string;
  } = {},
): Promise<void> {
  ctx.skip(SKIP);
}

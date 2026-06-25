/**
 * @deprecated Use `test/simulate/trade-*.test.ts` and `test/helpers/trading/run-trading-scenario.ts`.
 */
import type { Transaction } from "@mysten/sui/transactions";

import type { PerpClient } from "../../../../src/client.ts";
import type { ScratchTradingScenario } from "./scratch-trading-scenarios.ts";

export type SimulateScratchCtx = { skip: (reason?: string) => void };

const SKIP = "v3: scratch simulate migrated — use runBuiltTradingTx / trade-* e2e tests";

async function skip(ctx: SimulateScratchCtx): Promise<void> {
  ctx.skip(SKIP);
}

export async function scratchSimulateOpenApproxOracle(
  ctx: SimulateScratchCtx,
  _client: PerpClient,
  _accountId: string,
  _scenario: ScratchTradingScenario,
  _setSender: (tx: Transaction) => void,
): Promise<void> {
  await skip(ctx);
}

export async function scratchSimulateOpenExplicitSizeWithFee(
  ctx: SimulateScratchCtx,
  _client: PerpClient,
  _accountId: string,
  _scenario: ScratchTradingScenario,
  _setSender: (tx: Transaction) => void,
): Promise<void> {
  await skip(ctx);
}

export async function scratchSimulateOpenResize(
  ctx: SimulateScratchCtx,
  _client: PerpClient,
  _accountId: string,
  _scenario: ScratchTradingScenario,
  _setSender: (tx: Transaction) => void,
): Promise<void> {
  await skip(ctx);
}

export async function scratchSimulateOpenTableApproxPrice(
  ctx: SimulateScratchCtx,
  _client: PerpClient,
  _accountId: string,
  _scenario: ScratchTradingScenario,
  _setSender: (tx: Transaction) => void,
  _trySimulate: (ctx: SimulateScratchCtx, tx: Transaction, minCommands: number) => Promise<void>,
): Promise<void> {
  await skip(ctx);
}

export async function scratchSimulateStatefulOps(
  ctx: SimulateScratchCtx,
  _client: PerpClient,
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
  await skip(ctx);
}

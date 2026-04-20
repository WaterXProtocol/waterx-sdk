/**
 * Shared pieces for **scratch** integration lifecycles (open → mutate → close, no persistent slots).
 * Reuses {@link buildResizeSizingProbeTransaction} / {@link parseResizeSizingProbeResult} so
 * preflight sizing matches `trading::resize` + live oracle, aligned with simulate suite helpers.
 */
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { getAccountBalance, type WaterXClient } from "@waterx/perp-sdk";
import { expect } from "vitest";

import type { BaseAsset } from "../../../src/constants.ts";
import type { MarketData } from "../../../src/view-types.ts";
import { activeLifecycleTestBases } from "../../helpers/lifecycle-test-markets.ts";
import {
  assertSimulateSuccess,
  skipSimulateIfOracleTransient,
} from "../../helpers/simulate-assertions.ts";
import {
  buildResizeSizingProbeTransaction,
  parseResizeSizingProbeResult,
  type ResizeSizingProbeParams,
} from "../../helpers/simulate-resize-size.ts";
import { assertSuccess } from "../setup.ts";
import { buildDepositUsdcFromWalletTx } from "./account-bootstrap.ts";

export type IntegrationExecTx = (
  tx: Transaction,
  signer: Ed25519Keypair,
  opts?: { gasBudget?: number },
) => Promise<{
  events: Array<{ type: string; parsedJson: unknown }>;
  effects?: { status?: unknown };
}>;

export function selectedIntegrationLifecycleBasesFromEnv(): BaseAsset[] {
  const all = activeLifecycleTestBases();
  const raw = process.env.WATERX_INTEGRATION_BASES?.trim();
  if (!raw) return all;

  const selected = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0) as BaseAsset[];
  const uniq = [...new Set(selected)];
  const invalid = uniq.filter((b) => !all.includes(b));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid WATERX_INTEGRATION_BASES: ${invalid.join(", ")}. Allowed: ${all.join(", ")}`,
    );
  }
  if (!uniq.length) {
    throw new Error(
      `WATERX_INTEGRATION_BASES is empty after parsing. Use comma-separated bases like BTC,ETH.`,
    );
  }
  return uniq;
}

export function positionIdFromOpened(ev: unknown): number {
  const j = ev as Record<string, unknown> | null | undefined;
  if (!j) throw new Error("Missing PositionOpened event payload");
  const raw = j.position_id ?? j.positionId;
  let n: number;
  if (typeof raw === "bigint") n = Number(raw);
  else if (typeof raw === "string") n = Number.parseInt(raw, 10);
  else if (typeof raw === "number") n = raw;
  else throw new Error("PositionOpened missing position_id");
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid position_id: ${String(raw)}`);
  return n;
}

export function leverageBpsFromPositionOpened(ev: unknown): bigint {
  const o = ev as Record<string, unknown>;
  const v = o.leverage_bps ?? o.leverageBps;
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === "string" && v.trim() !== "") return BigInt(v);
  throw new Error("PositionOpened missing leverage_bps");
}

/**
 * Derive a partial-decrease step. v2 has no lot size; just return `sizeAmount / 2`
 * (caller ensures the position is large enough for a partial close).
 */
export function decreaseStepSize(sizeAmount: bigint): bigint {
  if (sizeAmount <= 1n) {
    throw new Error(`Position size ${sizeAmount} too small for partial decrease`);
  }
  return sizeAmount / 2n;
}

/**
 * Top up account USDC to at least `minBalance` (smallest units) from the signer's wallet.
 */
export async function ensureScratchLifecycleMinUsdc(
  client: WaterXClient,
  trader: Ed25519Keypair,
  accountId: string,
  owner: string,
  minBalance: bigint,
  execTx: IntegrationExecTx,
): Promise<void> {
  const usdcType = client.config.collaterals.USDC.type;
  let balance = await getAccountBalance(client, accountId, usdcType);
  if (balance < minBalance) {
    const need = minBalance - balance;
    const depTx = await buildDepositUsdcFromWalletTx(client, owner, accountId, need);
    const depResult = await execTx(depTx, trader, { gasBudget: 50_000_000 });
    assertSuccess(depResult);
    balance = await getAccountBalance(client, accountId, usdcType);
  }
  expect(balance).toBeGreaterThanOrEqual(minBalance);
}

/**
 * Dry-run `trading::resize` for one base (same wiring as {@link buildResolveSize}). On transient
 * oracle failure, calls `ctx.skip` and returns `undefined`.
 */
export async function simulateResizeForIntegrationOrSkip(
  ctx: { skip: (reason?: string) => void },
  client: WaterXClient,
  base: BaseAsset,
  params: ResizeSizingProbeParams,
): Promise<bigint | undefined> {
  const bases = [base];
  const { tx, resizeCommandIndexByBase } = await buildResizeSizingProbeTransaction(
    client,
    bases,
    params,
  );
  const raw = await client.simulate(tx);
  if (skipSimulateIfOracleTransient(ctx, raw)) return undefined;
  assertSimulateSuccess(raw, tx.getData().commands.length, { transaction: tx });
  const sizes = parseResizeSizingProbeResult(raw, bases, resizeCommandIndexByBase);
  return sizes[base]!;
}

/** Assert simulated `resize` output is tradable for the current market snapshot.
 *  v2 removed `lot_size` / `min_size`; only a positive result is required. */
export function expectResizeProbeMatchesSnapshot(
  base: BaseAsset,
  sized: bigint,
  _snap: MarketData,
): void {
  expect(sized, `${base}: resize probe > 0`).toBeGreaterThan(0n);
}

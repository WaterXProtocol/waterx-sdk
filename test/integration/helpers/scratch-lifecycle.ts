/**
 * Shared pieces for **scratch** integration lifecycles (wxa balances, env ticker selection).
 */
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import type { WaterXClient } from "@waterx/perp-sdk";
import { expect } from "vitest";

import { getWxaAccountBalance } from "../../helpers/e2e/fetch-read-helpers-for-tests.ts";
import type { NormalizedIntegrationTxResult } from "../../helpers/e2e/integration-tx-result.ts";
import {
  activeLifecycleTestBasesIntegration,
  canonicalLifecycleTicker,
  LIFECYCLE_TEST_TICKER_ORDER,
} from "../../helpers/e2e/lifecycle-test-markets.ts";
import { assertSuccess } from "../setup.ts";
import { buildDepositUsdcFromWalletTx } from "./account-bootstrap.ts";

export type IntegrationExecTx = (
  tx: Transaction,
  signer: Ed25519Keypair,
  opts?: { gasBudget?: number },
) => Promise<NormalizedIntegrationTxResult>;

export function selectedIntegrationLifecycleBasesFromEnv(client: WaterXClient): string[] {
  const all = activeLifecycleTestBasesIntegration(client);
  const raw = process.env.WATERX_INTEGRATION_BASES?.trim();
  if (!raw) return all;

  const selected = raw
    .split(",")
    .map((s) => canonicalLifecycleTicker(s.trim()))
    .filter((s) => s.length > 0);
  const uniq = [...new Set(selected)];
  const invalid = uniq.filter((b) => !all.includes(b));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid WATERX_INTEGRATION_BASES: ${invalid.join(", ")}. Allowed: ${all.join(", ")}`,
    );
  }
  if (!uniq.length) {
    throw new Error(
      `WATERX_INTEGRATION_BASES is empty after parsing. Use comma-separated tickers like BTC,ETH or BTCUSD.`,
    );
  }
  return uniq;
}

/**
 * Parses `WATERX_INTEGRATION_BASES` against the static ticker table (**no WaterX client**).
 * Intended for Vitest **test discovery**: titles resolve before integration `WaterXClient` bootstrap.
 * Throws on symbols outside {@link LIFECYCLE_TEST_TICKER_ORDER}.
 */
export function integrationLifecycleBasesConfiguredOrStaticDefault(): readonly string[] {
  const raw = process.env.WATERX_INTEGRATION_BASES?.trim();
  if (!raw) return LIFECYCLE_TEST_TICKER_ORDER;

  const selected = raw
    .split(",")
    .map((s) => canonicalLifecycleTicker(s.trim()))
    .filter((s) => s.length > 0);
  const uniq = [...new Set(selected)];
  const allowed = new Set(LIFECYCLE_TEST_TICKER_ORDER);
  const invalid = uniq.filter((b) => !allowed.has(b));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid WATERX_INTEGRATION_BASES: ${invalid.join(", ")}. Allowed: ${[
        ...LIFECYCLE_TEST_TICKER_ORDER,
      ].join(", ")}`,
    );
  }
  if (!uniq.length) {
    throw new Error(
      `WATERX_INTEGRATION_BASES is empty after parsing. Use comma-separated tickers like BTC,ETH or BTCUSD.`,
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
 * Top up wxa account USDC to at least `minBalance` (smallest units) from the signer's wallet.
 */
export async function ensureScratchLifecycleMinUsdc(
  client: WaterXClient,
  trader: Ed25519Keypair,
  accountId: string,
  owner: string,
  minBalance: bigint,
  execTx: IntegrationExecTx,
): Promise<void> {
  const usdcType = client.getPoolTokenType("USDCUSD");
  let balance = await getWxaAccountBalance(client, accountId, usdcType);
  if (balance < minBalance) {
    const need = minBalance - balance;
    const depTx = await buildDepositUsdcFromWalletTx(client, owner, accountId, need);
    const depResult = await execTx(depTx, trader, { gasBudget: 50_000_000 });
    assertSuccess(depResult);
    balance = await getWxaAccountBalance(client, accountId, usdcType);
  }
  expect(balance).toBeGreaterThanOrEqual(minBalance);
}

/** @deprecated v2 resize probe — not ported for v3 tickers yet. */
export async function simulateResizeForIntegrationOrSkip(
  ctx: { skip: (reason?: string) => void },
  _client: WaterXClient,
  _ticker: string,
  _params: unknown,
): Promise<bigint | undefined> {
  ctx.skip("v3: simulateResizeForIntegrationOrSkip not ported");
  return undefined;
}

/** Assert simulated resize output is positive (snapshot unused on v3 path). */
export function expectResizeProbeMatchesSnapshot(
  ticker: string,
  sized: bigint,
  _snap: unknown,
): void {
  expect(sized, `${ticker}: resize probe > 0`).toBeGreaterThan(0n);
}

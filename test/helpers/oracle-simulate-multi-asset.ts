/**
 * One gRPC `simulateTransaction` that feeds Pyth (best-effort Hermes) + Supra and aggregates
 * **all** requested base markets — same path as `buildOpenPositionTx` oracle wiring.
 *
 * Parses `bucket_v2_oracle::aggregator::PriceAggregated<T>::result` (Float `to_scaled_val`, 1e9).
 */
import { Transaction } from "@mysten/sui/transactions";
import {
  buildOracleFeed,
  PYTH_PRICE_FEED_IDS,
  PYTH_TESTNET_FEED_IDS,
  PythCache,
  updatePythPrices,
  type WaterXClient,
} from "@waterx/perp-sdk";

import type { BaseAsset, CollateralAsset } from "../../src/constants.ts";

/** Matches `bucket_v2_framework::float::PRECISION`. */
export const ORACLE_FLOAT_USD_SCALE = 1_000_000_000;

export type SuiEventRecord = {
  type?: string;
  eventType?: string;
  moveEventType?: string;
  parsedJson?: unknown;
  json?: unknown;
  event?: { type?: string; eventType?: string; moveEventType?: string };
};

export function eventRecordType(e: SuiEventRecord | Record<string, unknown>): string {
  const o = e as Record<string, unknown>;
  const direct =
    o.type ??
    o.eventType ??
    o.moveEventType ??
    (typeof o.event_type === "string" ? o.event_type : undefined) ??
    (typeof o.move_event_type === "string" ? o.move_event_type : undefined);
  if (typeof direct === "string" && direct) return direct;
  const inner = o.event;
  if (inner && typeof inner === "object") {
    const ie = inner as Record<string, unknown>;
    const nested =
      ie.type ??
      ie.eventType ??
      ie.moveEventType ??
      (typeof ie.event_type === "string" ? ie.event_type : undefined);
    if (typeof nested === "string" && nested) return nested;
  }
  return "";
}

function extractSimulateFailureMessage(result: unknown): string {
  const r = result as {
    $kind?: string;
    FailedTransaction?: { status?: { error?: string | { message?: string } | unknown } };
  };
  if (r.$kind !== "FailedTransaction") return "";
  const err = r.FailedTransaction?.status?.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message?: unknown }).message ?? err);
  }
  return JSON.stringify(r.FailedTransaction ?? result);
}

export function eventsFromSimulateResult(result: unknown): SuiEventRecord[] {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  if (r.$kind === "FailedTransaction") return [];
  const inner = r.Transaction;
  if (inner && typeof inner === "object") {
    const ev = (inner as Record<string, unknown>).events;
    if (Array.isArray(ev)) return ev as SuiEventRecord[];
  }
  if (Array.isArray(r.events)) return r.events as SuiEventRecord[];
  return [];
}

function normTypeTag(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

function priceAggregatedTypeArg(eventType: string): string | null {
  const m = eventType.match(/PriceAggregated<([^>]+)>/);
  return m ? m[1]!.trim() : null;
}

function resultU128FromPayload(payload: Record<string, unknown>): bigint | null {
  const r = payload.result ?? payload.aggregated_price;
  if (typeof r === "bigint") return r;
  if (typeof r === "number" && Number.isFinite(r)) return BigInt(Math.trunc(r));
  if (typeof r === "string" && /^[0-9]+$/.test(r)) return BigInt(r);
  return null;
}

function pythFeedIdTable(client: WaterXClient): Record<string, string> {
  return client.config.network === "TESTNET" ? PYTH_TESTNET_FEED_IDS : PYTH_PRICE_FEED_IDS;
}

/**
 * USD (not Float scaled) per **1.0** base token, consistent with `buildOpenPositionTx` `approxPrice`
 * when `collateralAmount` is raw 6dp USDC (see `computeLeverageDerivedSize`).
 */
export async function fetchSimulatedUsdPricesForBases(
  client: WaterXClient,
  bases: readonly BaseAsset[],
  opts?: {
    sender?: string;
    gasBudget?: number;
    pythCache?: PythCache;
  },
): Promise<Record<BaseAsset, number>> {
  if (bases.length === 0) return {} as Record<BaseAsset, number>;

  const tx = new Transaction();
  tx.setSender(
    opts?.sender ?? "0x1111111111111111111111111111111111111111111111111111111111111111",
  );
  tx.setGasBudget(opts?.gasBudget ?? 1_200_000_000);

  const cache = opts?.pythCache ?? new PythCache();
  const pythCfg = client.config.pythConfig;
  const ids = pythFeedIdTable(client);
  const feedSet = new Set<string>();
  for (const base of bases) {
    const m = client.getMarketEntry(base);
    const fid = ids[m.feedKey]?.replace(/^0x/, "");
    if (fid) feedSet.add(fid);
  }
  if (pythCfg && feedSet.size) {
    try {
      await updatePythPrices(tx, client.grpcClient, pythCfg, [...feedSet], cache);
    } catch {
      /* Hermes flaky — on-chain Pyth still fed in buildOracleFeed */
    }
  }

  for (const base of bases) {
    const m = client.getMarketEntry(base);
    buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
  }

  const res = await client.grpcClient.simulateTransaction({
    transaction: tx,
    include: { commandResults: true, effects: true, events: true },
  });

  // If the batch TX fails (e.g. one broken aggregator aborts the whole TX),
  // fall back to per-base individual simulates so healthy markets still get prices.
  if (res && typeof res === "object" && (res as { $kind?: string }).$kind === "FailedTransaction") {
    if (bases.length === 1) {
      throw new Error(
        extractSimulateFailureMessage(res) || "simulateTransaction failed (oracle bundle)",
      );
    }

    const out = {} as Record<BaseAsset, number>;
    for (const base of bases) {
      try {
        const solo = await fetchSimulatedUsdPricesForBases(client, [base], opts);
        out[base] = solo[base]!;
      } catch {
        // This base's oracle is broken — skip it
      }
    }
    if (Object.keys(out).length === 0) {
      throw new Error(
        extractSimulateFailureMessage(res) || "simulateTransaction failed (oracle bundle)",
      );
    }
    return out;
  }

  const byType = new Map<string, number>();
  for (const ev of eventsFromSimulateResult(res)) {
    const t = eventRecordType(ev);
    // Published package id prefix; type is `0x…::aggregator::PriceAggregated<…>`, not `bucket_v2_oracle::…`.
    if (!t.includes("::aggregator::PriceAggregated")) continue;
    const typeArg = priceAggregatedTypeArg(t);
    if (!typeArg) continue;
    const rawEv = ev as Record<string, unknown>;
    const payload = (rawEv.parsedJson ?? rawEv.json ?? rawEv.parsed_json) as Record<
      string,
      unknown
    > | null;
    if (!payload || typeof payload !== "object") continue;
    const raw = resultU128FromPayload(payload);
    if (raw == null) continue;
    const usd = Number(raw) / ORACLE_FLOAT_USD_SCALE;
    if (!Number.isFinite(usd) || usd <= 0) continue;
    byType.set(normTypeTag(typeArg), usd);
  }

  const out = {} as Record<BaseAsset, number>;
  for (const base of bases) {
    const m = client.getMarketEntry(base);
    const usd = byType.get(normTypeTag(m.baseType));
    if (usd !== undefined) out[base] = usd;
  }

  // Per-base fallback for any bases missing from the batch (e.g. event parsing miss).
  const missing = bases.filter((b) => out[b] === undefined);
  for (const base of missing) {
    try {
      const solo = await fetchSimulatedUsdPricesForBases(client, [base], opts);
      out[base] = solo[base]!;
    } catch {
      // This base's oracle is broken — leave it out
    }
  }
  return out;
}

/**
 * Simulated aggregated USD price for a collateral token (same oracle path as trading PTBs).
 * `scaled` is `Float::to_scaled_val` (1e9 fixed point).
 */
export async function fetchSimulatedCollateralUsdPrice(
  client: WaterXClient,
  collateral: CollateralAsset = "USDC",
  opts?: {
    sender?: string;
    gasBudget?: number;
    pythCache?: PythCache;
  },
): Promise<{ usdPerCoin: number; scaled: bigint }> {
  const c = client.getCollateral(collateral);
  const tx = new Transaction();
  tx.setSender(
    opts?.sender ?? "0x1111111111111111111111111111111111111111111111111111111111111111",
  );
  tx.setGasBudget(opts?.gasBudget ?? 1_200_000_000);

  const cache = opts?.pythCache ?? new PythCache();
  const pythCfg = client.config.pythConfig;
  const ids = pythFeedIdTable(client);
  const fid = ids[c.feedKey]?.replace(/^0x/, "");
  if (pythCfg && fid) {
    try {
      await updatePythPrices(tx, client.grpcClient, pythCfg, [fid], cache);
    } catch {
      /* Hermes flaky */
    }
  }

  buildOracleFeed(client, tx, c.type, c.aggregatorId, c.priceInfoId);

  const res = await client.grpcClient.simulateTransaction({
    transaction: tx,
    include: { commandResults: true, effects: true, events: true },
  });
  if (res && typeof res === "object" && (res as { $kind?: string }).$kind === "FailedTransaction") {
    throw new Error(
      extractSimulateFailureMessage(res) || "simulateTransaction failed (collateral oracle)",
    );
  }

  const want = normTypeTag(c.type);
  for (const ev of eventsFromSimulateResult(res)) {
    const t = eventRecordType(ev);
    if (!t.includes("::aggregator::PriceAggregated")) continue;
    const typeArg = priceAggregatedTypeArg(t);
    if (!typeArg || normTypeTag(typeArg) !== want) continue;
    const rawEv = ev as Record<string, unknown>;
    const payload = (rawEv.parsedJson ?? rawEv.json ?? rawEv.parsed_json) as Record<
      string,
      unknown
    > | null;
    if (!payload || typeof payload !== "object") continue;
    const raw = resultU128FromPayload(payload);
    if (raw == null) continue;
    const usd = Number(raw) / ORACLE_FLOAT_USD_SCALE;
    if (!Number.isFinite(usd) || usd <= 0) {
      throw new Error(`Invalid collateral oracle USD for ${collateral}`);
    }
    return { usdPerCoin: usd, scaled: raw };
  }

  throw new Error(`Missing PriceAggregated event for collateral ${collateral} (${c.type})`);
}

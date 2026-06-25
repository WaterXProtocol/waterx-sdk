/**
 * v3 stub: legacy bucket-aggregator oracle bundle removed.
 * Scratch / sizing helpers use static USD hints from {@link ./oracle-pyth-context.ts}.
 */

import type { PerpClient } from "../../../../src/client.ts";
import { getUsdHintForTicker } from "./oracle-pyth-context.ts";

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

function resolveTickerKey(symbolOrTicker: string): string {
  const up = symbolOrTicker.trim();
  const legacy: Record<string, string> = {
    BTC: "BTCUSD",
    ETH: "ETHUSD",
    SOL: "SOLUSD",
    SUI: "SUIUSD",
    USDC: "USDCUSD",
  };
  return legacy[up] ?? legacy[up.toUpperCase()] ?? (up.endsWith("USD") ? up : `${up}USD`);
}

/** Hint table USD per symbol/ticker (legacy `bases` array supported). */
export async function fetchSimulatedUsdPricesForBases(
  client: PerpClient,
  bases: readonly string[],
  _opts?: { pythCache?: unknown },
): Promise<Record<string, number>> {
  void client;
  void _opts;
  const out: Record<string, number> = {};
  for (const b of bases) {
    const t = resolveTickerKey(b);
    out[b] = getUsdHintForTicker(t);
  }
  return out;
}

export async function fetchSimulatedCollateralUsdPrice(
  client: PerpClient,
  collateralKey: string,
): Promise<bigint> {
  void client;
  const usd = collateralKey === "USDC" ? 1 : getUsdHintForTicker(resolveTickerKey(collateralKey));
  return BigInt(Math.round(usd * Number(ORACLE_FLOAT_USD_SCALE)));
}

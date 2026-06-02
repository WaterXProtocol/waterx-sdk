import { expect } from "vitest";

import {
  eventRecordType,
  eventsFromSimulateResult,
  type SuiEventRecord,
} from "../e2e/oracle-simulate-multi-asset.ts";
import { expectedOpenTradingFeeRaw } from "./expected-open-trading-fee.ts";

function u64FromField(v: unknown): bigint | null {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === "string" && /^[0-9]+$/.test(v)) return BigInt(v);
  return null;
}

/** Sui JSON: Float often `{ value: "…" }` or nested `fields`. */
function floatScaledFromJson(j: unknown): bigint | null {
  if (j == null) return null;
  const direct = u64FromField(j);
  if (direct !== null) return direct;
  if (typeof j === "object") {
    const o = j as Record<string, unknown>;
    if ("value" in o) return floatScaledFromJson(o.value);
    if ("fields" in o) return floatScaledFromJson(o.fields);
  }
  return null;
}

function readPositionOpenedFields(payload: Record<string, unknown>): {
  sizeAmount: bigint;
  openFeeAmount: bigint;
  isLong: boolean;
  entryPriceScaled: bigint;
} | null {
  // v2: `size` is Float { value: u128 }, not u64 `size_amount`
  const sizeRaw = payload.size ?? payload.size_amount ?? payload["size_amount"];
  const feeRaw = payload.open_fee_amount ?? payload.openFeeAmount ?? payload["open_fee_amount"];
  const longRaw = payload.is_long ?? payload.isLong ?? payload["is_long"];
  const priceRaw = payload.entry_price ?? payload.entryPrice ?? payload["entry_price"];

  const sizeAmount = floatScaledFromJson(sizeRaw);
  const openFeeAmount = u64FromField(feeRaw);
  const entryPriceScaled = floatScaledFromJson(priceRaw);
  if (sizeAmount === null || openFeeAmount === null || entryPriceScaled === null) return null;
  if (typeof longRaw !== "boolean") return null;

  return { sizeAmount, openFeeAmount, isLong: longRaw, entryPriceScaled };
}

export function positionOpenedPayloadsFromSimulateResult(result: unknown): unknown[] {
  const events = eventsFromSimulateResult(result) as SuiEventRecord[];
  const out: unknown[] = [];
  for (const ev of events) {
    const t = eventRecordType(ev);
    if (!t.includes("::events::PositionOpened")) continue;
    const raw = ev as Record<string, unknown>;
    const p = raw.parsedJson ?? raw.json ?? raw.parsed_json;
    if (p != null) out.push(p);
  }
  return out;
}

/**
 * After a successful `buildOpenPositionTx` simulate, assert `PositionOpened.open_fee_amount`
 * matches the same formula as on-chain (base + impact), using pre-trade OI / pool TVL snapshots.
 */
export function assertSimulateOpenFeeMatchesFormula(
  simulateResult: unknown,
  ctx: {
    tradingFeeBps: bigint;
    longOi: bigint;
    shortOi: bigint;
    poolTvlUsdScaled: bigint;
    sizeDecimal: number;
    collateralDecimal: number;
    collateralPriceScaled: bigint;
  },
): void {
  const payloads = positionOpenedPayloadsFromSimulateResult(simulateResult);
  expect(payloads.length, "expected exactly one PositionOpened event").toBe(1);
  const p = payloads[0];
  expect(p && typeof p === "object", "PositionOpened payload object").toBe(true);
  const fields = readPositionOpenedFields(p as Record<string, unknown>);
  expect(fields, "parse PositionOpened fields").not.toBeNull();

  const expected = expectedOpenTradingFeeRaw({
    tradingFeeBps: ctx.tradingFeeBps,
    longOi: ctx.longOi,
    shortOi: ctx.shortOi,
    poolTvlUsdScaled: ctx.poolTvlUsdScaled,
    sizeAmount: fields!.sizeAmount,
    sizeDecimal: ctx.sizeDecimal,
    orderIsLong: fields!.isLong,
    entryPriceScaled: fields!.entryPriceScaled,
    collateralDecimal: ctx.collateralDecimal,
    collateralPriceScaled: ctx.collateralPriceScaled,
  });

  const actual = fields!.openFeeAmount;
  const delta = actual > expected ? actual - expected : expected - actual;
  /** Prefetch snapshot vs dry-run can diverge slightly (OI / impact fee path). */
  const maxDeltaRaw = 5n;
  expect(
    delta,
    `open_fee_amount vs expected within ${maxDeltaRaw} raw units (size=${fields!.sizeAmount}, bps=${ctx.tradingFeeBps}; ` +
      `actual=${actual}, expected=${expected} — snapshot OI/pool vs execute, or Float floor order)`,
  ).toBeLessThanOrEqual(maxDeltaRaw);
}

/**
 * Fill price / slippage helpers — Polymarket-style odds map as `lockedOddsCents` ≈ effective bps / 100.
 */
import type { OrderView, PositionView } from "~predict/types.ts";
import { expect } from "vitest";

import type { BetWire } from "./api-wire.ts";
import type { SuiEventEnvelope } from "./events.ts";

const BPS_SCALE = 10_000n;

/** Effective YES/NO price in bps from on-chain fill amounts (cost per share × 10_000). */
export function effectiveFillPriceBps(filledShares: bigint, filledCost: bigint): bigint {
  expect(filledShares).toBeGreaterThan(0n);
  return (filledCost * BPS_SCALE) / filledShares;
}

/** Polymarket wire: locked odds cents (0–100) ↔ on-chain bps. */
export function lockedOddsCentsFromFillBps(priceBps: bigint): number {
  return Number(priceBps) / 100;
}

export interface PlaceCaps {
  maxSpend: bigint;
  minShares: bigint;
  priceCapBps: bigint;
}

export function placeCapsFromOrderPlacedEvent(event: SuiEventEnvelope): PlaceCaps {
  return {
    maxSpend: BigInt(String(event.json.max_spend)),
    minShares: BigInt(String(event.json.min_shares)),
    priceCapBps: BigInt(String(event.json.price_cap)),
  };
}

/** On-chain fill must respect order caps and position view. */
export function assertFillEconomicsOnChain(
  caps: PlaceCaps,
  fillEvent: SuiEventEnvelope,
  position: PositionView,
): bigint {
  const filledShares = BigInt(String(fillEvent.json.filled_shares));
  const filledCost = BigInt(String(fillEvent.json.filled_cost));

  expect(filledShares).toBeGreaterThanOrEqual(caps.minShares);
  expect(filledCost).toBeGreaterThan(0n);
  expect(filledCost).toBeLessThanOrEqual(caps.maxSpend);
  expect(position.filledShares).toBe(filledShares);
  expect(position.filledCost).toBe(filledCost);

  const effectiveBps = effectiveFillPriceBps(filledShares, filledCost);
  expect(effectiveBps).toBeGreaterThan(0n);
  expect(effectiveBps).toBeLessThanOrEqual(caps.priceCapBps);

  return effectiveBps;
}

/**
 * Keeper `fill_order` args priced at the order cap (avoids abort 20 when `INTEGRATION_MIN_FILL`
 * would imply 100% odds on low-cap catalog orders).
 */
export function keeperFillFromPlaceCaps(caps: PlaceCaps): {
  filledShares: bigint;
  filledCost: bigint;
} {
  const minSharesForUnitCost =
    caps.priceCapBps > 0n ? (BPS_SCALE + caps.priceCapBps - 1n) / caps.priceCapBps : 1n;
  const filledShares =
    caps.minShares > minSharesForUnitCost ? caps.minShares : minSharesForUnitCost;
  let filledCost = (caps.priceCapBps * filledShares) / BPS_SCALE;
  if (filledCost < 1n) filledCost = 1n;
  if (filledCost > caps.maxSpend) filledCost = caps.maxSpend;
  return { filledShares, filledCost };
}

/**
 * Keeper fill targeting a spend amount (settlement base units, 6 decimals → $1 = 1_000_000).
 * Fills at the order price cap up to `targetFilledCost` / `maxSpend`.
 */
export function keeperFillTargetCost(
  caps: PlaceCaps,
  targetFilledCost: bigint,
): { filledShares: bigint; filledCost: bigint } {
  let filledCost = targetFilledCost;
  if (filledCost > caps.maxSpend) filledCost = caps.maxSpend;
  if (filledCost < 1n) filledCost = 1n;

  let filledShares =
    caps.priceCapBps > 0n
      ? (filledCost * BPS_SCALE + caps.priceCapBps - 1n) / caps.priceCapBps
      : caps.minShares;
  if (filledShares < caps.minShares) filledShares = caps.minShares;

  filledCost = (caps.priceCapBps * filledShares) / BPS_SCALE;
  if (filledCost > caps.maxSpend) {
    filledShares = (caps.maxSpend * BPS_SCALE) / caps.priceCapBps;
    if (filledShares < caps.minShares) filledShares = caps.minShares;
    filledCost = (caps.priceCapBps * filledShares) / BPS_SCALE;
    if (filledCost > caps.maxSpend) filledCost = caps.maxSpend;
  }
  if (filledCost < 1n) filledCost = 1n;
  return { filledShares, filledCost };
}

/** Optional keeper path: fill args should not exceed order caps (slippage guard on the PTB args). */
export function assertKeeperFillArgsWithinCaps(
  caps: PlaceCaps,
  filledShares: bigint,
  filledCost: bigint,
): void {
  expect(filledShares).toBeGreaterThanOrEqual(caps.minShares);
  expect(filledCost).toBeGreaterThan(0n);
  expect(filledCost).toBeLessThanOrEqual(caps.maxSpend);
  const effectiveBps = effectiveFillPriceBps(filledShares, filledCost);
  expect(effectiveBps).toBeLessThanOrEqual(caps.priceCapBps);
}

/** API bet row should mirror chain fill economics when bypass/indexer wire is aligned. */
export function assertBetWireMatchesFillEconomics(
  bet: BetWire,
  position: PositionView,
  effectiveBps: bigint,
  order?: OrderView,
): void {
  if (bet.shares !== undefined) {
    expect(BigInt(String(bet.shares))).toBe(position.filledShares);
  }

  if (bet.lockedOddsCents !== undefined) {
    const apiCents =
      typeof bet.lockedOddsCents === "string" ? Number(bet.lockedOddsCents) : bet.lockedOddsCents;
    expect(apiCents).toBeCloseTo(lockedOddsCentsFromFillBps(effectiveBps), 5);
  } else if (bet.priceCapBps !== undefined && order !== undefined) {
    expect(BigInt(String(bet.priceCapBps))).toBe(order.priceCapBps);
  }

  if (bet.stakeUsd !== undefined) {
    const stake = typeof bet.stakeUsd === "string" ? Number(bet.stakeUsd) : bet.stakeUsd;
    expect(Number.isFinite(stake)).toBe(true);
    expect(stake).toBeGreaterThan(0);
    // Raw chain cost is integer base units; API may expose human USD — only bound, not exact.
    expect(stake).toBeLessThanOrEqual(Number(position.filledCost) + 1);
  }
}

/** Fill economics pure helpers (no Vitest). */

import type { SuiEventEnvelope } from "./events-core.ts";

const BPS_SCALE = 10_000n;

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

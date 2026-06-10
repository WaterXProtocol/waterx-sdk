/**
 * Staging E2E bet amounts — settlement USD uses 6 decimals ($1 = 1_000_000 base units).
 * Convention: slot * $1.11 → $1.11, $2.22, $3.33, … (two decimal places).
 */
import { optionalEnv } from "./e2e-env.ts";

export const SETTLEMENT_USD_SCALE = 1_000_000n;

/** `$1.11`, `$2.22`, `$3.33`, … for parallel staging scenarios. */
export function stagingTestUsd(slot: number): number {
  const n = Math.max(1, Math.trunc(slot));
  return Math.round(n * 1.11 * 100) / 100;
}

export const DEFAULT_STAGING_BET_USD = stagingTestUsd(1);

export function usdToSettlementBase(usd: number): bigint {
  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error(`usdToSettlementBase: invalid USD amount ${usd}`);
  }
  return BigInt(Math.round(usd * Number(SETTLEMENT_USD_SCALE)));
}

export function usdToSettlementBaseStr(usd: number): string {
  return usdToSettlementBase(usd).toString();
}

export const DEFAULT_STAGING_MAX_SPEND = usdToSettlementBaseStr(DEFAULT_STAGING_BET_USD);

/** Manual `pnpm predict:place-and-watch` — distinct from script default $1.11. */
export const MANUAL_STAGING_BET_USD = 1.12;
export const MANUAL_STAGING_MAX_SPEND = usdToSettlementBaseStr(MANUAL_STAGING_BET_USD);

function parsePositiveUsd(raw: string, envName: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${envName} must be a positive number (e.g. 1.11), got ${raw}`);
  }
  return n;
}

/** Human-readable override: `E2E_STAGING_BET_USD` (default **1.11**). */
export function readStagingBetUsd(): number {
  const raw = optionalEnv("E2E_STAGING_BET_USD");
  return raw ? parsePositiveUsd(raw, "E2E_STAGING_BET_USD") : DEFAULT_STAGING_BET_USD;
}

/**
 * Place / keeper fill `maxSpend` string for staging catalog flows.
 * Base-unit override: `E2E_STAGING_MAX_SPEND` or `E2E_API_CROSSCHECK_MAX_SPEND`.
 */
export function readStagingMaxSpend(): string {
  const rawBase =
    optionalEnv("E2E_STAGING_MAX_SPEND") ?? optionalEnv("E2E_API_CROSSCHECK_MAX_SPEND");
  if (rawBase) {
    if (!/^\d+$/.test(rawBase) || BigInt(rawBase) <= 0n) {
      throw new Error(
        `E2E_STAGING_MAX_SPEND / E2E_API_CROSSCHECK_MAX_SPEND must be a positive integer string, got ${rawBase}`,
      );
    }
    return rawBase;
  }
  return usdToSettlementBaseStr(readStagingBetUsd());
}

export function readStagingMaxSpendBase(): bigint {
  return BigInt(readStagingMaxSpend());
}

/** Observed frontend place window (~51–90s on chain). */
export const DEFAULT_BROKER_PLACE_EXPIRY_MS = 90_000;

export interface BrokerFriendlyPlaceOptions {
  maxSpend: string;
  expiryMs: number;
  /** Optional override — default derives `oddsCents + 1` bps via `buildPlaceBetRequest`. */
  priceCapBps?: string;
}

/**
 * Staging catalog place options (`maxSpend` + short expiry).
 * `priceCapBps` comes from catalog odds unless `E2E_PLACE_PRICE_CAP_BPS` is set.
 */
export function readBrokerFriendlyPlaceOptions(overrides?: {
  maxSpend?: string;
}): BrokerFriendlyPlaceOptions {
  const maxSpend = overrides?.maxSpend ?? readStagingMaxSpend();
  const expiryRaw = optionalEnv("E2E_PLACE_EXPIRY_MS");
  const expiryMs = expiryRaw ? Number(expiryRaw) : DEFAULT_BROKER_PLACE_EXPIRY_MS;
  if (!Number.isFinite(expiryMs) || expiryMs <= 0) {
    throw new Error(`E2E_PLACE_EXPIRY_MS must be a positive number, got ${expiryRaw}`);
  }
  const cap = optionalEnv("E2E_PLACE_PRICE_CAP_BPS");
  if (cap) {
    if (!/^\d+$/.test(cap) || BigInt(cap) <= 0n) {
      throw new Error(`E2E_PLACE_PRICE_CAP_BPS must be a positive integer string, got ${cap}`);
    }
    return { maxSpend, expiryMs, priceCapBps: cap };
  }
  return { maxSpend, expiryMs };
}

/**
 * Staging catalog fill policy — backend broker owns fill_order; local keeper is opt-in only.
 */
import { optionalEnv } from "./e2e-env.ts";

/** Opt-in local `fillOrder` when the staging broker is down (decoupled testing). */
export function hasCatalogKeeperFallbackEnabled(): boolean {
  const v = optionalEnv("E2E_CATALOG_KEEPER_FALLBACK");
  return v === "1" || v === "true";
}

/**
 * When true, catalog place flows poll for backend broker fill only — never execute local
 * `fillOrder`. Default: broker-only. Set `E2E_CATALOG_KEEPER_FALLBACK=1` to restore keeper
 * fallback after the broker wait expires.
 */
export function catalogFillBrokerOnly(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  return !hasCatalogKeeperFallbackEnabled();
}

export class CatalogBrokerFillTimeoutError extends Error {
  readonly orderId: bigint;
  readonly brokerWaitMs: number;

  constructor(orderId: bigint, brokerWaitMs: number) {
    super(
      `order ${orderId} still OPEN after ${brokerWaitMs}ms — backend broker did not fill. ` +
        `Set E2E_CATALOG_KEEPER_FALLBACK=1 to allow local keeper fillOrder (decoupled testing only).`,
    );
    this.name = "CatalogBrokerFillTimeoutError";
    this.orderId = orderId;
    this.brokerWaitMs = brokerWaitMs;
  }
}

/** @deprecated Use {@link CatalogBrokerFillTimeoutError}. */
export class BrokerFillTimeoutError extends CatalogBrokerFillTimeoutError {}

export function isCatalogBrokerFillTimeout(err: unknown): err is CatalogBrokerFillTimeoutError {
  return err instanceof CatalogBrokerFillTimeoutError;
}

/** Poll window when broker-only (default staging). */
export const DEFAULT_CATALOG_BROKER_ONLY_WAIT_MS = 45_000;

/** Shorter broker try before keeper fallback when `E2E_CATALOG_KEEPER_FALLBACK=1`. */
export const DEFAULT_CATALOG_KEEPER_FALLBACK_WAIT_MS = 10_000;

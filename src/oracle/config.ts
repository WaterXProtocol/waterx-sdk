/**
 * Oracle-layer config schema — the package entries + config slice the shared
 * oracle layer (Pyth source + oracle rules + aggregate) reads. This is shared
 * infra, **not** the perp line: `perp/config.ts` imports these and
 * `WaterXPackages extends OraclePackages`; nothing here imports `perp/` or
 * `prediction/`. Snake_case mirrors the canonical `waterx-config` JSON 1:1.
 *
 * Hoisted out of `perp/config.ts` so {@link import("./host.ts").OracleHost}
 * depends on this shared schema instead of the perp line's full config —
 * mirrors the earlier account-config hoist.
 */

import type { BasePackageEntry } from "../account/config.ts";
import type { BaseLineConfig } from "../base-client.ts";

// ============================================================================
// Per-package entries (canonical shape, snake_case to match the JSON)
// ============================================================================

export interface PythRulePackage extends BasePackageEntry {
  config: string;
  feeds: Record<string, { feed_id: string; price_info_object: string }>;
}

export interface PythSponsorRulePackage extends BasePackageEntry {
  pyth_sponsor: string;
}

/**
 * `pyth_lazer_rule` deployment entry — present in the deployed testnet
 * `waterx-config` JSON. Read by `PythLazerRule` (`rules/pyth-lazer-rule.ts`):
 * `feeds` for ticker support + integer feed-id resolution, `state` for the
 * verify call, `published_at`/`config` for the per-ticker feed call.
 *
 * `enabled` mirrors the JSON field verbatim but MUST NOT be read for routing —
 * which rule prices a ticker is decided solely by the client's `oracleSource`
 * create option (see `OracleHost.oracleSource`), never by this flag or any
 * other config value.
 */
export interface PythLazerRulePackage extends BasePackageEntry {
  config: string;
  state: string;
  enabled?: boolean;
  /** Oracle ticker → integer Pyth Lazer feed id (distinct id scheme from `pyth_rule`'s hex `feed_id`). */
  feeds: Record<string, number>;
}

/** Per-ticker `constant_rule` feed entry (mirrors the `pyth_rule.feeds` shape). */
export interface ConstantFeedEntry {
  /**
   * Constant 1e9-scaled price (decimal string), mirroring the on-chain
   * `Config.prices` value (e.g. `"1000000000"` for $1). Informational off-chain —
   * the on-chain `constant_rule::feed` reads the price from `Config`; the SDK only
   * keys routing off the presence of the entry.
   */
  price: string;
}

export interface WaterxConstantRulePackage extends BasePackageEntry {
  /** Shared `constant_rule::Config` holding the per-ticker constant prices. */
  config: string;
  /**
   * Oracle ticker → constant feed entry, mirroring `pyth_rule.feeds`. A ticker
   * present here is fed via `constant_rule::feed` instead of (steady state) or
   * alongside (dual-feed) `pyth_rule::feed` (e.g. `USDCUSD → { price: "1000000000" }`).
   */
  feeds?: Record<string, ConstantFeedEntry>;
}

/** Per-ticker `supra_rule` feed entry (mirrors the `pyth_rule.feeds` shape). */
export interface SupraFeedEntry {
  /** Supra pair id (mirrors the on-chain `Config`; informational off-chain). */
  pair_id: number;
  /** Optional per-ticker freshness tolerance override (ms). */
  tolerance_ms?: number;
}

export interface SupraRulePackage extends BasePackageEntry {
  /** Shared `supra_rule::Config` (per-symbol Supra pair_id + freshness tolerance). */
  config: string;
  /** Supra `OracleHolder` shared object id (network-specific). Required to feed. */
  oracle_holder?: string;
  /** Oracle ticker → Supra feed entry (mirrors the on-chain `Config`; informational). */
  feeds?: Record<string, SupraFeedEntry>;
  /**
   * When true AND `config` + `oracle_holder` are set, `refreshOraclePrices`
   * feeds `supra_rule` on the same `PriceCollector` as Pyth before `aggregate`
   * (a second weighted rule). Defaults to **false** so a Pyth-only deployment
   * is unaffected — flip on only after `weight_threshold`/feeders are ready.
   */
  enabled?: boolean;
}

export interface WaterxOraclePackage extends BasePackageEntry {
  listing_cap: string;
  oracle: string;
  aggregators: Record<string, string>;
}

/**
 * The package subset the shared oracle layer reads. A line config
 * (`WaterXPackages`) **extends** this, so any line client's config is
 * structurally an oracle config.
 */
export interface OraclePackages {
  pyth_rule: PythRulePackage;
  pyth_sponsor_rule?: PythSponsorRulePackage;
  /** See {@link PythLazerRulePackage} — typed only, not read for routing. */
  pyth_lazer_rule?: PythLazerRulePackage;
  constant_rule?: WaterxConstantRulePackage;
  supra_rule?: SupraRulePackage;
  waterx_oracle: WaterxOraclePackage;
}

// ============================================================================
// Pyth access — caller-supplied credential + fetch policy (NO infra here)
// ============================================================================

/**
 * The caller-tunable subset of `fetchWithPolicy`'s policy exposed on the
 * `pythFetch` create option and `client.pyth.fetch` — the retry/timeout budget
 * for the off-chain Hermes (`fetchPriceFeedsUpdateData`) and Lazer
 * (`PythLazerRule`) update fetches. Deliberately narrower than the internal
 * `FetchPolicy` (no `retryDelayMs` / `apiKey` / `fetchImpl`). Both fetches fall
 * back to `fetchWithPolicy`'s defaults (15s timeout, 2 retries) when unset.
 */
export type PythFetchPolicy = { timeoutMs?: number; retries?: number };

/**
 * `client.pyth` — ONLY the caller-supplied Pyth credential + fetch policy,
 * shared by the Pyth-family rules (`pyth_rule`, `pyth_lazer_rule`). It carries
 * NO endpoints and NO on-chain object ids: every oracle source owns its own
 * infra, co-located with its rule (`PYTH_CORE_INFRA` in
 * `rules/pyth-core-infra.ts`; the Lazer constants inside
 * `rules/pyth-lazer-rule.ts`). A non-Pyth source never reads this slice.
 * Nothing here is sourced from the canonical `waterx-config` JSON — a Bearer
 * secret has no place in a public CDN document.
 */
export interface PythAccessConfig {
  /**
   * Pyth access token (`Authorization: Bearer …`). Required by
   * `PythLazerRule`'s signed-update fetch — Lazer is auth-first, so there is
   * no keyless default; absent when a lazer-routed fetch runs →
   * `LazerApiKeyMissing` is thrown at fetch time. Supplied via the
   * `pythApiKey` create option (the SDK never reads `process.env` or the
   * config JSON). As of the Pyth Pro migration (post-2026-08-18, per
   * https://docs.pyth.network/price-feeds/core/upgrade) this is ALSO required
   * for `pyth_rule`'s Hermes fetch (`fetchPriceFeedsUpdateData`) — see
   * `fetch` below.
   */
  api_key?: string;
  /**
   * Retry/timeout policy for the Hermes (`fetchPriceFeedsUpdateData`) and
   * Lazer (`PythLazerRule`) off-chain update fetches — see `fetchWithPolicy`
   * (`./update-fetch.ts`) for the full policy (backoff, which statuses retry,
   * Bearer attachment). Supplied via the `pythFetch` create option. Optional:
   * both fetches default to `fetchWithPolicy`'s built-in defaults (15s
   * timeout, 2 retries) when unset.
   */
  fetch?: PythFetchPolicy;
}

// ============================================================================
// Narrow oracle config (the slice OracleHost reads)
// ============================================================================

/**
 * The narrow config shape the oracle/refresh code needs. `WaterXConfig`
 * (the perp line's full config) is assignable to this, so `PerpClient` satisfies
 * {@link import("./host.ts").OracleHost} without the oracle layer importing `perp/`.
 */
export interface OracleConfig extends BaseLineConfig {
  packages: OraclePackages;
}

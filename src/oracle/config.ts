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
import type { Network } from "../constants.ts";

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
// Pyth — external chain infra, defaults by network
// ============================================================================

export interface PythInfraConfig {
  state_id: string;
  wormhole_state_id: string;
  hermes_endpoint: string;
  /**
   * Pyth Pro / Lazer access token (`Authorization: Bearer …`) for
   * `PythLazerRule`'s signed-update fetch — Lazer is auth-first, so there is
   * no keyless default. Optional: Pyth-Core-only deployments never need it.
   * Consumers pass it through client config (`config.pyth`); the SDK never
   * reads `process.env`. Absent when a lazer-routed fetch runs →
   * `LazerApiKeyMissing` is thrown at fetch time. As of the Pyth Pro
   * migration (post-2026-07-31) this is ALSO required for `pyth_rule`'s
   * Hermes fetch (`fetchPriceFeedsUpdateData`) — see `fetch` below.
   */
  api_key?: string;
  /**
   * Retry/timeout policy override for the Hermes (`fetchPriceFeedsUpdateData`)
   * and Lazer (`PythLazerRule`) off-chain update fetches — see
   * `fetchWithPolicy` (`./update-fetch.ts`) for the full policy (backoff,
   * which statuses retry, Bearer attachment). Optional: both fetches default
   * to `fetchWithPolicy`'s built-in defaults (15s timeout, 2 retries) when
   * unset.
   */
  fetch?: { timeoutMs?: number; retries?: number };
}

export const PYTH_DEFAULTS: Record<Network, PythInfraConfig> = {
  MAINNET: {
    state_id: "0x1f9310238ee9298fb703c3419030b35b22bb1cc37113e3bb5007c99aec79e5b8",
    wormhole_state_id: "0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c",
    hermes_endpoint: "https://hermes.pyth.network",
  },
  TESTNET: {
    state_id: "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
    wormhole_state_id: "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
    hermes_endpoint: "https://hermes-beta.pyth.network",
  },
};

// ============================================================================
// Pyth Lazer — external infra, defaults by network
// ============================================================================

/**
 * Pyth Lazer (Pyth Pro) external infra the `PythLazerRule` needs, by network.
 * Mirrors {@link PYTH_DEFAULTS}: per-network constants for infrastructure Pyth
 * operates (not part of the `waterx-config` JSON). A fuller `PYTH_INFRA`
 * restructure is deferred — this stays a minimal map until then.
 *
 * - `endpoint` — Lazer HTTP API base; signed updates come from
 *   `POST /v1/latest_price` (Bearer-authenticated). The service is
 *   network-agnostic (one signed payload verifies on any chain that trusts the
 *   Lazer signers), so both networks share the production host.
 * - `verifier_package` — the Sui package carrying
 *   `pyth_lazer::parse_and_verify_le_ecdsa_update`. Per-network: testnet is
 *   still the original v1 publish; mainnet is the v2-upgraded package (which
 *   still exposes the v1 entry `pyth_lazer_rule` binds). Values mirror the
 *   contract repo's `pyth_lazer_rule/Move.toml` published-at pins.
 */
export const LAZER_DEFAULTS: Record<Network, { endpoint: string; verifier_package: string }> = {
  MAINNET: {
    endpoint: "https://pyth-lazer.dourolabs.app",
    verifier_package: "0xefbfd064480777699fd9c557a5804d72ace7bc82661fdc8d1f1a44ea6d92ee10",
  },
  TESTNET: {
    endpoint: "https://pyth-lazer.dourolabs.app",
    verifier_package: "0xf5bd2141967507050a91b58de3d95e77c432cd90d1799ee46effc27430a68c21",
  },
};

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
  /** Pyth infra override (defaults from {@link PYTH_DEFAULTS}). */
  pyth?: PythInfraConfig;
}

/**
 * Oracle-layer config schema — the package entries + config slice the shared
 * oracle layer (oracle rules + aggregate) reads. This is shared
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
import type { FetchPolicy } from "./update-fetch.ts";

// ============================================================================
// Per-package entries (canonical shape, snake_case to match the JSON)
// ============================================================================

// `pyth_rule` / `pyth_sponsor_rule` (Pyth Core + its sponsor) were RETIRED in
// 5.0.0 and their schema entries deleted with them: these types describe what
// the SDK READS, and it reads neither. A deployed config JSON may still carry
// the blocks — extra keys are simply ignored — so no republish is required.

/**
 * `pyth_lazer_rule` deployment entry — present in the deployed testnet
 * `waterx-config` JSON. Read by `PythLazerRule` (`rules/pyth-lazer-rule.ts`):
 * `feeds` for ticker support + integer feed-id resolution, `state` for the
 * verify call, `published_at`/`config` for the per-ticker feed call.
 *
 * `enabled` mirrors the JSON field verbatim but MUST NOT be read for routing —
 * which rule prices a ticker is decided solely by the client's derived fed set
 * create option (see `OracleHost.oracleSources`), never by this flag or any
 * other config value.
 */
export interface PythLazerRulePackage extends BasePackageEntry {
  config: string;
  state: string;
  enabled?: boolean;
  /** Oracle ticker → integer Pyth Lazer feed id (distinct from the legacy Hermes hex id scheme). */
  feeds: Record<string, number>;
}

/** Per-ticker `constant_rule` feed entry (per-ticker map keyed by oracle ticker). */
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
   * Oracle ticker → constant feed entry. A ticker present here is fed via
   * `constant_rule::feed`, alone (constant-only) or alongside the live
   * sources (e.g. `USDCUSD → { price: "1000000000" }`).
   */
  feeds?: Record<string, ConstantFeedEntry>;
}

/** Per-ticker `supra_rule` feed entry (per-ticker map keyed by oracle ticker). */
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

/**
 * Per-ticker `waterx_rule` feed entry. Keyed in `feeds` by the oracle **ticker**
 * (e.g. `"SUIUSD"`), so `Object.keys(feeds)` is the SDK's supported-ticker
 * set. The fields are
 * informational off-chain — the SDK keys routing/support off the entry's
 * presence and pushes the enclave-signed price verbatim, never re-deriving it.
 */
export interface WaterxRuleFeedEntry {
  /** Exchange ticker the quote-center aggregates from (e.g. `"SUIUSDT"`). */
  ticker?: string;
}

/**
 * `waterx_rule` deployment entry — the first-party Nautilus-TEE oracle rule.
 * Read by `WaterxRule` (`rules/waterx-rule.ts`): `feeds` for ticker support,
 * `config`/`enclave_config`/`enclave` for the collect call
 * (`collect_single_with_proof`, or `collect_batch_latest` on the fallback shape),
 * `published_at` for the package address. The off-chain signed price is pulled
 * from the quote-center (endpoint from the rule-owned `WATERX_INFRA` table in
 * `rules/waterx-rule.ts`), not this JSON.
 *
 * `enabled` mirrors the JSON field verbatim but MUST NOT be read for routing —
 * which rule prices a ticker is decided solely by the client's derived fed set
 * create option (see `OracleHost.oracleSources`), mirroring `pyth_lazer_rule`.
 */
export interface WaterxRulePackage extends BasePackageEntry {
  /** Shared `waterx_rule::Config` (per-symbol on-chain feed_config). */
  config: string;
  /** Shared `EnclaveConfig<WATERX_RULE>` the on-chain signature verify runs against. */
  enclave_config: string;
  /** Shared `Enclave<WATERX_RULE>` holding the registered TEE signing pubkey. */
  enclave: string;
  enabled?: boolean;
  /** Oracle ticker → feed entry; presence marks the ticker as waterx-served. */
  feeds: Record<string, WaterxRuleFeedEntry>;
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
  /** See {@link PythLazerRulePackage} — typed only, not read for routing. */
  pyth_lazer_rule?: PythLazerRulePackage;
  constant_rule?: WaterxConstantRulePackage;
  supra_rule?: SupraRulePackage;
  /** See {@link WaterxRulePackage} — read by `WaterxRule` when the config wires it. */
  waterx_rule?: WaterxRulePackage;
  waterx_oracle: WaterxOraclePackage;
}

// ============================================================================
// Pyth access — caller-supplied credential + fetch policy (NO infra here)
// ============================================================================

/**
 * The caller-tunable subset of `fetchWithPolicy`'s policy exposed on the
 * `pythFetch` create option and `client.pyth.fetch` — the retry/timeout budget
 * for the off-chain Lazer (`PythLazerRule`) update fetch and the Lazer read
 * executor (`readLazerPrices`). Deliberately narrower than the internal
 * `FetchPolicy` (no `retryDelayMs` / `apiKey` / `fetchImpl`). Falls back to
 * `fetchWithPolicy`'s defaults (15s timeout, 2 retries) when unset.
 */
export type PythFetchPolicy = { timeoutMs?: number; retries?: number };

/**
 * `client.pyth` — ONLY the caller-supplied Pyth credential + fetch policy,
 * read by `PythLazerRule`. It carries NO endpoints and NO on-chain object
 * ids: every oracle source owns its own infra, co-located with its rule (the
 * Lazer constants inside `rules/pyth-lazer-rule.ts`). A non-Pyth source
 * never reads this slice.
 * Nothing here is sourced from the canonical `waterx-config` JSON — a Bearer
 * secret has no place in a public CDN document.
 */
export interface PythAccessConfig {
  /**
   * Pyth access token (`Authorization: Bearer …`). Required by
   * `PythLazerRule`'s signed-update fetch — Lazer is auth-first, so there is
   * no keyless default; absent when a lazer-routed build runs →
   * `LazerApiKeyMissing` is thrown by `refreshOraclePrices`'s credential
   * pre-check (before any fetch) or by the rule's own fetch. Supplied via
   * the `pythApiKey` create option (the SDK never reads `process.env` or the
   * config JSON). The same key authenticates the Pyth Pro read/history
   * surfaces (`readLazerPrices`, `fetchPythProHistory`).
   */
  api_key?: string;
  /**
   * Retry/timeout policy for the Lazer (`PythLazerRule`) off-chain update
   * fetch — see `fetchWithPolicy` (`./update-fetch.ts`) for the full policy
   * (backoff, which statuses retry, Bearer attachment). Supplied via the
   * `pythFetch` create option. Optional: defaults to `fetchWithPolicy`'s
   * built-in defaults (15s timeout, 2 retries) when unset.
   */
  fetch?: PythFetchPolicy;
}

// ============================================================================
// WaterX quote-center access — caller-supplied overrides (NO infra here)
// ============================================================================

/**
 * `client.waterx` — ONLY the caller-supplied quote-center overrides for
 * `WaterxRule`, mirroring {@link PythAccessConfig}: no resolved infra lives on
 * the client. When a field is unset the rule resolves it against its OWN
 * per-network table (`WATERX_INFRA` in `rules/waterx-rule.ts`) — no other
 * source's endpoint or policy is ever consulted.
 *
 * The endpoint override exists because this is the one oracle source a BROWSER
 * fetches itself: the rule pulls the signed envelope from the page, so it is
 * subject to the quote-center deployment's CORS allowlist. A front end whose
 * origin is not on that list — or one that must route egress through its own
 * backend — points `endpoint` at a same-origin proxy (or supplies
 * `fetch.fetchImpl`) instead of being locked to the default host.
 */
export interface WaterxAccessConfig {
  /**
   * Quote-center base URL override (`waterxEndpoint` create option). A base
   * PATH is preserved — the rule appends via `joinEndpointPath`, so
   * `https://app.example/api/quote-center` resolves to
   * `…/api/quote-center/v1/quotes/leaves` and a proxy route is not rewritten
   * away. A trailing slash is trimmed.
   */
  endpoint?: string;
  /**
   * Retry/timeout policy (and `fetchImpl`) for the quote-center fetch — see
   * `fetchWithPolicy` (`./update-fetch.ts`). Supplied via the `waterxFetch`
   * create option. Falls back to `fetchWithPolicy`'s built-in defaults (15s
   * timeout, 2 retries) when unset — never to another source's policy.
   */
  fetch?: FetchPolicy;
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

/**
 * Deployment config — THE loader for the canonical `waterx-config` document
 * (`schema_version: 2`), shared by both product lines and the account base.
 *
 * The document is parsed STRICTLY by `@waterx/config` (schema-derived types,
 * object-id patterns, network pin), then checked ONCE for the package entries
 * the SDK reads unconditionally ({@link REQUIRED_PACKAGES}) so every read site
 * can index `config.packages.<name>` without a guard. The parsed document IS
 * the SDK's config shape — `client.config` exposes it as-is: object ids live
 * under `objects.*`, oracle-rule wiring under `oracle_rules.*`, the ticker
 * universe under `symbols`, and `packages.*` carries only package identity
 * (`published_at` / `original_id` / `version`). There is no legacy (v1)
 * document support and no internal view over the document.
 *
 * `@waterx/config` strips fields this version does not know, so a parsed
 * config must never be re-serialized as a config file.
 */

import { parseWaterxConfig, type WaterxConfig as ParsedWaterxConfig } from "@waterx/config";

import type { Network } from "./constants.ts";
import { fetchWithPolicy, rethrowExhaustedFetch } from "./oracle/update-fetch.ts";

/** One `packages.<name>` entry — package identity only, no object ids. */
export type PackageEntry = ParsedWaterxConfig["packages"][string];
/** One `objects.perp.markets[ticker]` entry (`Market<LP>` + its `MarketConfig`). */
export type PerpMarketEntry = ParsedWaterxConfig["objects"]["perp"]["markets"][string];
/** One backing-asset row on the native custody vault (`objects.custody.assets[i]`). */
export type NativeCustodyAsset = ParsedWaterxConfig["objects"]["custody"]["assets"][number];
/** One `objects.staking.rewarders[stakeAlias][rewardAlias]` entry. */
export type RewarderEntry = ParsedWaterxConfig["objects"]["staking"]["rewarders"][string][string];

/**
 * Package entries the SDK reads UNCONDITIONALLY — every `objects.*` block
 * they pair with is required by the schema, so a document missing one of
 * these is a broken deployment, not an optional feature. Checked once at
 * load ({@link assertRequiredPackages}); read sites index them directly.
 *
 * The oracle-rule packages are NOT listed by name: each `oracle_rules.<rule>`
 * block names its own package (`.package`), and the same check requires the
 * named entry for every rule block the document carries.
 */
export const REQUIRED_PACKAGES = Object.freeze([
  "bucket_framework",
  "waterx_account",
  "waterx_referral",
  "waterx_credit",
  "native_custody",
  "wormhole_bridge",
  "withdrawal_queue",
  "waterx_oracle",
  "waterx_perp",
  "waterx_perp_view",
  "wlp",
  "waterx_staking",
  "waterx_prediction",
  "waterx_prediction_gift",
] as const);
export type RequiredPackage = (typeof REQUIRED_PACKAGES)[number];

/**
 * The parsed `waterx-config` document with {@link REQUIRED_PACKAGES} pinned to
 * present — what `client.config` holds.
 *
 * The intersection is load-bearing even though this repo leaves
 * `noUncheckedIndexedAccess` off (so a bare index read is non-`undefined`
 * regardless): `packages` is an open `Record<string, PackageEntry>`, which is
 * NOT assignable to a type that requires a specific package key. Declaring the
 * required ones keeps `config.packages.waterx_prediction` structurally present
 * for such consumers, matching the runtime guarantee
 * {@link assertRequiredPackages} establishes.
 */
export type WaterXConfig = ParsedWaterxConfig & {
  packages: Record<RequiredPackage, PackageEntry>;
};

/**
 * Throws when a package entry the SDK reads unconditionally is absent — the
 * fixed {@link REQUIRED_PACKAGES} set, plus the entry each published
 * `oracle_rules.<rule>` block names (a cross-reference the schema cannot
 * cheaply express).
 */
export function assertRequiredPackages(config: ParsedWaterxConfig): asserts config is WaterXConfig {
  const rules = config.oracle_rules;
  const missing = [
    ...REQUIRED_PACKAGES,
    rules.waterx.package,
    rules.constant.package,
    ...(rules.pyth_lazer ? [rules.pyth_lazer.package] : []),
  ].filter((name) => config.packages[name] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `waterx-config (${config.network}): packages.{${missing.join(", ")}} missing — ` +
        `the SDK reads every one of these unconditionally`,
    );
  }
}

/**
 * Strictly parse an already-fetched `waterx-config` document (a pinned file,
 * a test fixture) for `network`. Throws via `@waterx/config` on a schema
 * violation or a network mismatch, and via {@link assertRequiredPackages} on
 * a missing package entry.
 */
export function parseConfigDocument(doc: unknown, network: Network): WaterXConfig {
  assertNotPreV2Document(doc);
  const config = parseWaterxConfig(doc, network.toLowerCase() as Lowercase<Network>);
  assertRequiredPackages(config);
  return config;
}

/**
 * Reject a pre-v2 network config with an ACTIONABLE message before the schema
 * parser reports it as a pile of field errors.
 *
 * Only fires for a document that is recognizably a network config of the old
 * per-package shape (it carries `packages.waterx_perp` or
 * `packages.waterx_prediction`) yet declares no `schema_version` — i.e. a
 * `main`/`staging` document, where the fix is to repoint at a v2 endpoint
 * rather than to edit anything. Anything else falls through to the parser,
 * whose field-level errors are the more useful answer for a malformed v2
 * document.
 */
function assertNotPreV2Document(doc: unknown): void {
  if (!doc || typeof doc !== "object") return;
  const d = doc as { schema_version?: unknown; packages?: Record<string, unknown> };
  if (d.schema_version !== undefined) return;
  const packages = d.packages;
  if (!packages || typeof packages !== "object") return;
  if (!("waterx_perp" in packages) && !("waterx_prediction" in packages)) return;
  throw new Error(
    "pre-v2 waterx-config is no longer supported — point at a v2 endpoint " +
      "(a document declaring `schema_version: 2`, e.g. the `main-v2` / `staging-v2` deployments).",
  );
}

// ============================================================================
// Loader
// ============================================================================

export interface LoadConfigOptions {
  /**
   * Canonical `waterx-config` JSON URL to fetch, **as-is** (no `<network>.json`
   * / git ref appended). Required — {@link loadConfig} reads the URL only from
   * this option (there is no env-var fallback and no built-in default) and
   * throws when it is unset. Point it at a staging deployment or local mirror
   * as needed.
   */
  waterxConfigUrl?: string;
  /**
   * Reuse a previously-fetched config from the in-memory cache (keyed by
   * network + the effective URL). Default: false (always fetch fresh).
   */
  cache?: boolean;
  /** Optional fetch implementation (for tests or environments without global `fetch`). */
  fetchImpl?: typeof fetch;
  /**
   * Optional PER-ATTEMPT timeout in ms. Default 10_000. {@link loadConfig}
   * retries a transient failure (network error / 429 / 5xx) via
   * `fetchWithPolicy` (2 retries, exponential backoff) before falling back to
   * the last successfully-parsed config for this network+URL, if one exists.
   */
  timeoutMs?: number;
}

// Last successfully-parsed config per `${network}:${url}` — the ONE module
// map, written UNCONDITIONALLY on every successful load regardless of
// `opts.cache`. It serves two roles at once: the resilience fallback for a
// refresh failure (see `loadConfig` below) AND the opt-in fast-path read
// `opts.cache: true` gates at the top of `loadConfig`. `opts.cache` therefore
// only gates whether a call *reads* this map early (skipping the fetch
// entirely) — it never gates whether a call *writes* it; every successful
// load writes here. The network prefix keeps one network's snapshot from ever
// satisfying another's request (see the cache-key note in `loadConfig`).
//
// Deliberate (benign) semantic refinement from the prior two-map design: a
// `cache: true` call can now hit an entry that was populated by an earlier
// `cache: false` call for the SAME network+url. That's fine — it's still that
// key's latest successfully-parsed fetch, strictly FRESHER than any
// fallback read would have been, so a `cache: true` caller never observes
// staler data than before; it can only observe MORE-recent data sooner.
const configCache = new Map<string, WaterXConfig>();

export function clearConfigCache(): void {
  configCache.clear();
}

export async function loadConfig(
  network: Network,
  opts: LoadConfigOptions = {},
): Promise<WaterXConfig> {
  const url = opts.waterxConfigUrl;
  if (!url) {
    throw new Error("loadConfig: no config URL — pass opts.waterxConfigUrl");
  }
  // Key by network AND url, never url alone: the same url can legitimately be
  // requested for two networks (and the parser's network pin enforces
  // network/url coherence on the success path), so a url-only key would let a
  // testnet snapshot satisfy a mainnet request — both on this fast-path read
  // and on the resilience fallback below — handing back wrong-CHAIN object ids
  // to build transactions against. A wrong-network request simply misses here
  // and fetches fresh.
  const cacheKey = `${network}:${url}`;
  if (opts.cache && configCache.has(cacheKey)) {
    return configCache.get(cacheKey)!;
  }

  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
  if (!fetchImpl) {
    throw new Error("loadConfig: no global `fetch` available; pass opts.fetchImpl");
  }

  // Same resilience policy as the oracle money-path fetches (see
  // `fetchWithPolicy`): bounded retry with backoff instead of one bare
  // attempt. A refresh failure (network exhaustion, a non-ok response, OR a
  // 200 response that fails to parse — see below) falls back to the last
  // successfully-parsed config for this network+URL when one exists — a
  // config-endpoint blip must not crash a long-running process that already
  // has a working deployment snapshot. First load (nothing cached yet) has
  // no fallback and still throws. Intentionally no log line on the fallback
  // path — the SDK never logs (see every other oracle error in this
  // codebase); a caller that cares can tell it got a stale snapshot by
  // re-deriving staleness itself if it needs to.
  //
  // Deliberate limitation (not fixed here — a follow-up): this treats EVERY
  // failure mode identically, including a DETERMINISTIC one (404/403 — the
  // URL moved, or access was revoked) once a `configCache` snapshot exists.
  // Unlike a transient blip, a deterministic failure will never self-heal on
  // the next retry, so a long-running process with a stale snapshot will
  // keep serving it FOREVER and silently mask what is actually a permanent
  // deployment problem. Disambiguating "blip" from "moved/revoked" (e.g. via
  // a max-staleness budget, or treating non-retryable 4xx specially) is
  // intentionally deferred rather than folded into this change.
  //
  // fetch → ok-check → JSON → strict parse all run in ONE try, so any failure
  // along that chain (network exhaustion, a non-ok response, malformed JSON,
  // a schema violation, a network mismatch, or a missing required package)
  // lands in the same catch and takes the same single last-known-good lookup
  // below.
  let config: WaterXConfig;
  try {
    const response = await fetchWithPolicy(
      url,
      {},
      { timeoutMs: opts.timeoutMs ?? 10_000, retries: 2, fetchImpl },
    );
    if (!response.ok) {
      throw new Error(`loadConfig: HTTP ${response.status} fetching ${url}`);
    }
    config = parseConfigDocument(await response.json(), network);
  } catch (err) {
    const stale = configCache.get(cacheKey);
    if (stale) return stale;
    // Reframe a status-carrying FetchPolicyError into this function's own
    // message shape, mirroring the non-retried `!response.ok` throw above and
    // carrying the URL (the key datum for a config-fetch failure). A
    // network-level exhaustion (no status), a `!response.ok` throw, or a JSON
    // / schema parse failure has no reframing to add — the helper propagates
    // those verbatim.
    rethrowExhaustedFetch(err, (e) => `loadConfig: HTTP ${e.status} fetching ${url}`);
  }

  configCache.set(cacheKey, config);
  return config;
}

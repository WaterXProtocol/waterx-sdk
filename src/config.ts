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
import { FetchPolicyError, fetchWithPolicy, rethrowExhaustedFetch } from "./oracle/update-fetch.ts";
import { ownEntry, requireEntry } from "./utils/record.ts";

/** One `packages.<name>` entry — package identity only, no object ids. */
export type PackageEntry = ParsedWaterxConfig["packages"][string];
/** One `objects.perp.markets[ticker]` entry (`Market<LP>` + its `MarketConfig`). */
export type PerpMarketEntry = ParsedWaterxConfig["objects"]["perp"]["markets"][string];
/** One backing-asset row on the native custody vault (`objects.custody.assets[i]`). */
export type NativeCustodyAsset = ParsedWaterxConfig["objects"]["custody"]["assets"][number];
/** One `objects.staking.rewarders[stakeAlias][rewardAlias]` entry. */
export type RewarderEntry = ParsedWaterxConfig["objects"]["staking"]["rewarders"][string][string];

/**
 * Package entries EVERY consumer reads, whichever line it uses — the shared
 * `waterx_account` framework and its referral/bucket dependencies.
 *
 * Deliberately narrow. Requiring one line's packages to load a document blocks
 * the other line's consumers on a PARTIAL deployment: a network that ships perp
 * before prediction would otherwise fail `PerpClient.create` over an absent
 * `waterx_prediction_gift` the perp app never reads. Per-line sets live with
 * their clients ({@link PERP_PACKAGES} / {@link PREDICTION_PACKAGES}) and are
 * asserted at that client's construction.
 */
export const REQUIRED_PACKAGES = Object.freeze([
  "bucket_framework",
  "waterx_account",
  "waterx_referral",
] as const);
export type RequiredPackage = (typeof REQUIRED_PACKAGES)[number];

/** Packages the PERP line reads (asserted by `PerpClient`, not by the loader). */
export const PERP_PACKAGES = Object.freeze([
  "waterx_oracle",
  "waterx_perp",
  "waterx_perp_view",
  "wlp",
  "waterx_staking",
  "waterx_credit",
  "native_custody",
  "wormhole_bridge",
  "withdrawal_queue",
] as const);

/** Packages the PREDICTION line reads (asserted by `PredictClient`). */
export const PREDICTION_PACKAGES = Object.freeze([
  "waterx_prediction",
  "waterx_prediction_gift",
] as const);

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
 * A document additionally carrying the PERP line's packages — what `PerpClient`
 * holds once its {@link assertLinePackages} call has run. Kept separate from
 * {@link WaterXConfig} because the LOADER does not establish it: a document
 * serving only the prediction line parses fine, so promising these keys on
 * every parse result would type a guarantee that does not exist.
 */
export type PerpLineConfig = WaterXConfig & {
  packages: Record<(typeof PERP_PACKAGES)[number], PackageEntry>;
};

/** As {@link PerpLineConfig}, for the PREDICTION line's packages. */
export type PredictionLineConfig = WaterXConfig & {
  packages: Record<(typeof PREDICTION_PACKAGES)[number], PackageEntry>;
};

/**
 * Throws when a package a LINE reads is absent. Called by each line client so a
 * document serving only the other line still loads for consumers that never
 * touch the missing packages.
 */
export function assertLinePackages<const Names extends readonly string[]>(
  config: WaterXConfig,
  names: Names,
  line: string,
): asserts config is WaterXConfig & { packages: Record<Names[number], PackageEntry> } {
  const missing = names.filter((name) => ownEntry(config.packages, name) === undefined);
  if (missing.length > 0) {
    throw new Error(
      `waterx-config (${config.network}): packages.{${missing.join(", ")}} missing — ` +
        `the ${line} line reads every one of these`,
    );
  }
}

/**
 * Throws when a package EVERY consumer reads is absent — the shared
 * {@link REQUIRED_PACKAGES} core, plus the entry each published
 * `oracle_rules.<rule>` block names (a cross-reference the schema cannot
 * cheaply express).
 */
export function assertRequiredPackages(config: ParsedWaterxConfig): asserts config is WaterXConfig {
  const rules = config.oracle_rules;
  assertLinePackages(
    config as WaterXConfig,
    [
      ...REQUIRED_PACKAGES,
      rules.waterx.package,
      rules.constant.package,
      ...(rules.pyth_lazer ? [rules.pyth_lazer.package] : []),
    ],
    "SDK",
  );
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

/**
 * Whether a failed load may be retried into the last-known-good snapshot.
 *
 * TRANSIENT (fall back): no HTTP status at all — a network error, DNS failure,
 * or timeout — or a status the server may recover from (429, any 5xx).
 * DETERMINISTIC (propagate): every other status (notably 403/404), and every
 * failure after the bytes arrived — malformed JSON, schema violation, network
 * mismatch, missing required package. Those describe THIS url/document and do
 * not self-heal, so masking them behind a stale snapshot hides a permanent
 * deployment problem.
 */
function isTransientLoadFailure(err: unknown): boolean {
  // `fetchWithPolicy` only THROWS once it has exhausted retries, and it only
  // retries what it deems transient — so a `FetchPolicyError` is the transient
  // case. A non-ok response it hands back instead (any status it will not
  // retry, e.g. 403/404) arrives here as a plain Error and is deterministic by
  // construction. The status test below is belt-and-braces on that invariant.
  if (!(err instanceof FetchPolicyError)) return false;
  return err.status === undefined || err.status === 429 || err.status >= 500;
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

  // Resilience, but ONLY for a transient failure. A config-endpoint blip must
  // not crash a long-running process that already holds a working snapshot for
  // this network+URL — so a network exhaustion / timeout / 429 / 5xx falls back
  // to the last successfully-parsed config.
  //
  // A DETERMINISTIC failure never falls back: a 404/403 (the URL moved, or
  // access was revoked), malformed JSON, a schema violation, a network
  // mismatch, or a missing required package all mean THIS URL will not
  // self-heal on the next attempt. Serving the stale snapshot there would let
  // a process repointed at a retired or pre-v2 endpoint keep building against
  // dead object ids forever, silently — the failure mode that matters most now
  // that pre-v2 and v2 endpoints co-exist, and that both product lines share
  // this loader. Those propagate, cache or no cache.
  //
  // First load (nothing cached) throws either way. No log line on the fallback
  // path — the SDK never logs; a caller that cares can re-derive staleness.
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
    const stale = isTransientLoadFailure(err) ? configCache.get(cacheKey) : undefined;
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

/**
 * The published package entry a rule block names (`oracle_rules.<rule>.package`).
 * Own-key resolved, so a prototype-named package fails here rather than as an
 * `undefined` moveCall target. Presence is guaranteed by
 * {@link assertRequiredPackages} at load; this is the read path.
 */
export function rulePackageId(config: WaterXConfig, ruleBlock: { package: string }): string {
  return requireEntry(config.packages, ruleBlock.package, "packages").published_at;
}

/**
 * WaterX deployment config — fetched at client init from the canonical
 * `waterx-config` repo (default: GitHub raw).
 *
 * The schema mirrors the canonical JSON layout one-to-one (each package
 * groups its own object IDs + per-ticker maps). External chain infra
 * (Pyth state, Wormhole state/core, Hermes & Wormholescan endpoints) is
 * **not** in the JSON — it lives in `PYTH_DEFAULTS` / `WORMHOLE_DEFAULTS`
 * below, keyed by network.
 */

import type { AccountPackages, BasePackageEntry, WormholeInfraConfig } from "../account/config.ts";
import type { OraclePackages, PythInfraConfig } from "../oracle/config.ts";
import { FetchPolicyError, fetchWithPolicy } from "../oracle/update-fetch.ts";
import type { Network } from "./constants.ts";

// The account-layer schema (account / funding / referral package entries +
// wormhole infra) lives in `account/config.ts` — the base layer. Re-exported
// here so existing `perp/config` / `@waterx/sdk/perp` type imports keep resolving.
export type {
  AccountConfig,
  AccountPackages,
  BasePackageEntry,
  NativeCustodyAsset,
  NativeCustodyPackage,
  TrustedEmitterRow,
  WaterxCreditPackage,
  WaterxReferralPackage,
  WithdrawalQueuePackage,
  WormholeBridgePackage,
  WormholeInfraConfig,
  WxaAccountPackage,
} from "../account/config.ts";

// The oracle-layer schema (pyth / supra / constant rule package entries +
// the `waterx_oracle` package + Pyth infra defaults) lives in `oracle/config.ts`
// — shared infra. Re-exported here so existing `perp/config` /
// `@waterx/sdk/perp` type imports keep resolving.
export type {
  ConstantFeedEntry,
  OracleConfig,
  OraclePackages,
  PythGeneration,
  PythInfraConfig,
  PythLazerRulePackage,
  PythRulePackage,
  PythSponsorRulePackage,
  SupraFeedEntry,
  SupraRulePackage,
  WaterxConstantRulePackage,
  WaterxOraclePackage,
} from "../oracle/config.ts";
export { PYTH_DEFAULTS, PYTH_PRO_DEFAULTS } from "../oracle/config.ts";

// ============================================================================
// Per-package entries (canonical shape, snake_case to match the JSON)
// ============================================================================

// Oracle-layer package entries (pyth_rule / pyth_sponsor_rule / constant_rule /
// supra_rule / waterx_oracle) live in `oracle/config.ts` (shared infra) and are
// re-exported at the top of this file.

export interface WaterxPerpMarketEntry {
  market: string;
  config: string;
}

export interface WaterxPerpPackage extends BasePackageEntry {
  admin_cap: string;
  global_config: string;
  market_registry_wlp: string;
  markets: Record<string, WaterxPerpMarketEntry>;
}

export interface RewarderEntry {
  /** `Rewarder<STAKE, R>` shared object ID. */
  rewarder_id: string;
  /** Fully-qualified reward coin Move type (e.g. `0x2::sui::SUI`). */
  coin_type: string;
  /** Reward coin display decimals. */
  decimals: number;
}

export interface WaterxStakingPackage extends BasePackageEntry {
  admin_cap?: string;
  /** Map of stake-type alias (e.g. `"WLP"`) → `StakingPool<STAKE>` shared object ID. */
  pools?: Record<string, string>;
  /**
   * Map of stake-type alias → reward-token alias → rewarder metadata.
   * Reward-token alias is display-only (e.g. `"SUI"`, `"MOCK_SUI"`); the
   * fully-qualified coin Move type lives on the {@link RewarderEntry}.
   */
  rewarders?: Record<string, Record<string, RewarderEntry>>;
}

export interface WlpPackage extends BasePackageEntry {
  metadata_cap?: string;
  currency?: string;
  wlp_pool: string;
  /** Optional `WlpAum<LP>` shared object; required by `mint_wlp` / `settle_redeem`. */
  wlp_aum?: string;
  /** Map of oracle ticker → fully-qualified Move type registered via `lp_pool::add_token`. */
  pool_tokens: Record<string, string>;
}

export interface MockCoinPackage extends BasePackageEntry {
  currency?: string;
  treasury_cap?: string;
  metadata_cap?: string;
}

// Cross-chain credit / bridge stack (WaterxCreditPackage, NativeCustody*,
// WormholeBridgePackage, WithdrawalQueuePackage) lives in `account/config.ts`
// (the funding base) and is re-exported at the top of this file.

export interface TestnetFaucetPackage {
  published_at: string;
  whitelist?: string[];
  faucet?: string;
}

// `waterx-config` ships as either a perp deployment or a credit-only
// deployment, never both. The perp-side entries stay non-optional so the
// existing perp builders / examples / scripts keep compiling — the JSON is
// `as WaterXConfig`-cast with no runtime shape enforcement, and a
// credit-only config simply never reads them (credit consumers go through
// the throwing `client.get*()` helpers; `validateConfig` only enforces the
// package set appropriate to the detected deployment kind).
export interface WaterXPackages extends AccountPackages, OraclePackages {
  // Account-layer packages (bucket_framework, waterx_account, waterx_referral,
  // and the credit/bridge stack) are inherited from AccountPackages.
  // Oracle-layer packages (pyth_rule, pyth_sponsor_rule, constant_rule,
  // supra_rule, waterx_oracle) are inherited from OraclePackages.
  waterx_perp: WaterxPerpPackage;
  waterx_perp_view: BasePackageEntry;
  waterx_staking?: WaterxStakingPackage;
  wlp: WlpPackage;
  testnet_faucet?: TestnetFaucetPackage;
  // Optional mock coin packages (testnet only).
  mock_usdc?: MockCoinPackage;
  mock_usdsui?: MockCoinPackage;
  mock_sui?: MockCoinPackage;
  // `waterx_rule` (the first-party quote-center rule) is typed + read via
  // `OraclePackages.waterx_rule` (`WaterxRulePackage`); the enclave *package*
  // entry below is free-form and ignored by the SDK.
  waterx_rule_nautilus_enclave?: BasePackageEntry;
}

// ============================================================================
// Wormhole / Hermes — external chain infra, defaults by network
// ============================================================================
//
// `PythInfraConfig` + `PYTH_DEFAULTS` live in `oracle/config.ts` (shared infra)
// and are re-exported at the top of this file.

// `WormholeInfraConfig` is defined in `account/config.ts` (funding base) and
// re-exported at the top of this file. `state_id` is the same shared Sui
// Wormhole `State` object Pyth uses (kept in sync with
// `PYTH_DEFAULTS[*].wormhole_state_id`).

export const WORMHOLE_DEFAULTS: Record<Network, WormholeInfraConfig> = {
  MAINNET: {
    state_id: "0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c",
    core_package: "0x5306f64e312b581766351c07af79c72fcb1cd25147157fdc2f8ad76de9a3fb6a",
    sui_chain_id: 21,
    wormholescan_api: "https://api.wormholescan.io/api/v1",
  },
  TESTNET: {
    state_id: "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
    core_package: "0xf47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94",
    sui_chain_id: 21,
    wormholescan_api: "https://api.testnet.wormholescan.io/api/v1",
  },
};

// ============================================================================
// Root config
// ============================================================================

export interface WaterXConfig {
  /** Absent on credit-only deployment files. */
  network?: "mainnet" | "testnet";
  chain_id?: string | number | null;
  /** Sui gRPC base URL (default: public Mysten fullnode for the network). */
  grpcUrl?: string;
  packages: WaterXPackages;
  /** Pyth infra override (defaults from `PYTH_DEFAULTS[network]`). */
  pyth?: PythInfraConfig;
  /** Wormhole infra override (defaults from `WORMHOLE_DEFAULTS[network]`). */
  wormhole?: WormholeInfraConfig;
  /** Sui `CoinRegistry` shared object (credit deployments). */
  coin_registry?: string;
  /** Per-module credit supply caps (credit deployments). */
  credit_caps?: Record<string, string>;
  /** Deploy-script phase completion flags (credit deployments). */
  done?: Record<string, boolean>;
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
   * the last successfully-validated config for this network+URL, if one exists.
   */
  timeoutMs?: number;
}

// Last successfully-validated config per `${network}:${url}` — the ONE module
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
// key's latest successfully-validated fetch, strictly FRESHER than any
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
  // requested for two networks (and `validateConfig` enforces network/url
  // coherence on the success path), so a url-only key would let a testnet
  // snapshot satisfy a mainnet request — both on this fast-path read and on
  // the resilience fallback below — handing back wrong-CHAIN object ids to
  // build transactions against. A wrong-network request simply misses here
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
  // 200 response that fails to parse/validate — see below) falls back to the
  // last successfully-validated config for this network+URL when one exists — a
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
  // fetch → ok-check → parse → validate all run in ONE try, so any failure
  // along that chain (network exhaustion, a non-ok response, malformed JSON,
  // or a `validateConfig` rejection) lands in the same catch and takes the
  // same single last-known-good lookup below.
  let raw: WaterXConfig;
  try {
    const response = await fetchWithPolicy(
      url,
      {},
      { timeoutMs: opts.timeoutMs ?? 10_000, retries: 2, fetchImpl },
    );
    if (!response.ok) {
      throw new Error(`loadConfig: HTTP ${response.status} fetching ${url}`);
    }
    raw = (await response.json()) as WaterXConfig;
    validateConfig(raw, network, url);
  } catch (err) {
    const stale = configCache.get(cacheKey);
    if (stale) return stale;
    // Reformat a status-carrying FetchPolicyError (retries exhausted on a
    // retryable status) into this function's own message shape, mirroring
    // the non-retried `!response.ok` throw above. A network-level
    // exhaustion (no status), a `!response.ok` throw, or a JSON parse /
    // `validateConfig` failure has no domain-specific reframing to add —
    // propagate that error's own message as-is.
    if (err instanceof FetchPolicyError && err.status !== undefined) {
      throw new Error(
        `loadConfig: HTTP ${err.status} fetching ${url} (retries exhausted after ${err.attempts} attempts)`,
        { cause: err },
      );
    }
    throw err;
  }

  configCache.set(cacheKey, raw);
  return raw;
}

function validateConfig(cfg: WaterXConfig, expected: Network, url: string): void {
  // `network` is only present on perp deployment files; credit-only files
  // omit it. Enforce the guard only when the field is present.
  if (cfg.network !== undefined && cfg.network !== expected.toLowerCase()) {
    throw new Error(
      `loadConfig: config at ${url} declares network=${cfg.network} but caller asked for ${expected}`,
    );
  }
  if (!cfg.packages || typeof cfg.packages !== "object") {
    throw new Error(`loadConfig: config at ${url} has no packages object`);
  }
  const hasPublishedAt = (k: keyof WaterXPackages): boolean => {
    const entry = cfg.packages[k] as { published_at?: string } | undefined;
    return !!entry && typeof entry === "object" && !!entry.published_at;
  };
  // Validate by deployment kind. A perp config must carry the perp set; a
  // credit config the credit set. `waterx_account` is common to both.
  // `pyth_lazer_rule` is intentionally NOT required (and never will be by
  // presence alone) — it's an optional/experimental package selected only via
  // a client's `oracleSource` option, never by its presence in the config.
  const isPerp = "waterx_perp" in cfg.packages;
  const isCredit = "waterx_credit" in cfg.packages || "wormhole_bridge" in cfg.packages;
  const required: (keyof WaterXPackages)[] = isPerp
    ? [
        "bucket_framework",
        "pyth_rule",
        "waterx_account",
        "waterx_oracle",
        "waterx_perp",
        "waterx_perp_view",
        "wlp",
      ]
    : isCredit
      ? ["bucket_framework", "waterx_account", "waterx_credit"]
      : ["bucket_framework", "waterx_account"];
  for (const k of required) {
    if (!hasPublishedAt(k)) {
      throw new Error(`loadConfig: config at ${url} missing packages.${k}.published_at`);
    }
  }
}

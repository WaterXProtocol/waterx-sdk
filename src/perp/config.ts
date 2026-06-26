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
export interface WaterXPackages extends AccountPackages {
  // Account-layer packages (bucket_framework, waterx_account, waterx_referral,
  // and the credit/bridge stack) are inherited from AccountPackages.
  pyth_rule: PythRulePackage;
  pyth_sponsor_rule?: PythSponsorRulePackage;
  constant_rule?: WaterxConstantRulePackage;
  supra_rule?: SupraRulePackage;
  waterx_oracle: WaterxOraclePackage;
  waterx_perp: WaterxPerpPackage;
  waterx_perp_view: BasePackageEntry;
  waterx_staking?: WaterxStakingPackage;
  wlp: WlpPackage;
  testnet_faucet?: TestnetFaucetPackage;
  // Optional mock coin packages (testnet only).
  mock_usdc?: MockCoinPackage;
  mock_usdsui?: MockCoinPackage;
  mock_sui?: MockCoinPackage;
  // Free-form additional packages allowed in the JSON (e.g. `waterx_rule`,
  // `waterx_rule_nautilus_enclave`) — ignored by the SDK.
  waterx_rule?: BasePackageEntry;
  waterx_rule_nautilus_enclave?: BasePackageEntry;
}

// ============================================================================
// Pyth / Wormhole / Hermes — external chain infra, defaults by network
// ============================================================================

export interface PythInfraConfig {
  state_id: string;
  wormhole_state_id: string;
  hermes_endpoint: string;
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
   * Override the default config URL. Use this to point at a staging branch
   * (`?ref=staging`) or a local mirror during development. Takes precedence
   * over {@link configRef}.
   */
  configUrl?: string;
  /**
   * Pin the canonical config to a specific git ref — a commit SHA, branch,
   * or tag — instead of the default `main` branch. Resolves to
   * `https://raw.githubusercontent.com/WaterXProtocol/waterx-config/<ref>/<network>.json`.
   * Ignored when {@link configUrl} is set.
   */
  configRef?: string;
  /**
   * Reuse a previously-fetched config from the in-memory cache (keyed by
   * the effective URL). Default: false (always fetch fresh).
   */
  cache?: boolean;
  /** Optional fetch implementation (for tests or environments without global `fetch`). */
  fetchImpl?: typeof fetch;
  /** Optional request timeout in ms. Default 10_000. */
  timeoutMs?: number;
}

const CONFIG_REPO_RAW_BASE = "https://raw.githubusercontent.com/WaterXProtocol/waterx-config";

/** Default git ref for the canonical config when none is pinned. */
const DEFAULT_CONFIG_REF = "main";

/**
 * Build the canonical config URL for `network`, optionally pinned to a
 * specific git `ref` (commit SHA, branch, or tag). Defaults to `main`.
 */
export function defaultConfigUrl(network: Network, ref: string = DEFAULT_CONFIG_REF): string {
  return `${CONFIG_REPO_RAW_BASE}/${ref}/${network.toLowerCase()}.json`;
}

const cache = new Map<string, WaterXConfig>();

export function clearConfigCache(): void {
  cache.clear();
}

export async function loadConfig(
  network: Network,
  opts: LoadConfigOptions = {},
): Promise<WaterXConfig> {
  const url = opts.configUrl ?? defaultConfigUrl(network, opts.configRef);
  if (opts.cache && cache.has(url)) {
    return cache.get(url)!;
  }

  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
  if (!fetchImpl) {
    throw new Error("loadConfig: no global `fetch` available; pass opts.fetchImpl");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  let response: Response;
  try {
    response = await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new Error(`loadConfig: HTTP ${response.status} fetching ${url}`);
  }

  const raw = (await response.json()) as WaterXConfig;
  validateConfig(raw, network, url);

  if (opts.cache) cache.set(url, raw);
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

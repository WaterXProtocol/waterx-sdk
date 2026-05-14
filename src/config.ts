/**
 * WaterX deployment config — fetched at client init from the canonical
 * `waterx-config` repo (default: GitHub raw).
 *
 * The schema mirrors the canonical JSON layout one-to-one (each package
 * groups its own object IDs + per-ticker maps). External chain infra
 * (Pyth state, Wormhole state, Hermes endpoint) is **not** in the JSON
 * — it lives in `PYTH_DEFAULTS` below, keyed by network.
 */

import type { Network } from "./constants.ts";

// ============================================================================
// Per-package entries (canonical shape, snake_case to match the JSON)
// ============================================================================

export interface BasePackageEntry {
  published_at: string;
  original_id: string;
  version: number;
  upgrade_capability?: string;
}

export interface PythRulePackage extends BasePackageEntry {
  config: string;
  feeds: Record<string, { feed_id: string; price_info_object: string }>;
}

export interface PythSponsorRulePackage extends BasePackageEntry {
  pyth_sponsor: string;
}

export interface WxaAccountPackage extends BasePackageEntry {
  admin_cap: string;
  account_registry: string;
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

export interface WaterxStakingPackage extends BasePackageEntry {
  admin_cap?: string;
  /** Map of stake-type alias (e.g. `"WLP"`) → `StakingPool<STAKE>` shared object ID. */
  pools?: Record<string, string>;
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

export interface BucketReferralPackage extends BasePackageEntry {
  /** Shared `ReferralTable`. */
  referral_table: string;
}

export interface MockCoinPackage extends BasePackageEntry {
  currency?: string;
  treasury_cap?: string;
  metadata_cap?: string;
}

export interface WaterXPackages {
  bucket_framework: BasePackageEntry;
  bucket_referral?: BucketReferralPackage;
  pyth_rule: PythRulePackage;
  pyth_sponsor_rule?: PythSponsorRulePackage;
  waterx_account: WxaAccountPackage;
  waterx_oracle: WaterxOraclePackage;
  waterx_perp: WaterxPerpPackage;
  waterx_perp_view: BasePackageEntry;
  waterx_staking?: WaterxStakingPackage;
  wlp: WlpPackage;
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

// ============================================================================
// Root config
// ============================================================================

export interface WaterXConfig {
  network: "mainnet" | "testnet";
  chain_id: string | null;
  /** Sui gRPC base URL (default: public Mysten fullnode for the network). */
  grpcUrl?: string;
  packages: WaterXPackages;
  /** Pyth infra override (defaults from `PYTH_DEFAULTS[network]`). */
  pyth?: PythInfraConfig;
}

// ============================================================================
// Loader
// ============================================================================

export interface LoadConfigOptions {
  /**
   * Override the default config URL. Use this to point at a staging branch
   * (`?ref=staging`) or a local mirror during development.
   */
  configUrl?: string;
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

const DEFAULT_CONFIG_URL_BASE =
  "https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main";

export function defaultConfigUrl(network: Network): string {
  return `${DEFAULT_CONFIG_URL_BASE}/${network.toLowerCase()}.json`;
}

const cache = new Map<string, WaterXConfig>();

export function clearConfigCache(): void {
  cache.clear();
}

export async function loadConfig(
  network: Network,
  opts: LoadConfigOptions = {},
): Promise<WaterXConfig> {
  const url = opts.configUrl ?? defaultConfigUrl(network);
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
  if (cfg.network !== expected.toLowerCase()) {
    throw new Error(
      `loadConfig: config at ${url} declares network=${cfg.network} but caller asked for ${expected}`,
    );
  }
  const required: (keyof WaterXPackages)[] = [
    "bucket_framework",
    "pyth_rule",
    "waterx_account",
    "waterx_oracle",
    "waterx_perp",
    "waterx_perp_view",
    "wlp",
  ];
  for (const k of required) {
    const entry = cfg.packages?.[k];
    if (!entry || typeof entry !== "object" || !("published_at" in entry) || !entry.published_at) {
      throw new Error(`loadConfig: config at ${url} missing packages.${k}.published_at`);
    }
  }
}

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
  PythInfraConfig,
  PythRulePackage,
  PythSponsorRulePackage,
  SupraFeedEntry,
  SupraRulePackage,
  WaterxConstantRulePackage,
  WaterxOraclePackage,
} from "../oracle/config.ts";
export { PYTH_DEFAULTS } from "../oracle/config.ts";

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
  // Free-form additional packages allowed in the JSON (e.g. `waterx_rule`,
  // `waterx_rule_nautilus_enclave`) — ignored by the SDK.
  waterx_rule?: BasePackageEntry;
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
   * Config URL to fetch. Use this to point at a staging deployment or a local
   * mirror. Takes precedence over the `WATERX_CONFIG_URL` env var. When neither
   * is set, {@link loadConfig} throws — there is no default fallback.
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

/**
 * Environment variable holding the config URL. When set (and no explicit
 * `configUrl` is passed to {@link loadConfig}), it is fetched **as-is** —
 * `network` is not appended.
 */
export const CONFIG_URL_ENV = "WATERX_CONFIG_URL";

/** Read {@link CONFIG_URL_ENV} from the environment, if available. */
function configUrlFromEnv(): string | undefined {
  const url = globalThis.process?.env?.[CONFIG_URL_ENV];
  return url && url.length > 0 ? url : undefined;
}

const cache = new Map<string, WaterXConfig>();

export function clearConfigCache(): void {
  cache.clear();
}

export async function loadConfig(
  network: Network,
  opts: LoadConfigOptions = {},
): Promise<WaterXConfig> {
  const url = opts.configUrl ?? configUrlFromEnv();
  if (!url) {
    throw new Error(
      `loadConfig: no config URL — set the ${CONFIG_URL_ENV} env var or pass opts.configUrl`,
    );
  }
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

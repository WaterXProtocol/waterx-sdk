/**
 * Account-layer config schema — the package entries + config slice the base
 * (`waterx_account` framework + funding: credit / custody / bridge / queue +
 * referral) reads. This is the **base**: `perp/config.ts` imports these and
 * `WaterXPackages extends AccountPackages`; nothing here imports `perp/` or
 * `prediction/`. Snake_case mirrors the canonical `waterx-config` JSON 1:1.
 */

import type { BaseLineConfig } from "../base-client.ts";

export interface BasePackageEntry {
  published_at: string;
  original_id: string;
  version: number;
  upgrade_capability?: string;
}

export interface WxaAccountPackage extends BasePackageEntry {
  admin_cap: string;
  account_registry: string;
}

export interface WaterxReferralPackage extends BasePackageEntry {
  /** Shared `ReferralTable`. */
  referral_table: string;
}

// ---- Cross-chain credit / bridge stack ------------------------------------
//
// Mirrors the canonical credit `waterx-config` JSON 1:1 (snake_case). This is a
// *credit-only* deployment file — separate from the perp config — so it carries
// no `network` / perp / oracle / wlp keys. Only `published_at` is guaranteed on
// each package entry (no `original_id` / `version`), so these do NOT extend
// `BasePackageEntry`.

export interface WaterxCreditPackage {
  published_at: string;
  /** Shared `CreditRegistry<CREDIT>` (phase-1 output). */
  credit_registry?: string;
  /**
   * Fully-qualified CREDIT coin Move type, e.g. `0x..::usd::USD`. Required for
   * any credit/bridge flow — `client.creditType()` returns it as-is.
   */
  credit_type?: string;
}

/** One backing-asset row on the native custody vault (PSM). */
export interface NativeCustodyAsset {
  /** Human-readable asset label, e.g. `"MOCK_USDC"` / `"USDC"` (from `add_asset`). */
  name?: string;
  /** Fully-qualified backing asset Move type `T`. */
  type: string;
  decimal: number;
  mint_fee_scaled: string;
  burn_fee_scaled: string;
  min_burn_amount: string;
}

export interface NativeCustodyPackage {
  published_at: string;
  /** Shared `CustodyVault<CREDIT>` (phase-4 output). */
  vault?: string;
  /** Backing assets registered via `add_asset` (array, identified by `type`). */
  assets: NativeCustodyAsset[];
}

export interface TrustedEmitterRow {
  /** Source EVM chain's Wormhole chain id (e.g. 10002 = Sepolia). */
  chain_id: number;
  /** 32-byte left-padded EVM bridge address (0x form). */
  evm_bridge_address_32b: string;
  /** Whitelisted 20-byte EVM token addresses (0x form). */
  evm_tokens_20b: string[];
}

export interface WormholeBridgePackage {
  published_at: string;
  /** Shared Sui Wormhole `State` object id for this deployment. */
  wormhole_state: string;
  hourly_mint_limit?: string;
  max_mint_per_tx?: string;
  hourly_burn_limit?: string;
  max_burn_per_tx?: string;
  /**
   * @deprecated EVM emitter↔token config now lives solely under `evm.bridge.chains`
   * (deposit_vault = emitter, wormhole_chain_id = chain key). The runtime allowlist is
   * read from the on-chain `Bridge` object, not from config. Kept optional for back-compat.
   */
  trusted_emitters?: TrustedEmitterRow[];
  /** Shared `Bridge` (phase-5 output). */
  bridge?: string;
  /**
   * The bridge's `EmitterCap` object id (Sui-side Wormhole emitter address
   * for burn-relay Wormholescan lookups). Not written by the deploy script
   * — resolve from the on-chain `Bridge` object if absent.
   */
  emitter_cap?: string;
}

export interface WithdrawalQueuePackage {
  published_at: string;
  /** Addresses on the queue executor allowlist (keepers). */
  executors?: string[];
  /** Shared `Queue<CREDIT>` (phase-6 output). */
  queue?: string;
}

/**
 * Wormhole infra for the cross-chain credit bridge. `state_id` is the same
 * shared Sui Wormhole `State` object Pyth uses (kept in sync with
 * `PYTH_DEFAULTS[*].wormhole_state_id`). Override per-deployment via
 * `WaterXConfig.wormhole` if a deployment ever points elsewhere.
 */
export interface WormholeInfraConfig {
  /** Shared Sui Wormhole `State` object. */
  state_id: string;
  /** Wormhole core package id on Sui. */
  core_package: string;
  /** Sui's Wormhole chain id (21 on both mainnet and testnet). */
  sui_chain_id: number;
  /** Wormholescan REST base for VAA lookups (no trailing slash). */
  wormholescan_api: string;
}

/**
 * The minimal package slice the **generic wxa builders** (create / delegate /
 * alias …) read — only the fields BOTH the perp and prediction line configs are
 * guaranteed to carry (prediction makes `original_id` / `version` / `admin_cap`
 * optional, so the strict {@link WxaAccountPackage} is too narrow a target here).
 */
export interface WxaPackages {
  bucket_framework: { published_at: string };
  waterx_account: { published_at: string; account_registry: string };
  waterx_referral?: { published_at: string; referral_table: string };
}

/** Narrow config for the generic wxa builders — both line configs are assignable. */
export interface WxaConfig extends BaseLineConfig {
  packages: WxaPackages;
}

/**
 * The package subset the account base + funding builders read. The full
 * line config (`WaterXPackages`) **extends** this, so any line client's config
 * is structurally an account config.
 */
export interface AccountPackages extends WxaPackages {
  bucket_framework: BasePackageEntry;
  waterx_account: WxaAccountPackage;
  waterx_referral?: WaterxReferralPackage;
  // Cross-chain credit / bridge stack (credit-only deployments).
  waterx_credit?: WaterxCreditPackage;
  wormhole_bridge?: WormholeBridgePackage;
  withdrawal_queue?: WithdrawalQueuePackage;
  native_custody?: NativeCustodyPackage;
}

/**
 * The narrow config shape the account/funding builders need. `WaterXConfig`
 * (the perp line's full config) is assignable to this, so `PerpClient` satisfies
 * {@link import("./client.ts").AccountClientLike} without importing `perp/`.
 */
export interface AccountConfig extends BaseLineConfig {
  packages: AccountPackages;
  /** Wormhole infra override (defaults from `WORMHOLE_DEFAULTS[network]`). */
  wormhole?: WormholeInfraConfig;
}

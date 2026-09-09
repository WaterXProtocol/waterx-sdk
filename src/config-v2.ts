/**
 * waterx-config v2 (consolidated shape, `schema_version: 2`) → the SDK's
 * internal config view.
 *
 * The SDK's internal `WaterXConfig` mirrors the LEGACY canonical JSON layout
 * (per-package object ids + per-ticker maps). v2 relocates every object id
 * into domain-grouped `objects.*` / `oracle_rules.*` and introduces a single
 * `symbols` universe. Rather than repoint every read site (and break every
 * downstream consumer of `client.config`), the v2 document is:
 *
 *   1. parsed + validated STRICTLY by `@waterx/config` (the generated parser
 *      — schema-derived types, network pin, id patterns), then
 *   2. adapted here into the legacy-shaped internal view, one field at a
 *      time per the FLIP-PLAN path map.
 *
 * Legacy documents (schema_version absent) — including credit-only
 * deployment files, which the strict parser does not speak — keep the
 * existing cast-and-validate path in each line's `loadConfig`.
 *
 * `venue_feeds` no longer exists in v2 (quote-center #191 moved venue
 * composition into quote-service's BBO config): the SDK only ever read its
 * KEY SET (ticker support), which v2 carries as the `symbols` universe — so
 * `waterx_rule.feeds` is synthesized from `symbols` keys with empty entries.
 */

import { parseWaterxConfig } from "@waterx/config";
import type { WaterxConfig as WaterxConfigV2 } from "@waterx/config";

import type { WaterXConfig, WaterXPackages } from "./perp/config.ts";

/** A canonical v2 network document (vs legacy / credit-only shapes). */
export function isV2ConfigDocument(raw: unknown): boolean {
  return (
    !!raw && typeof raw === "object" && (raw as { schema_version?: unknown }).schema_version === 2
  );
}

/**
 * Strictly parse a v2 document and adapt it to the SDK's internal view.
 * Throws (via `@waterx/config`) on schema violations or a network mismatch —
 * a much stronger guarantee than the legacy path's `published_at` spot checks.
 */
export function parseAndAdaptV2Config(
  raw: unknown,
  expectedNetwork: "mainnet" | "testnet",
): WaterXConfig {
  const v2 = parseWaterxConfig(raw, expectedNetwork);
  return adaptV2Config(v2);
}

function identity(v2: WaterxConfigV2, name: string) {
  const p = v2.packages[name];
  if (!p) return undefined;
  return {
    published_at: p.published_at,
    original_id: p.original_id,
    version: p.version,
    ...(p.upgrade_capability !== undefined && { upgrade_capability: p.upgrade_capability }),
  };
}

function req(v2: WaterxConfigV2, name: string) {
  const id = identity(v2, name);
  if (!id) {
    throw new Error(`waterx-config v2: expected packages.${name} in the ${v2.network} document`);
  }
  return id;
}

export function adaptV2Config(v2: WaterxConfigV2): WaterXConfig {
  const o = v2.objects;
  const rules = v2.oracle_rules;

  const packages = {
    bucket_framework: req(v2, "bucket_framework"),

    waterx_account: {
      ...req(v2, "waterx_account"),
      admin_cap: o.account.admin_cap,
      account_registry: o.account.registry,
    },
    waterx_referral: identity(v2, "waterx_referral") && {
      ...req(v2, "waterx_referral"),
      referral_table: o.referral.table,
    },
    waterx_credit: identity(v2, "waterx_credit") && {
      published_at: req(v2, "waterx_credit").published_at,
      credit_registry: o.credit.registry,
      credit_type: o.credit.credit_type,
    },
    native_custody: identity(v2, "native_custody") && {
      published_at: req(v2, "native_custody").published_at,
      vault: o.custody.vault,
      assets: o.custody.assets,
    },
    wormhole_bridge: identity(v2, "wormhole_bridge") && {
      published_at: req(v2, "wormhole_bridge").published_at,
      wormhole_state: o.bridge.wormhole_state,
      bridge: o.bridge.state,
      emitter_cap: o.bridge.emitter_cap,
      max_mint_per_tx: o.bridge.limits.max_mint_per_tx,
      max_burn_per_tx: o.bridge.limits.max_burn_per_tx,
    },
    withdrawal_queue: identity(v2, "withdrawal_queue") && {
      published_at: req(v2, "withdrawal_queue").published_at,
      queue: o.withdrawal_queue.queue,
      ...(o.withdrawal_queue.executors !== undefined && {
        executors: o.withdrawal_queue.executors,
      }),
    },

    waterx_oracle: {
      ...req(v2, "waterx_oracle"),
      listing_cap: o.oracle.listing_cap,
      oracle: o.oracle.oracle,
      aggregators: o.oracle.aggregators,
    },
    waterx_perp: {
      ...req(v2, "waterx_perp"),
      admin_cap: o.perp.admin_cap,
      global_config: o.perp.global_config,
      market_registry_wlp: o.perp.market_registry_wlp,
      markets: o.perp.markets,
    },
    waterx_perp_view: req(v2, "waterx_perp_view"),
    wlp: {
      ...req(v2, "wlp"),
      metadata_cap: o.wlp.metadata_cap,
      currency: o.wlp.currency_type,
      wlp_pool: o.wlp.pool,
      wlp_aum: o.wlp.aum,
      pool_tokens: o.wlp.pool_tokens,
    },
    waterx_staking: identity(v2, "waterx_staking") && {
      ...req(v2, "waterx_staking"),
      ...(o.staking.admin_cap !== undefined && { admin_cap: o.staking.admin_cap }),
      pools: o.staking.pools,
      rewarders: o.staking.rewarders,
    },

    waterx_prediction: identity(v2, "waterx_prediction") && {
      ...req(v2, "waterx_prediction"),
      admin_cap: o.prediction.admin_cap,
      global_config: o.prediction.global_config,
      market_registries: o.prediction.market_registries,
      settlement_coin_types: o.prediction.settlement_coin_types,
    },
    waterx_prediction_gift: identity(v2, "waterx_prediction_gift") && {
      ...req(v2, "waterx_prediction_gift"),
      admin_cap: o.prediction.gift_admin_cap,
      claimable_link_config: o.prediction.claimable_link_config,
    },

    waterx_rule: rules.waterx &&
      identity(v2, "waterx_rule") && {
        ...req(v2, "waterx_rule"),
        config: rules.waterx.rule_config_object,
        enclave_config: rules.waterx.enclave.config,
        enclave: rules.waterx.enclave.object,
        // v2 has no per-feed venue data (quote-center #191): the ticker
        // universe IS the `symbols` map. Presence-only entries preserve the
        // one thing the SDK ever read — `Object.keys(feeds)`.
        feeds: Object.fromEntries(Object.keys(v2.symbols).map((sym) => [sym, {}])),
      },
    pyth_lazer_rule: rules.pyth_lazer &&
      identity(v2, "pyth_lazer_rule") && {
        ...req(v2, "pyth_lazer_rule"),
        config: rules.pyth_lazer.lazer_config_object,
        state: rules.pyth_lazer.lazer_state_object,
        feeds: rules.pyth_lazer.lazer_feed_ids,
      },
    constant_rule: rules.constant &&
      identity(v2, "constant_rule") && {
        ...req(v2, "constant_rule"),
        config: rules.constant.rule_config_object,
        feeds: rules.constant.constant_prices,
      },
    supra_rule: rules.supra &&
      identity(v2, "supra_rule") && {
        ...req(v2, "supra_rule"),
        config: rules.supra.rule_config_object,
        feeds: Object.fromEntries(
          Object.entries(rules.supra.pair_ids).map(([sym, pair_id]) => [sym, { pair_id }]),
        ),
        // `enabled` / `oracle_holder` are unrepresentable in v2 (dormant
        // capability — see waterx-config FLIP-PLAN); the rule stays off,
        // exactly as with every live legacy document.
      },

    testnet_faucet: o.faucet && {
      published_at: req(v2, "testnet_faucet").published_at,
      faucet: o.faucet.faucet,
      whitelist: o.faucet.whitelist,
    },
    mock_usdsui: o.mock_usdsui &&
      identity(v2, "mock_usdsui") && {
        ...req(v2, "mock_usdsui"),
        currency: o.mock_usdsui.currency_type,
        treasury_cap: o.mock_usdsui.treasury_cap,
        metadata_cap: o.mock_usdsui.metadata_cap,
      },
    mock_usdc: identity(v2, "mock_usdc"),
    mock_sui: identity(v2, "mock_sui"),
  } as unknown as WaterXPackages;

  return {
    network: v2.network,
    chain_id: v2.chain_id,
    packages,
  } as WaterXConfig;
}

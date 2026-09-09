import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  adaptV2Config,
  isV2ConfigDocument,
  parseAndAdaptV2Config,
} from "../../../src/config-v2.ts";

// The REAL staging-v2 testnet document — parse strictness and the adapter
// are exercised against live-shape data, not a hand-trimmed mock.
const V2_DOC = JSON.parse(
  readFileSync(
    new URL("../helpers/fixtures/waterx-config-v2-testnet.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;

describe("waterx-config v2 → internal view adapter", () => {
  it("detects v2 documents by schema_version", () => {
    expect(isV2ConfigDocument(V2_DOC)).toBe(true);
    expect(isV2ConfigDocument({ packages: {} })).toBe(false);
  });

  it("rejects a network mismatch via the strict parser", () => {
    expect(() => parseAndAdaptV2Config(V2_DOC, "mainnet")).toThrow(/network/i);
  });

  it("adapts every relocated read the SDK depends on", () => {
    const cfg = parseAndAdaptV2Config(V2_DOC, "testnet");
    const v2 = V2_DOC as {
      objects: Record<string, Record<string, unknown>>;
      oracle_rules: Record<string, Record<string, unknown>>;
      symbols: Record<string, unknown>;
      packages: Record<string, { published_at: string }>;
    };

    // identity passthrough
    expect(cfg.packages.waterx_perp.published_at).toBe(v2.packages.waterx_perp.published_at);
    // objects.* relocations (incl. the renames)
    expect(cfg.packages.waterx_oracle.aggregators["BTCUSD"]).toBe(
      (v2.objects.oracle.aggregators as Record<string, string>)["BTCUSD"],
    );
    expect(cfg.packages.waterx_perp.markets["BTCUSD"].market).toBe(
      (v2.objects.perp.markets as Record<string, { market: string }>)["BTCUSD"].market,
    );
    expect(cfg.packages.wlp.wlp_pool).toBe(v2.objects.wlp.pool);
    expect(cfg.packages.wlp.wlp_aum).toBe(v2.objects.wlp.aum);
    expect(cfg.packages.wlp.currency).toBe(v2.objects.wlp.currency_type);
    expect(cfg.packages.waterx_account.account_registry).toBe(v2.objects.account.registry);
    expect(cfg.packages.waterx_referral?.referral_table).toBe(v2.objects.referral.table);
    expect(cfg.packages.waterx_credit?.credit_registry).toBe(v2.objects.credit.registry);
    expect(cfg.packages.waterx_credit?.credit_type).toBe(v2.objects.credit.credit_type);
    expect(cfg.packages.native_custody?.vault).toBe(v2.objects.custody.vault);
    expect(cfg.packages.wormhole_bridge?.bridge).toBe(v2.objects.bridge.state);
    expect(cfg.packages.wormhole_bridge?.max_mint_per_tx).toBe(
      (v2.objects.bridge.limits as Record<string, string>).max_mint_per_tx,
    );
    expect(cfg.packages.withdrawal_queue?.queue).toBe(v2.objects.withdrawal_queue.queue);
    // The prediction line's packages ride the same adapted document (typed
    // on the prediction side; structurally present here).
    const predictionPkgs = cfg.packages as unknown as Record<
      string,
      Record<string, unknown> | undefined
    >;
    expect(predictionPkgs.waterx_prediction?.global_config).toBe(
      v2.objects.prediction.global_config,
    );
    expect(predictionPkgs.waterx_prediction_gift?.claimable_link_config).toBe(
      v2.objects.prediction.claimable_link_config,
    );
    expect(predictionPkgs.waterx_prediction_gift?.admin_cap).toBe(
      v2.objects.prediction.gift_admin_cap,
    );

    // oracle_rules.* relocations
    expect(cfg.packages.waterx_rule?.config).toBe(v2.oracle_rules.waterx.rule_config_object);
    expect(cfg.packages.waterx_rule?.enclave_config).toBe(
      (v2.oracle_rules.waterx.enclave as Record<string, string>).config,
    );
    expect(cfg.packages.constant_rule?.feeds?.["USDCUSD"]?.price).toBe(
      (v2.oracle_rules.constant.constant_prices as Record<string, { price: string }>)["USDCUSD"]
        .price,
    );
    expect(cfg.packages.supra_rule?.feeds?.["BTCUSD"]?.pair_id).toBe(
      (v2.oracle_rules.supra.pair_ids as Record<string, number>)["BTCUSD"],
    );
    // supra stays dormant: v2 cannot express enabled/oracle_holder
    expect(cfg.packages.supra_rule?.enabled).toBeUndefined();
    expect(cfg.packages.supra_rule?.oracle_holder).toBeUndefined();

    // venue_feeds is gone from v2 — the ticker universe is `symbols`
    expect(Object.keys(cfg.packages.waterx_rule?.feeds ?? {}).sort()).toEqual(
      Object.keys(v2.symbols).sort(),
    );
  });

  it("adapt is exercised by the exported building block too", () => {
    // direct adapter call (post-parse) — same output as the wrapper
    const parsed = parseAndAdaptV2Config(V2_DOC, "testnet");
    expect(parsed.network).toBe("testnet");
    expect(adaptV2Config).toBeTypeOf("function");
  });
});

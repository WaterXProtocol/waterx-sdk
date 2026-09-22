/**
 * Minimal canonical (schema_version 2) testnet-shaped `waterx-config` document
 * for offline unit tests, shared by BOTH product lines — one consolidated
 * document carries every package, exactly as the live CDN file does.
 *
 * Values mirror the deployed testnet ids (BTCUSD / ETHUSD / USDCUSD, the perp
 * + prediction + credit stacks); ids the old per-line fixtures stubbed are
 * `stub(n)` placeholders. The literal is parsed through the SDK's own
 * `parseConfigDocument` at import, so a fixture that drifts from the schema
 * (or loses a required package) fails EVERY test loudly instead of yielding a
 * silently different client.
 *
 * Both price-update sources are wired (Lazer feeds + waterx feeds) so
 * the fed set derives `[pyth_lazer_rule, waterx_rule]`; `constant_prices` is
 * EMPTY so every ticker stays on the live sources — constant-routing tests
 * clone the config and populate it. Tests that want a particular fed set go
 * through `withOracleSources` (`test/perp/helpers/test-client.ts`).
 */
import { parseConfigDocument, type WaterXConfig } from "../../../src/config.ts";

/** Deterministic 64-hex placeholder object id for blocks the fixture stubs. */
const stub = (n: number): string => `0x${n.toString(16).padStart(64, "0")}`;

/** Package identity for a fresh (never-upgraded) publish: `original_id === published_at`. */
const pkg = (id: string, version = 1) => ({ published_at: id, original_id: id, version });

const USD_TYPE = "0x3d6fd5e79c5134f94523f5d6d24a96ecf9f9af35bdbf9e6af87f5a6dbb032efe::usd::USD";

export const MOCK_TESTNET_CONFIG_RAW = {
  schema_version: 2,
  network: "testnet",
  chain_id: "4c78adac",
  // The ticker universe the quote-center serves. USDCUSD is a live-priced
  // (spot) symbol here, NOT a constant pin — see the header.
  symbols: {
    BTCUSD: { kind: "perp" },
    ETHUSD: { kind: "perp" },
    USDCUSD: { kind: "spot" },
  },
  packages: {
    bucket_framework: pkg("0x0cdfc09284014fd36bbb19da8ab1c60056ca207d4c866e78dc01ca8e51dac790"),
    waterx_account: pkg("0x2d9b1eb3958fad8ff619d30d959351ecce851fcea231fa362b36d52c76b339b5"),
    waterx_referral: pkg("0x0ab918a0dd576e44b84f14ed4a2329030c6c07e09f44e82c544b23f3ddbf6b7f"),
    waterx_credit: pkg("0xf6750397c266eca69451691b5125fbf35e5c4575c98884ac3ab6f084493fd497"),
    native_custody: pkg("0x45c2074e892975f0fb62b934824531c04d43f6e7f00bf8d1e7ce2556e84fd6ee"),
    wormhole_bridge: pkg(stub(0x8a1b)),
    withdrawal_queue: pkg(stub(0x5a1b)),
    waterx_oracle: pkg("0x6b244c75800a105900b3fa0c2ac005a057ebabe8c3d452742a1690e3dc88229a"),
    waterx_perp: {
      published_at: "0x8f699ee7e645d6b73fa5b10536246ec13275aab81a8608675fedf51658d201aa",
      original_id: "0x9f40b37878f252b3ea20d1a73e3c35b4314ea66821599e62742119e375112419",
      version: 2,
    },
    waterx_perp_view: pkg("0xada57121b6a0988eb3149e613ee3acf5e10809e5fed6faa1741e55f5eeb3260b"),
    wlp: pkg("0xe6112759a0d6f503ef24050a891bd3cd1ced587a87a83b3fa9c96a8cc417558c"),
    waterx_staking: pkg("0x33b128a17cb484919ff90e2035d5b8914acee808b8ce040cff723cce15214862"),
    waterx_prediction: pkg("0x99be07b27dbbd846eec72213f0ec221b3e7d38c8bfdee3cbf578b9bfa5df3481"),
    waterx_prediction_gift: pkg(
      "0x2cf6f6b047b4e0b97f33a77a75d6fa39175600894fe8615ef45caec2e59f023f",
    ),
    // Oracle rules — each `oracle_rules.<rule>.package` names its entry here.
    waterx_rule: {
      published_at: "0xe1500e0c522eab37d2487e2d0babb08c48a425474455ba262f0caa339c503524",
      original_id: "0xa74191aad31907bbbd870626dd251b797a12a3841b0fdaf2af1e1cb5952572fb",
      version: 2,
    },
    pyth_lazer_rule: {
      ...pkg("0xc192ffd76818fd029ee4493748be7251e3fc51ce0f2803bede8f9970c40a8739"),
      upgrade_capability: "0xc45f8b3d0e91de6c52e734fd1e865a4198a856bcae340adf2775cd9ac967e43f",
    },
    constant_rule: pkg("0xc04574571e0001000000000000000000000000000000000000000000c057ab1e"),
  },
  objects: {
    perp: {
      global_config: "0x29376d0530b8e87bfe51677de4b4aa16bd3344530c5619e5b1b8d9564ecabfe3",
      admin_cap: "0xe228fe69640b80e586a60d0391fc135fd9907c0f5e0ddfc5240f1de04f2c3194",
      market_registry_wlp: "0x45b6526d909b7b734a4a2c5ccf52957be2c9df7c3b625236bff8ec8fc22a2efe",
      markets: {
        BTCUSD: {
          market: "0xeaa0a6c993d0d04ad603eccca37c54895318e140489ee63d198bdf80626720ad",
          config: "0xa1debca2cf0d5087fac18a97439814352dbbc327034f3d0277614da83252a2ff",
        },
        ETHUSD: {
          market: "0x48182312da1a1301cf23e4d811f4257125ae86dda1142494a8809188292c96b6",
          config: "0x99989554e37e5a05357c74fb2dee100e87ef00e419dd0098348626caac2a368b",
        },
      },
    },
    prediction: {
      global_config: "0x3e2d7bfce29e077f13f9feaf68af62410872817be476b2708540a0d5b23c5936",
      admin_cap: "0x31acc29c6f6171a86ad5583e4610d75bdd9bcc71e16b46b1b994770743cdc782",
      market_registries: {
        USD: "0x6571c67131ea645bd3fd747c2b4c387f23ac80d83317f82f495cabfeadc512e0",
      },
      settlement_coin_types: {
        USD: "0x6321b712685d4c4921c15ff4790d7a9a2b2b7d3b44f8b19a2304e60ca3ad26c7::usd::USD",
      },
      claimable_link_config: "0x39e9b1fa73e5a544acbe94409f6784c737ff5f64aab9094bbfa1043abc848eb2",
      gift_admin_cap: stub(0x91f7),
    },
    oracle: {
      oracle: "0x765d448f496d798dcf8b5488bb6452abe3ea820318f1ca4cbe803796cf5bcad7",
      listing_cap: "0x462b633fb4dceb99d2a1c4baec9f9b48e9e8215226979ba23fdbe8cc5d969fa9",
      aggregators: {
        BTCUSD: "0x9ad3e78a5f27e5c86497419ebba6e749fc68646da14adc1a7d2d48f5858b1347",
        ETHUSD: "0x924034dee2b93741b6ef40721531045d97f4fa34e18d086333cc4ebf784ee27f",
        USDCUSD: "0xae2b4871a1db6453d870c20a0a3a3d8f59c74e1b864e485f86fea31c31a9d0e4",
      },
    },
    wlp: {
      pool: "0xb8b23b9554879326224a5dbe615642956dcdfebde90618c832d14642d91f010c",
      aum: "0xa64fb2cac92ac3b31aefc799c5dd9ba0ed87b3049deda81fce0719f1b2081ce7",
      currency_type: stub(0x1c0),
      metadata_cap: stub(0x1c1),
      pool_tokens: { USDCUSD: USD_TYPE },
    },
    staking: {
      admin_cap: stub(0x57a),
      pools: { WLP: "0xa5da612cf5bd9c5bc90495e67a12cbbd1fbf4d872886d5cd9d95022058624830" },
      rewarders: {},
    },
    account: {
      registry: "0xde28a18a1cecb0486d77ef371b08695029e183bc6910455fbe2c5cb463cb0861",
      admin_cap: "0x3aa99bae17507335c5c21b4ac65a82b381c7cf6e7959dd2785c447d8a99b7889",
    },
    referral: {
      table: "0xb008a69a277ed7a62318566fd1bba6bc213cdd642232cf62ed3bf58fe437515f",
    },
    // The singular `registry` / `credit_type` are the USD stack's legacy
    // aliases of `registries.USD`; the map is what the document is keyed by
    // now (one stack per credit coin), so the two must agree.
    credit: {
      registry: "0xd3c432ee9b0bb49a8d8af00a35b357649d592e7c851ce9a8fd02eb665c4dafb7",
      credit_type: USD_TYPE,
      registries: {
        USD: {
          registry: "0xd3c432ee9b0bb49a8d8af00a35b357649d592e7c851ce9a8fd02eb665c4dafb7",
          credit_type: USD_TYPE,
          decimals: 6,
          metadata_cap: stub(0x05d),
        },
      },
    },
    custody: {
      vault: "0xa16c7b06afc1baeedd9acb5f590d14bbb6a887df6e810a72e7709acb764c5b71",
      assets: [
        {
          name: "MOCK_USDC",
          type: "0x7ccd477e884ec74f960b23a8b34b7d87999e4d7ee0dde738a0c25f46200f201a::mock_usdc::MOCK_USDC",
          decimal: 6,
          mint_fee_scaled: "0",
          burn_fee_scaled: "1000000",
          min_burn_amount: "0",
        },
        {
          name: "MOCK_USDSUI",
          type: "0xc0fad30bc21babe3b8b51c6a4c380d27b61a47e34b26968daf20315da0e35016::mock_usdsui::MOCK_USDSUI",
          decimal: 6,
          mint_fee_scaled: "0",
          burn_fee_scaled: "1000000",
          min_burn_amount: "0",
        },
      ],
      vaults: {
        USD: {
          vault: "0xa16c7b06afc1baeedd9acb5f590d14bbb6a887df6e810a72e7709acb764c5b71",
          assets: [
            {
              name: "MOCK_USDC",
              type: "0x7ccd477e884ec74f960b23a8b34b7d87999e4d7ee0dde738a0c25f46200f201a::mock_usdc::MOCK_USDC",
              decimal: 6,
              mint_fee_scaled: "0",
              burn_fee_scaled: "1000000",
              min_burn_amount: "0",
            },
          ],
        },
      },
    },
    bridge: {
      state: stub(0x7a1b),
      emitter_cap: stub(0x6a1b),
      wormhole_state: stub(0x9b2c),
      limits: {
        max_mint_per_tx: "1000000000000",
        max_burn_per_tx: "1000000000000",
        daily_mint: "10000000000000",
        daily_burn: "10000000000000",
        personal_burn: { cap_amount: "1000000000000", window_ms: "86400000" },
      },
    },
    withdrawal_queue: {
      queue: stub(0x4a1b),
      executors: [stub(0x3e1a)],
      queues: {
        USD: { queue: stub(0x4a1b), executors: [stub(0x3e1a)] },
      },
    },
    usd: {
      metadata_cap: stub(0x05d),
    },
  },
  oracle_rules: {
    waterx: {
      package: "waterx_rule",
      rule_config_object: "0x9589a1f56c631dc8b2b86b8c186e95baa2c1a85b433373a8266fa377137e6e38",
      enclave: {
        object: "0x1273470e0ade24beae168bd5aa16e50bf54c8c9e33d7b4d105fcb425f9468680",
        config: "0xa4ea6c16cd136056e6a77d71185126da6187e7435b91ddf255d8462c95cd501d",
        cap: stub(0xe0c),
        pubkey: "03baaa84a2a1d05b3a3563223b114ea62cfd6141b86ab71f1d54de3f88cf90a6",
      },
      // The quote-center's declared feed list — every fixture symbol, so the
      // waterx leg covers the same tickers it did when the served set was
      // the `symbols` universe.
      feeds: { BTCUSD: {}, ETHUSD: {}, USDCUSD: {} },
    },
    constant: {
      package: "constant_rule",
      rule_config_object: "0xc04574571e0002000000000000000000000000000000000000000000c0577cf9",
      constant_prices: {},
    },
    pyth_lazer: {
      package: "pyth_lazer_rule",
      lazer_state_object: "0xe2b9096a5ea341a9f1eef126b2203727e29e73fdb0641ade2e1e32942f97e4d8",
      lazer_config_object: "0x31baf383d1c77350cc2ce9422fa1e2f9e0c65cf3f310401b149ca2498362c92d",
      lazer_feed_ids: { BTCUSD: 1, ETHUSD: 2, USDCUSD: 7 },
    },
  },
  evm: { bridge: { chains: {} } },
};

/** The parsed + package-asserted document — what `client.config` holds. */
export const MOCK_TESTNET_CONFIG: WaterXConfig = parseConfigDocument(
  MOCK_TESTNET_CONFIG_RAW,
  "TESTNET",
);

/** Collateral Move type used in most testnet PTB examples. */
export const MOCK_USDC_TYPE = MOCK_TESTNET_CONFIG.objects.wlp.pool_tokens.USDCUSD!;

/** Backing-asset Move type registered on the native-custody vault (first asset). */
export const MOCK_CUSTODY_ASSET_TYPE = MOCK_TESTNET_CONFIG.objects.custody.assets[0]!.type;

/** CREDIT CoinType minted by the native-custody PSM. */
export const MOCK_CREDIT_TYPE = MOCK_TESTNET_CONFIG.objects.credit.credit_type;

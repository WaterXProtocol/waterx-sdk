/**
 * Minimal canonical testnet-shaped config for offline unit tests.
 * Values mirror `waterx-config/main/testnet.json` (BTCUSD / ETHUSD / USDCUSD).
 */
import type { WaterXConfig } from "../../../../src/perp/config.ts";

export const MOCK_TESTNET_CONFIG: WaterXConfig = {
  network: "testnet",
  chain_id: "4c78adac",
  packages: {
    bucket_framework: {
      published_at: "0x0cdfc09284014fd36bbb19da8ab1c60056ca207d4c866e78dc01ca8e51dac790",
      original_id: "0x0cdfc09284014fd36bbb19da8ab1c60056ca207d4c866e78dc01ca8e51dac790",
      version: 1,
    },
    waterx_referral: {
      published_at: "0x0ab918a0dd576e44b84f14ed4a2329030c6c07e09f44e82c544b23f3ddbf6b7f",
      original_id: "0x0ab918a0dd576e44b84f14ed4a2329030c6c07e09f44e82c544b23f3ddbf6b7f",
      version: 1,
      referral_table: "0xb008a69a277ed7a62318566fd1bba6bc213cdd642232cf62ed3bf58fe437515f",
    },
    // NO pyth_rule / pyth_sponsor_rule blocks: retired in 5.0.0 — the schema
    // slot is optional and the SDK never reads them, so the fixture mirrors a
    // post-retirement config republish. Tests that pin "config may still
    // carry the legacy block" clone the fixture and add one.
    // Real deployed testnet entry (feeds trimmed to the fixture's tickers).
    // `enabled` mirrors the JSON but is never read for routing — routing is the
    // derived fed set alone.
    pyth_lazer_rule: {
      published_at: "0xc192ffd76818fd029ee4493748be7251e3fc51ce0f2803bede8f9970c40a8739",
      original_id: "0xc192ffd76818fd029ee4493748be7251e3fc51ce0f2803bede8f9970c40a8739",
      version: 1,
      upgrade_capability: "0xc45f8b3d0e91de6c52e734fd1e865a4198a856bcae340adf2775cd9ac967e43f",
      config: "0x31baf383d1c77350cc2ce9422fa1e2f9e0c65cf3f310401b149ca2498362c92d",
      state: "0xe2b9096a5ea341a9f1eef126b2203727e29e73fdb0641ade2e1e32942f97e4d8",
      enabled: true,
      feeds: { BTCUSD: 1, ETHUSD: 2, USDCUSD: 7 },
    },
    // Real deployed testnet waterx_rule (v2). `enabled` mirrors the JSON but is
    // read for routing only via `deriveOracleSources` (an explicit `false` disables).
    // `feeds` keyed by oracle ticker (== the SDK's supported-ticker set).
    waterx_rule: {
      published_at: "0xe1500e0c522eab37d2487e2d0babb08c48a425474455ba262f0caa339c503524",
      original_id: "0xa74191aad31907bbbd870626dd251b797a12a3841b0fdaf2af1e1cb5952572fb",
      version: 2,
      config: "0x9589a1f56c631dc8b2b86b8c186e95baa2c1a85b433373a8266fa377137e6e38",
      enclave_config: "0xa4ea6c16cd136056e6a77d71185126da6187e7435b91ddf255d8462c95cd501d",
      enclave: "0x1273470e0ade24beae168bd5aa16e50bf54c8c9e33d7b4d105fcb425f9468680",
      enabled: true,
      feeds: {
        BTCUSD: { ticker: "BTCUSDT" },
        ETHUSD: { ticker: "ETHUSDT" },
        USDCUSD: { ticker: "USDCUSDT" },
      },
    },
    constant_rule: {
      published_at: "0xc04574571e0001000000000000000000000000000000000000000000c057ab1e",
      original_id: "0xc04574571e0001000000000000000000000000000000000000000000c057ab1e",
      version: 1,
      config: "0xc04574571e0002000000000000000000000000000000000000000000c0577cf9",
      // Empty by default so the shared fixture keeps every ticker on the live
      // sources. Constant-routing tests clone the config and populate this map.
      feeds: {},
    },
    waterx_account: {
      published_at: "0x2d9b1eb3958fad8ff619d30d959351ecce851fcea231fa362b36d52c76b339b5",
      original_id: "0x2d9b1eb3958fad8ff619d30d959351ecce851fcea231fa362b36d52c76b339b5",
      version: 1,
      admin_cap: "0x3aa99bae17507335c5c21b4ac65a82b381c7cf6e7959dd2785c447d8a99b7889",
      account_registry: "0xde28a18a1cecb0486d77ef371b08695029e183bc6910455fbe2c5cb463cb0861",
    },
    waterx_oracle: {
      published_at: "0x6b244c75800a105900b3fa0c2ac005a057ebabe8c3d452742a1690e3dc88229a",
      original_id: "0x6b244c75800a105900b3fa0c2ac005a057ebabe8c3d452742a1690e3dc88229a",
      version: 1,
      listing_cap: "0x462b633fb4dceb99d2a1c4baec9f9b48e9e8215226979ba23fdbe8cc5d969fa9",
      oracle: "0x765d448f496d798dcf8b5488bb6452abe3ea820318f1ca4cbe803796cf5bcad7",
      aggregators: {
        BTCUSD: "0x9ad3e78a5f27e5c86497419ebba6e749fc68646da14adc1a7d2d48f5858b1347",
        ETHUSD: "0x924034dee2b93741b6ef40721531045d97f4fa34e18d086333cc4ebf784ee27f",
        USDCUSD: "0xae2b4871a1db6453d870c20a0a3a3d8f59c74e1b864e485f86fea31c31a9d0e4",
      },
    },
    waterx_perp: {
      published_at: "0x8f699ee7e645d6b73fa5b10536246ec13275aab81a8608675fedf51658d201aa",
      original_id: "0x9f40b37878f252b3ea20d1a73e3c35b4314ea66821599e62742119e375112419",
      version: 2,
      admin_cap: "0xe228fe69640b80e586a60d0391fc135fd9907c0f5e0ddfc5240f1de04f2c3194",
      global_config: "0x29376d0530b8e87bfe51677de4b4aa16bd3344530c5619e5b1b8d9564ecabfe3",
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
    waterx_perp_view: {
      published_at: "0xada57121b6a0988eb3149e613ee3acf5e10809e5fed6faa1741e55f5eeb3260b",
      original_id: "0xada57121b6a0988eb3149e613ee3acf5e10809e5fed6faa1741e55f5eeb3260b",
      version: 1,
    },
    waterx_staking: {
      published_at: "0x33b128a17cb484919ff90e2035d5b8914acee808b8ce040cff723cce15214862",
      original_id: "0x33b128a17cb484919ff90e2035d5b8914acee808b8ce040cff723cce15214862",
      version: 1,
      pools: { WLP: "0xa5da612cf5bd9c5bc90495e67a12cbbd1fbf4d872886d5cd9d95022058624830" },
    },
    wlp: {
      published_at: "0xe6112759a0d6f503ef24050a891bd3cd1ced587a87a83b3fa9c96a8cc417558c",
      original_id: "0xe6112759a0d6f503ef24050a891bd3cd1ced587a87a83b3fa9c96a8cc417558c",
      version: 1,
      wlp_pool: "0xb8b23b9554879326224a5dbe615642956dcdfebde90618c832d14642d91f010c",
      wlp_aum: "0xa64fb2cac92ac3b31aefc799c5dd9ba0ed87b3049deda81fce0719f1b2081ce7",
      pool_tokens: {
        USDCUSD: "0x3d6fd5e79c5134f94523f5d6d24a96ecf9f9af35bdbf9e6af87f5a6dbb032efe::usd::USD",
      },
    },
    waterx_credit: {
      published_at: "0xf6750397c266eca69451691b5125fbf35e5c4575c98884ac3ab6f084493fd497",
      credit_registry: "0xd3c432ee9b0bb49a8d8af00a35b357649d592e7c851ce9a8fd02eb665c4dafb7",
      credit_type: "0x3d6fd5e79c5134f94523f5d6d24a96ecf9f9af35bdbf9e6af87f5a6dbb032efe::usd::USD",
    },
    wormhole_bridge: {
      published_at: "0x8a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12",
      wormhole_state: "0x9b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
      bridge: "0x7a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234",
      emitter_cap: "0x6a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234",
    },
    withdrawal_queue: {
      published_at: "0x5a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234",
      queue: "0x4a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234",
    },
    native_custody: {
      published_at: "0x45c2074e892975f0fb62b934824531c04d43f6e7f00bf8d1e7ce2556e84fd6ee",
      vault: "0xa16c7b06afc1baeedd9acb5f590d14bbb6a887df6e810a72e7709acb764c5b71",
      assets: [
        {
          type: "0x7ccd477e884ec74f960b23a8b34b7d87999e4d7ee0dde738a0c25f46200f201a::mock_usdc::MOCK_USDC",
          decimal: 6,
          mint_fee_scaled: "0",
          burn_fee_scaled: "1000000",
          min_burn_amount: "0",
        },
        {
          type: "0xc0fad30bc21babe3b8b51c6a4c380d27b61a47e34b26968daf20315da0e35016::mock_usdsui::MOCK_USDSUI",
          decimal: 6,
          mint_fee_scaled: "0",
          burn_fee_scaled: "1000000",
          min_burn_amount: "0",
        },
      ],
    },
  },
};

/** Collateral Move type used in most testnet PTB examples. */
export const MOCK_USDC_TYPE = MOCK_TESTNET_CONFIG.packages.wlp!.pool_tokens.USDCUSD;

/** Backing-asset Move type registered on the native-custody vault (first asset). */
export const MOCK_CUSTODY_ASSET_TYPE = MOCK_TESTNET_CONFIG.packages.native_custody!.assets[0]!.type;

/** CREDIT CoinType minted by the native-custody PSM. */
export const MOCK_CREDIT_TYPE = MOCK_TESTNET_CONFIG.packages.waterx_credit!.credit_type;

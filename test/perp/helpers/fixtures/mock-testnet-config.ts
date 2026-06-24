/**
 * Minimal canonical testnet-shaped config for offline unit tests.
 * Values mirror `waterx-config/main/testnet.json` (BTCUSD / ETHUSD / USDCUSD).
 */
import type { WaterXConfig } from "../../../../src/config.ts";

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
    pyth_rule: {
      published_at: "0x4b56cbbdbc31b975c6825effeeadaf76819650623b4d69065f8a723a9ed06fa0",
      original_id: "0x4b56cbbdbc31b975c6825effeeadaf76819650623b4d69065f8a723a9ed06fa0",
      version: 1,
      config: "0x3607ace703da413919d9aedcd4cad2f1b4897bb5740a8f91fb09a635b22b0041",
      feeds: {
        BTCUSD: {
          feed_id: "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b",
          price_info_object: "0x72431a238277695d3f31e4425225a4462674ee6cceeea9d66447b210755fffba",
        },
        ETHUSD: {
          feed_id: "0xca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6",
          price_info_object: "0x4fde30cb8a5dc3cfee1c1c358fc66dc308408827efb217247c7ba54d76ccbee9",
        },
        USDCUSD: {
          feed_id: "0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722",
          price_info_object: "0x9c4dd4008297ffa5e480684b8100ec21cc934405ed9a25d4e4d7b6259aad9c81",
        },
      },
    },
    pyth_sponsor_rule: {
      published_at: "0xad089846b632a810516115180d20d26812c552860f9e8d7f0c6dbd66e910b2eb",
      original_id: "0xad089846b632a810516115180d20d26812c552860f9e8d7f0c6dbd66e910b2eb",
      version: 1,
      pyth_sponsor: "0x1528bdc52a60aaab31a9501001dfa69377708e4c2296c3d2e25b9ca0f4e9e256",
    },
    constant_rule: {
      published_at: "0xc04574571e0001000000000000000000000000000000000000000000c057ab1e",
      original_id: "0xc04574571e0001000000000000000000000000000000000000000000c057ab1e",
      version: 1,
      config: "0xc04574571e0002000000000000000000000000000000000000000000c0577cf9",
      // Empty by default so the shared fixture keeps every ticker on Pyth.
      // Constant-routing tests clone the config and populate this map.
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
      trusted_emitters: [],
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

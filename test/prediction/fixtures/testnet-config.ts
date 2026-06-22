import type { WaterxPredictionConfig } from "~predict/config.ts";

/** Mirrors WaterXProtocol/waterx-config `testnet.json` (2026-06 redeploy). */
export const TESTNET_FIXTURE_IDS = {
  packageId: "0x99be07b27dbbd846eec72213f0ec221b3e7d38c8bfdee3cbf578b9bfa5df3481",
  bucketFrameworkPackageId: "0x0cdfc09284014fd36bbb19da8ab1c60056ca207d4c866e78dc01ca8e51dac790",
  waterxAccountPackageId: "0xff4afb7305886992843b700a363ebe4ae0dc6a727c4941043b565d0a3a7eb61d",
  globalConfig: "0x3e2d7bfce29e077f13f9feaf68af62410872817be476b2708540a0d5b23c5936",
  marketRegistry: "0x6571c67131ea645bd3fd747c2b4c387f23ac80d83317f82f495cabfeadc512e0",
  accountRegistry: "0xf21bc5a813637998a1ff40c6d412a795faeb94cfad25b3370d518b55b0e5ec41",
  predictionAdminCap: "0x31acc29c6f6171a86ad5583e4610d75bdd9bcc71e16b46b1b994770743cdc782",
  waterxAccountAdminCap: "0xad7493ea56fe66c18b2c7f41123603968352eb54d0dda8da67c8fd78d7c575f6",
  settlementCoinType:
    "0x6321b712685d4c4921c15ff4790d7a9a2b2b7d3b44f8b19a2304e60ca3ad26c7::usd::USD",
  waterxPredictionGiftPackageId:
    "0x2cf6f6b047b4e0b97f33a77a75d6fa39175600894fe8615ef45caec2e59f023f",
  claimableLinkConfig: "0x39e9b1fa73e5a544acbe94409f6784c737ff5f64aab9094bbfa1043abc848eb2",
  waterxReferralPackageId: "0x0ab918a0dd576e44b84f14ed4a2329030c6c07e09f44e82c544b23f3ddbf6b7f",
  referralTable: "0xb008a69a277ed7a62318566fd1bba6bc213cdd642232cf62ed3bf58fe437515f",
} as const;

/**
 * Test-only raw waterx-config fixture. Production SDK clients fetch this shape
 * from WaterXProtocol/waterx-config.
 */
export const TESTNET_FIXTURE_CONFIG: WaterxPredictionConfig = {
  network: "testnet",
  packages: {
    bucket_framework: {
      published_at: TESTNET_FIXTURE_IDS.bucketFrameworkPackageId,
    },
    waterx_account: {
      published_at: TESTNET_FIXTURE_IDS.waterxAccountPackageId,
      admin_cap: TESTNET_FIXTURE_IDS.waterxAccountAdminCap,
      account_registry: TESTNET_FIXTURE_IDS.accountRegistry,
    },
    waterx_prediction: {
      published_at: TESTNET_FIXTURE_IDS.packageId,
      admin_cap: TESTNET_FIXTURE_IDS.predictionAdminCap,
      global_config: TESTNET_FIXTURE_IDS.globalConfig,
      market_registries: {
        USD: TESTNET_FIXTURE_IDS.marketRegistry,
      },
      settlement_coin_types: {
        USD: TESTNET_FIXTURE_IDS.settlementCoinType,
      },
    },
    waterx_prediction_gift: {
      published_at: TESTNET_FIXTURE_IDS.waterxPredictionGiftPackageId,
      claimable_link_config: TESTNET_FIXTURE_IDS.claimableLinkConfig,
    },
    waterx_referral: {
      published_at: TESTNET_FIXTURE_IDS.waterxReferralPackageId,
      referral_table: TESTNET_FIXTURE_IDS.referralTable,
    },
  },
};

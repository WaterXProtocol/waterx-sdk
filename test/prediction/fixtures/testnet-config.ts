import type { WaterxPredictionConfig } from "~predict/config.ts";

export const TESTNET_FIXTURE_IDS = {
  packageId: "0x0ced3be529195de0e9f3714622bff49feb4e72ef8588e0d53594324d961b6738",
  bucketFrameworkPackageId: "0x0cdfc09284014fd36bbb19da8ab1c60056ca207d4c866e78dc01ca8e51dac790",
  waterxAccountPackageId: "0xaca20506c4b14cfd2ea767d68e3dd489af082b2d0f6ed6f33b32e78abeaff2cc",
  globalConfig: "0xade50b742d24e938196922f79e15ffeb6d98ad0c58eab005d3bb5ad80afad14c",
  marketRegistry: "0x1e973f83ba2f08fcbdd91953d0ec2c7d88e7f97aa83ceb8cab89f30e6daaa717",
  accountRegistry: "0x7f3cc3c674daff974efb81fc84ae816df58797b352d5d45453fddbd5380fa292",
  predictionAdminCap: "0xb07b11774c595c4c5fc0d1299d04c4dc6eea248b7ec1bb246fe31077107c12ff",
  waterxAccountAdminCap: "0xa95510259d9995fb9440ffb5c16c21b64e0ae5287509be84ec61ade1d6bf273a",
  settlementCoinType:
    "0x5b60857dc403e65a3406c65402765e518259ba3394588f9528aa4f895378764e::usd::USD",
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
  },
};

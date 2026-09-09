/**
 * The prediction line's view of the shared offline fixture — one consolidated
 * `waterx-config` document serves both lines, so the ids the prediction tests
 * assert against are read off it rather than duplicated here.
 */
import { MOCK_TESTNET_CONFIG } from "../../helpers/fixtures/mock-testnet-config.ts";

const { packages, objects } = MOCK_TESTNET_CONFIG;

export const TESTNET_FIXTURE_IDS = {
  packageId: packages.waterx_prediction.published_at,
  bucketFrameworkPackageId: packages.bucket_framework.published_at,
  waterxAccountPackageId: packages.waterx_account.published_at,
  globalConfig: objects.prediction.global_config,
  marketRegistry: objects.prediction.market_registries.USD!,
  accountRegistry: objects.account.registry,
  predictionAdminCap: objects.prediction.admin_cap,
  waterxAccountAdminCap: objects.account.admin_cap,
  settlementCoinType: objects.prediction.settlement_coin_types.USD!,
  waterxPredictionGiftPackageId: packages.waterx_prediction_gift.published_at,
  claimableLinkConfig: objects.prediction.claimable_link_config,
  waterxReferralPackageId: packages.waterx_referral.published_at,
  referralTable: objects.referral.table,
} as const;

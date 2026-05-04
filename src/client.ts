/**
 * WaterX Protocol client.
 *
 * Uses SuiGrpcClient (gRPC) for all operations including simulateTransaction.
 * JSON-RPC is not used (deprecated July 2026).
 */

import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";

import {
  MAINNET_COLLATERALS,
  MAINNET_MARKETS,
  MAINNET_OBJECTS,
  MAINNET_PACKAGE_IDS,
  MAINNET_TYPES,
  PYTH_HERMES_ENDPOINT,
  PYTH_STATE_ID,
  PYTH_WORMHOLE_STATE_ID,
  TESTNET_COLLATERALS,
  TESTNET_MARKETS,
  TESTNET_OBJECTS,
  TESTNET_PACKAGE_IDS,
  TESTNET_TYPES,
  type BaseAsset,
  type CollateralAsset,
  type ExtendedBaseAsset,
  type LegacyBaseAsset,
  type Network,
} from "./constants.ts";
import type { PythConfig } from "./utils/pyth.ts";

// ======== gRPC base URLs by network ========

const GRPC_URLS: Record<string, string> = {
  mainnet: "https://fullnode.mainnet.sui.io:443",
  testnet: "https://fullnode.testnet.sui.io:443",
};

// ======== Config ========

/** Per-market config: object IDs and token type. */
export interface MarketEntry {
  /** Market<BASE_TOKEN, LP_TOKEN> shared object ID */
  marketId: string;
  /** PriceAggregator<BASE_TOKEN> object ID */
  aggregatorId: string;
  /** Pyth PriceInfoObject ID */
  priceInfoId: string;
  /** Fully-qualified Move type string for the base token */
  baseType: string;
  /** Pyth price feed key (e.g. "BTC/USD") */
  feedKey: string;
}

export interface WaterXConfig {
  network: Network;
  /** gRPC base URL (default: public Mysten fullnode) */
  grpcUrl?: string;
  /** waterx_perp package ID */
  packageId: string;
  /** reward_distributor package ID */
  rewardDistributorPackageId?: string;
  /** Shared RewardDistributor object ID */
  rewardDistributorId?: string;
  /** Default reward token types for the reward distributor */
  rewardDistributorRewardTokenTypes?: string[];
  /** bucket_oracle package ID */
  bucketOraclePackageId?: string;
  /** bucket_framework package ID */
  bucketFrameworkPackageId?: string;
  /** pyth_rule package ID (testnet/mainnet) */
  pythRulePackageId: string;
  /** pyth_rule Config object ID (testnet/mainnet) */
  pythRuleConfigId: string;
  /** pyth_sponsor_rule package ID */
  pythSponsorRulePackageId?: string;
  /** Shared PythSponsor object ID */
  pythSponsorId?: string;

  /** Shared GlobalConfig object ID */
  globalConfig: string;
  /** Shared ReferralTable object ID */
  referralTable: string;
  /** Shared AccountRegistry object ID */
  accountRegistry: string;
  /** Shared WlpPool object ID */
  wlpPool: string;

  /**
   * Markets keyed by base asset symbol. The 13 legacy markets are guaranteed
   * present on every network; the 200K-tier batch (`ExtendedBaseAsset`) is
   * mainnet-only, so those keys are optional.
   */
  markets: Record<LegacyBaseAsset, MarketEntry> & Partial<Record<ExtendedBaseAsset, MarketEntry>>;

  /** Collateral token configs keyed by CollateralAsset */
  collaterals: Record<
    CollateralAsset,
    {
      type: string;
      aggregatorId: string;
      priceInfoId: string;
      feedKey: string;
    }
  >;

  wlpType: string;

  /** @deprecated v2: read `collaterals.USDC.aggregatorId`. Retained as an alias. */
  usdcAggregator?: string;
  /** @deprecated v2: read `collaterals.USDC.priceInfoId`. Retained as an alias. */
  usdcPriceInfoId?: string;
  /** @deprecated v2: read `collaterals.USDC.type`. Retained as an alias. */
  usdcType?: string;

  /** Pyth oracle config (testnet/mainnet) */
  pythConfig?: PythConfig;
}

/**
 * Creates a testnet config using deployed object IDs.
 * Uses real Pyth oracle (no mock prices).
 */
export function createTestnetConfig(): WaterXConfig {
  return {
    network: "TESTNET",
    packageId: TESTNET_PACKAGE_IDS.WATERX_PERP,
    rewardDistributorPackageId: TESTNET_PACKAGE_IDS.REWARD_DISTRIBUTOR,
    bucketOraclePackageId: TESTNET_PACKAGE_IDS.BUCKET_ORACLE,
    bucketFrameworkPackageId: TESTNET_PACKAGE_IDS.BUCKET_FRAMEWORK,
    pythRulePackageId: TESTNET_PACKAGE_IDS.PYTH_RULE,
    pythRuleConfigId: TESTNET_OBJECTS.PYTH_RULE_CONFIG,
    pythSponsorRulePackageId: TESTNET_PACKAGE_IDS.PYTH_SPONSOR_RULE,
    pythSponsorId: TESTNET_OBJECTS.PYTH_SPONSOR,
    globalConfig: TESTNET_OBJECTS.GLOBAL_CONFIG,
    referralTable: TESTNET_OBJECTS.REFERRAL_TABLE,
    accountRegistry: TESTNET_OBJECTS.ACCOUNT_REGISTRY,
    wlpPool: TESTNET_OBJECTS.WLP_POOL,
    rewardDistributorId: TESTNET_OBJECTS.REWARD_DISTRIBUTOR,
    markets: TESTNET_MARKETS,
    collaterals: TESTNET_COLLATERALS,
    // v1 aliases (deprecated — prefer `collaterals.USDC.*`)
    usdcAggregator: TESTNET_COLLATERALS.USDC.aggregatorId,
    usdcPriceInfoId: TESTNET_COLLATERALS.USDC.priceInfoId,
    usdcType: TESTNET_COLLATERALS.USDC.type,
    wlpType: TESTNET_TYPES.WLP,
    rewardDistributorRewardTokenTypes: [TESTNET_TYPES.SUI],
    pythConfig: {
      pythStateId: PYTH_STATE_ID.TESTNET,
      wormholeStateId: PYTH_WORMHOLE_STATE_ID.TESTNET,
      hermesEndpoint: PYTH_HERMES_ENDPOINT.TESTNET,
    },
  };
}

/**
 * Creates a mainnet config using deployed object IDs.
 */
export function createMainnetConfig(): WaterXConfig {
  return {
    network: "MAINNET",
    packageId: MAINNET_PACKAGE_IDS.WATERX_PERP,
    rewardDistributorPackageId: MAINNET_PACKAGE_IDS.REWARD_DISTRIBUTOR,
    bucketOraclePackageId: MAINNET_PACKAGE_IDS.BUCKET_ORACLE,
    bucketFrameworkPackageId: MAINNET_PACKAGE_IDS.BUCKET_FRAMEWORK,
    pythRulePackageId: MAINNET_PACKAGE_IDS.PYTH_RULE,
    pythRuleConfigId: MAINNET_OBJECTS.PYTH_RULE_CONFIG,
    pythSponsorRulePackageId: MAINNET_PACKAGE_IDS.PYTH_SPONSOR_RULE,
    pythSponsorId: MAINNET_OBJECTS.PYTH_SPONSOR,
    globalConfig: MAINNET_OBJECTS.GLOBAL_CONFIG,
    referralTable: MAINNET_OBJECTS.REFERRAL_TABLE,
    accountRegistry: MAINNET_OBJECTS.ACCOUNT_REGISTRY,
    wlpPool: MAINNET_OBJECTS.WLP_POOL,
    rewardDistributorId: MAINNET_OBJECTS.REWARD_DISTRIBUTOR,
    markets: MAINNET_MARKETS,
    collaterals: MAINNET_COLLATERALS,
    usdcAggregator: MAINNET_COLLATERALS.USDC.aggregatorId,
    usdcPriceInfoId: MAINNET_COLLATERALS.USDC.priceInfoId,
    usdcType: MAINNET_COLLATERALS.USDC.type,
    wlpType: MAINNET_TYPES.WLP,
    rewardDistributorRewardTokenTypes: [MAINNET_TYPES.SUI],
    pythConfig: {
      pythStateId: PYTH_STATE_ID.MAINNET,
      wormholeStateId: PYTH_WORMHOLE_STATE_ID.MAINNET,
      hermesEndpoint: PYTH_HERMES_ENDPOINT.MAINNET,
    },
  };
}

// ======== Client ========

export class WaterXClient {
  /** gRPC client — all operations. */
  grpcClient: SuiGrpcClient;
  config: WaterXConfig;

  constructor(config: WaterXConfig) {
    this.config = config;
    const net = config.network.toLowerCase() as "mainnet" | "testnet";

    this.grpcClient = new SuiGrpcClient({
      baseUrl: config.grpcUrl ?? GRPC_URLS[net],
      network: net,
    });
  }

  /** Creates a WaterXClient configured for mainnet. */
  static mainnet(opts?: { grpcUrl?: string }): WaterXClient {
    const config = createMainnetConfig();
    if (opts?.grpcUrl) config.grpcUrl = opts.grpcUrl;
    return new WaterXClient(config);
  }

  /** Creates a WaterXClient configured for testnet. */
  static testnet(opts?: { grpcUrl?: string }): WaterXClient {
    const config = createTestnetConfig();
    if (opts?.grpcUrl) config.grpcUrl = opts.grpcUrl;
    return new WaterXClient(config);
  }

  // ========================================================
  // gRPC convenience wrappers (primary path)
  // ========================================================

  getObject(objectId: string) {
    return this.grpcClient.getObject({ objectId });
  }

  getObjects(objectIds: string[]) {
    return this.grpcClient.getObjects({ objectIds });
  }

  listOwnedObjects(owner: string) {
    return this.grpcClient.listOwnedObjects({ owner });
  }

  listCoins(params: { owner: string; coinType?: string }) {
    return this.grpcClient.listCoins(params);
  }

  getBalance(params: { owner: string; coinType?: string }) {
    return this.grpcClient.getBalance(params);
  }

  listDynamicFields(parentId: string): ReturnType<SuiGrpcClient["listDynamicFields"]> {
    return this.grpcClient.listDynamicFields({ parentId });
  }

  getDynamicField(parentId: string, name: { type: string; bcs: Uint8Array }) {
    return this.grpcClient.getDynamicField({ parentId, name });
  }

  waitForTransaction(digest: string) {
    return this.grpcClient.waitForTransaction({ digest });
  }

  // ========================================================
  // simulateTransaction (gRPC — returns Move return values)
  // ========================================================

  /**
   * Simulates a transaction via gRPC and returns results including
   * Move return values (commandResults). Replaces JSON-RPC devInspect.
   */
  async simulate(tx: Transaction) {
    return this.grpcClient.simulateTransaction({
      transaction: tx,
      include: { commandResults: true },
    });
  }

  // ========================================================
  // Transaction execution (gRPC primary)
  // ========================================================

  async signAndExecuteTransaction(params: {
    signer: {
      toSuiAddress: () => string;
    } & import("@mysten/sui/cryptography").Signer;
    transaction: Transaction;
  }) {
    return this.grpcClient.signAndExecuteTransaction(params);
  }

  // ========================================================
  // Market / token helpers
  // ========================================================

  /** Returns all supported base assets with their coin types. */
  getBaseAssets(): { asset: BaseAsset; coinType: string }[] {
    return (Object.entries(this.config.markets) as [BaseAsset, MarketEntry][]).map(
      ([asset, entry]) => ({ asset, coinType: entry.baseType }),
    );
  }

  /** Returns all supported collateral assets with their coin types. */
  getCollateralAssets(): { asset: CollateralAsset; coinType: string }[] {
    return (Object.entries(this.config.collaterals) as [CollateralAsset, { type: string }][]).map(
      ([asset, entry]) => ({ asset, coinType: entry.type }),
    );
  }

  /** Returns the MarketEntry for a given base asset symbol. */
  getMarketEntry(base: BaseAsset): MarketEntry {
    const entry = this.config.markets[base];
    if (!entry) throw new Error(`Unknown base asset: ${base}`);
    return entry;
  }

  /** Returns the Market object ID for a given base asset symbol. */
  getMarket(base: BaseAsset): string {
    return this.getMarketEntry(base).marketId;
  }

  /** Returns the collateral config for a given CollateralAsset. */
  getCollateral(collateral: CollateralAsset = "USDC") {
    const entry = this.config.collaterals[collateral];
    if (!entry || !entry.type) throw new Error(`Unknown collateral asset: ${collateral}`);
    return entry;
  }

  /** Returns the PriceAggregator object ID for a given base asset or collateral. */
  getAggregator(tokenOrBase: BaseAsset | CollateralAsset): string {
    if (tokenOrBase in this.config.collaterals) {
      return this.getCollateral(tokenOrBase as CollateralAsset).aggregatorId;
    }
    return this.getMarketEntry(tokenOrBase as BaseAsset).aggregatorId;
  }
}

import type { Transaction } from "@mysten/sui/transactions";

import { BaseLineClient } from "../base-client.ts";
import { loadConfig, type LoadConfigOptions, type WaterxPredictionConfig } from "./config.ts";
import type { Network } from "./constants.ts";

export interface CreateClientOptions extends LoadConfigOptions {
  grpcUrl?: string;
  /** Settlement alias in `packages.waterx_prediction.*` maps. Default: "USD". */
  settlement?: string;
}

export class PredictClient extends BaseLineClient<WaterxPredictionConfig> {
  /** Default settlement alias for prediction registry lookups. */
  settlement: string;

  constructor(
    network: Network,
    config: WaterxPredictionConfig,
    opts: { grpcUrl?: string; settlement?: string } = {},
  ) {
    super(network, config, opts);
    this.settlement = opts.settlement ?? "USD";
  }

  static testnet(params: CreateClientOptions = {}): Promise<PredictClient> {
    return PredictClient.create("TESTNET", params);
  }

  static mainnet(params: CreateClientOptions = {}): Promise<PredictClient> {
    return PredictClient.create("MAINNET", params);
  }

  /**
   * Async factory: fetches the deployment config for `network` and returns
   * a ready-to-use client. Pass `opts.cache=true` to memoize the JSON.
   */
  static async create(
    network: Network = "TESTNET",
    opts: CreateClientOptions = {},
  ): Promise<PredictClient> {
    const config = await loadConfig(network, opts);
    return new PredictClient(network, config, {
      grpcUrl: opts.grpcUrl,
      settlement: opts.settlement,
    });
  }

  /**
   * Simulate with rate-limit retry — the prediction line hammers the public
   * testnet RPC harder (batch claims / dual-path reads), so it backs off on
   * `RESOURCE_EXHAUSTED` where the base client does not.
   */
  override async simulate(tx: Transaction) {
    return withRpcRetry(() => super.simulate(tx));
  }

  // ========================================================
  // Config-schema lookups (prediction-specific)
  // ========================================================

  packageId(): string {
    return this.config.packages.waterx_prediction.published_at;
  }

  bucketFrameworkPackageId(): string {
    return this.config.packages.bucket_framework.published_at;
  }

  waterxAccountPackageId(): string {
    return this.config.packages.waterx_account.published_at;
  }

  globalConfigId(): string {
    return this.config.packages.waterx_prediction.global_config;
  }

  marketRegistry(settlement = this.settlement): string {
    return requireConfigValue(
      this.config.packages.waterx_prediction.market_registries,
      settlement,
      `packages.waterx_prediction.market_registries.${settlement}`,
    );
  }

  accountRegistry(): string {
    return this.config.packages.waterx_account.account_registry;
  }

  settlementCoinType(settlement = this.settlement): string {
    return requireConfigValue(
      this.config.packages.waterx_prediction.settlement_coin_types,
      settlement,
      `packages.waterx_prediction.settlement_coin_types.${settlement}`,
    );
  }

  predictionAdminCap(): string {
    return requireConfigValue(
      this.config.packages.waterx_prediction,
      "admin_cap",
      "packages.waterx_prediction.admin_cap",
    );
  }

  waterxAccountAdminCap(): string {
    return requireConfigValue(
      this.config.packages.waterx_account,
      "admin_cap",
      "packages.waterx_account.admin_cap",
    );
  }

  waterxPredictionGiftPackageId(): string {
    return requireConfigValue(
      this.config.packages.waterx_prediction_gift,
      "published_at",
      "packages.waterx_prediction_gift.published_at",
    );
  }

  claimableLinkConfigId(): string {
    return requireConfigValue(
      this.config.packages.waterx_prediction_gift,
      "claimable_link_config",
      "packages.waterx_prediction_gift.claimable_link_config",
    );
  }

  waterxReferralPackageId(): string {
    return requireConfigValue(
      this.config.packages.waterx_referral,
      "published_at",
      "packages.waterx_referral.published_at",
    );
  }

  referralTableId(): string {
    return requireConfigValue(
      this.config.packages.waterx_referral,
      "referral_table",
      "packages.waterx_referral.referral_table",
    );
  }
}

function requireConfigValue(map: object | undefined, key: string, path: string): string {
  const value = (map as Record<string, unknown> | undefined)?.[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`waterx-config missing ${path}`);
  }
  return value;
}

/**
 * Retry a grpc call on transient `RESOURCE_EXHAUSTED` (HTTP 429) responses from the public
 * testnet RPC. Uses exponential backoff with jitter; bails on the first non-rate-limit error.
 */
async function withRpcRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = (err as { code?: string } | null)?.code;
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit =
        code === "RESOURCE_EXHAUSTED" || /too many requests|rate.?limit/i.test(msg);
      if (!isRateLimit || attempt === maxAttempts - 1) throw err;
      const baseMs = 400 * 2 ** attempt; // 400, 800, 1600, ...
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, baseMs + jitter));
    }
  }
  throw lastErr;
}

import type { SuiClientTypes } from "@mysten/sui/client";
import type { Signer } from "@mysten/sui/cryptography";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import type { Transaction } from "@mysten/sui/transactions";

import {
  loadConfig,
  type LoadConfigOptions,
  type WaterxConfigPackageBase,
  type WaterxPredictionConfig,
} from "./config.ts";
import type { Network } from "./constants.ts";

const GRPC_URLS: Record<Network, string> = {
  MAINNET: "https://fullnode.mainnet.sui.io:443",
  TESTNET: "https://fullnode.testnet.sui.io:443",
};

const MAINNET_CONFIG_URL_REQUIRED =
  "PredictClient mainnet requires opts.configUrl until prediction mainnet config is available in waterx-config.";

export interface CreateClientOptions extends LoadConfigOptions {
  grpcUrl?: string;
  /** Settlement alias in `packages.waterx_prediction.*` maps. Default: "USD". */
  settlement?: string;
}

export class PredictClient {
  /** gRPC client - all RPC including `simulateTransaction`. */
  grpcClient: SuiGrpcClient;
  /** Network identifier in upper case (`MAINNET` / `TESTNET`). */
  network: Network;
  /** Parsed canonical `waterx-config` JSON. */
  config: WaterxPredictionConfig;
  /** Default settlement alias for prediction registry lookups. */
  settlement: string;

  constructor(
    network: Network,
    config: WaterxPredictionConfig,
    opts: { grpcUrl?: string; settlement?: string } = {},
  ) {
    this.network = network;
    this.config = config;
    this.settlement = opts.settlement ?? "USD";
    const baseUrl = opts.grpcUrl ?? config.grpcUrl ?? GRPC_URLS[network];

    this.grpcClient = new SuiGrpcClient({
      baseUrl,
      network: network.toLowerCase() as "mainnet" | "testnet",
    });
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
    if (network === "MAINNET" && !opts.configUrl) {
      throw new Error(MAINNET_CONFIG_URL_REQUIRED);
    }

    const config = await loadConfig(network, opts);
    return new PredictClient(network, config, {
      grpcUrl: opts.grpcUrl,
      settlement: opts.settlement,
    });
  }

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

  async simulate(tx: Transaction) {
    return withRpcRetry(() =>
      this.grpcClient.simulateTransaction({
        transaction: tx,
        include: { commandResults: true },
      }),
    );
  }

  async signAndExecuteTransaction<
    Include extends SuiClientTypes.TransactionInclude = object,
  >(params: {
    signer: { toSuiAddress: () => string } & Signer;
    transaction: Transaction | Uint8Array;
    additionalSignatures?: string[];
    include?: Include & SuiClientTypes.TransactionInclude;
  }) {
    return this.grpcClient.signAndExecuteTransaction(params);
  }

  // ========================================================
  // Shorthand accessors (canonical-schema lookups)
  // ========================================================

  /** All package IDs (`published_at`) keyed by package name. */
  packageIds(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [name, pkg] of Object.entries(this.config.packages)) {
      if (isPublishedPackage(pkg)) out[name] = pkg.published_at;
    }
    return out;
  }

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
}

function isPublishedPackage(value: unknown): value is WaterxConfigPackageBase {
  return (
    !!value &&
    typeof value === "object" &&
    "published_at" in value &&
    typeof value.published_at === "string"
  );
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

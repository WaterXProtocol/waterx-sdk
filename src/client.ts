/**
 * WaterX Protocol client.
 *
 * Initialization is async — config is fetched from the canonical
 * `waterx-config` JSON (default: GitHub raw). See `WaterXClient.create()`.
 */

import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";

import {
  loadConfig,
  PYTH_DEFAULTS,
  type LoadConfigOptions,
  type PythInfraConfig,
  type WaterXConfig,
} from "./config.ts";
import type { Network } from "./constants.ts";

// ======== gRPC base URLs by network ========

const DEFAULT_GRPC_URLS: Record<Network, string> = {
  MAINNET: "https://fullnode.mainnet.sui.io:443",
  TESTNET: "https://fullnode.testnet.sui.io:443",
};

export interface CreateClientOptions extends LoadConfigOptions {
  grpcUrl?: string;
}

export class WaterXClient {
  /** gRPC client — all RPC including `simulateTransaction`. */
  grpcClient: SuiGrpcClient;
  /** Network identifier in upper case (`MAINNET` / `TESTNET`). */
  network: Network;
  /** Parsed canonical `waterx-config` JSON. */
  config: WaterXConfig;
  /** Pyth + Wormhole infra (network defaults unless overridden in JSON). */
  pyth: PythInfraConfig;

  constructor(network: Network, config: WaterXConfig, opts: { grpcUrl?: string } = {}) {
    this.network = network;
    this.config = config;
    this.pyth = config.pyth ?? PYTH_DEFAULTS[network];

    const grpcUrl = opts.grpcUrl ?? config.grpcUrl ?? DEFAULT_GRPC_URLS[network];
    this.grpcClient = new SuiGrpcClient({
      baseUrl: grpcUrl,
      network: network.toLowerCase() as "mainnet" | "testnet",
    });
  }

  /**
   * Async factory: fetches the deployment config for `network` and returns
   * a ready-to-use client. Pass `opts.cache=true` to memoize the JSON.
   */
  static async create(network: Network, opts: CreateClientOptions = {}): Promise<WaterXClient> {
    const config = await loadConfig(network, opts);
    return new WaterXClient(network, config, { grpcUrl: opts.grpcUrl });
  }

  static mainnet(opts: CreateClientOptions = {}): Promise<WaterXClient> {
    return WaterXClient.create("MAINNET", opts);
  }

  static testnet(opts: CreateClientOptions = {}): Promise<WaterXClient> {
    return WaterXClient.create("TESTNET", opts);
  }

  // ========================================================
  // gRPC convenience wrappers
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

  async simulate(tx: Transaction) {
    return this.grpcClient.simulateTransaction({
      transaction: tx,
      include: { commandResults: true },
    });
  }

  async signAndExecuteTransaction(params: {
    signer: {
      toSuiAddress: () => string;
    } & import("@mysten/sui/cryptography").Signer;
    transaction: Transaction;
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
      if (pkg && typeof pkg === "object" && "published_at" in pkg && pkg.published_at) {
        out[name] = (pkg as { published_at: string }).published_at;
      }
    }
    return out;
  }

  /** `waterx_perp.markets[ticker]`, throws if unknown. */
  getMarket(ticker: string) {
    const m = this.config.packages.waterx_perp?.markets?.[ticker];
    if (!m) throw new Error(`Unknown market ticker: ${ticker}`);
    return m;
  }

  /** `waterx_oracle.aggregators[ticker]`, throws if unknown. */
  getAggregator(ticker: string): string {
    const a = this.config.packages.waterx_oracle?.aggregators?.[ticker];
    if (!a) throw new Error(`No aggregator listed for ticker: ${ticker}`);
    return a;
  }

  /** `pyth_rule.feeds[ticker]`, throws if unknown. */
  getPythFeed(ticker: string) {
    const f = this.config.packages.pyth_rule?.feeds?.[ticker];
    if (!f) throw new Error(`No pyth feed listed for ticker: ${ticker}`);
    return f;
  }

  /** `wlp.pool_tokens[ticker]` (fully-qualified Move type), throws if unknown. */
  getPoolTokenType(ticker: string): string {
    const t = this.config.packages.wlp?.pool_tokens?.[ticker];
    if (!t) throw new Error(`No pool token registered for ticker: ${ticker}`);
    return t;
  }

  /** Fully-qualified WLP coin type derived from `wlp.original_id`. */
  wlpType(): string {
    const w = this.config.packages.wlp;
    if (!w?.original_id) throw new Error("wlp.original_id missing from config");
    return `${w.original_id}::wlp::WLP`;
  }
}

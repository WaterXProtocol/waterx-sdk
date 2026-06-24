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
  WORMHOLE_DEFAULTS,
  type LoadConfigOptions,
  type NativeCustodyAsset,
  type PythInfraConfig,
  type WaterXConfig,
  type WormholeInfraConfig,
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
  /** Pyth infra (network defaults unless overridden in JSON). */
  pyth: PythInfraConfig;
  /** Wormhole infra for the credit bridge (network defaults unless overridden). */
  wormhole: WormholeInfraConfig;

  constructor(network: Network, config: WaterXConfig, opts: { grpcUrl?: string } = {}) {
    this.network = network;
    this.config = config;
    this.pyth = config.pyth ?? PYTH_DEFAULTS[network];
    this.wormhole = config.wormhole ?? WORMHOLE_DEFAULTS[network];

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

  /**
   * True when `ticker` is priced by `constant_rule` (a constant pin,
   * e.g. `USDCUSD → $1`) rather than Pyth. Such tickers are fed via
   * `constant_rule::feed` and need no Pyth update; see {@link refreshOraclePrices}.
   *
   * All-or-nothing, mirroring {@link getSupraRule} and the keeper: only routes a
   * ticker to the constant rule when the rule is FULLY wired (`published_at` +
   * `config` present). A half-populated block — a `feeds` entry listed before the
   * rule is deployed, a realistic mid-rollout state — would otherwise make this
   * true while {@link aggregateTicker} throws, aborting the whole price-refresh PTB
   * instead of safely falling back to Pyth.
   *
   * Whether a constant ticker is *also* Pyth-fed (the dual-feed transition state)
   * or constant-only is not a separate flag — it falls out of whether the ticker
   * still has a `pyth_rule.feeds` entry. {@link aggregateTicker} feeds each rule the
   * ticker is configured for, so no `isDualFeed` / `isConstantOnly` predicate is needed.
   */
  isConstantTicker(ticker: string): boolean {
    const c = this.config.packages.constant_rule;
    if (!c?.published_at || !c.config) return false;
    return c.feeds?.[ticker] !== undefined;
  }

  /**
   * The `supra_rule` config when it is deployed, enabled, and fully wired
   * (`config` + `oracle_holder`), else `undefined`. When present, callers feed
   * `supra_rule::feed` as a second weighted rule alongside Pyth on the same
   * collector; see {@link refreshOraclePrices}. Default-off, so a Pyth-only
   * deployment returns `undefined` here.
   */
  getSupraRule(): { published_at: string; config: string; oracle_holder: string } | undefined {
    const s = this.config.packages.supra_rule;
    if (!s?.enabled || !s.published_at || !s.config || !s.oracle_holder) return undefined;
    return { published_at: s.published_at, config: s.config, oracle_holder: s.oracle_holder };
  }

  /**
   * Resolve a WLP pool token's fully-qualified Move type.
   *
   * `wlp.pool_tokens` is keyed by **oracle ticker** (e.g. `"USDCUSD"`) — the
   * Rust keeper requires this, since it reuses each key to look up the token's
   * aggregator + pyth feed. For ergonomics this also accepts the coin symbol
   * (the trailing `::Struct` segment, e.g. `"USD"` → `…::usd::USD`): an exact
   * ticker hit wins, otherwise we match by coin name. Throws if neither hits.
   */
  getPoolTokenType(tickerOrName: string): string {
    const poolTokens = this.config.packages.wlp?.pool_tokens ?? {};
    const exact = poolTokens[tickerOrName];
    if (exact) return exact;
    for (const t of Object.values(poolTokens)) {
      if (typeof t === "string" && t.split("::").pop() === tickerOrName) return t;
    }
    throw new Error(`No pool token registered for ticker/name: ${tickerOrName}`);
  }

  /** Fully-qualified WLP coin type derived from `wlp.original_id`. */
  wlpType(): string {
    const w = this.config.packages.wlp;
    if (!w?.original_id) throw new Error("wlp.original_id missing from config");
    return `${w.original_id}::wlp::WLP`;
  }

  /**
   * List of rewarders registered for a staking pool alias, e.g. `"WLP"`.
   * Returns an empty array if the deployment has no rewarders configured.
   * Each entry carries the rewarder shared object ID + the fully-qualified
   * reward coin type, so callers don't need a separate alias-to-type lookup.
   */
  getRewarders(
    stakeAlias: string,
  ): { alias: string; rewarder_id: string; coin_type: string; decimals: number }[] {
    const map = this.config.packages.waterx_staking?.rewarders?.[stakeAlias];
    if (!map) return [];
    return Object.entries(map).map(([alias, entry]) => ({ alias, ...entry }));
  }

  /** Type list of every reward coin for a stake pool — convenience for stake/unstake/claim. */
  getRewarderTypes(stakeAlias: string): string[] {
    return this.getRewarders(stakeAlias).map((r) => r.coin_type);
  }

  /** `waterx_credit` package entry, throws if the deployment has no bridge. */
  getCredit() {
    const c = this.config.packages.waterx_credit;
    if (!c) throw new Error("waterx_credit not configured for this deployment");
    return c;
  }

  /**
   * Fully-qualified CREDIT coin Move type, taken verbatim from
   * `waterx_credit.credit_type` (e.g. `0x..::usd::USD`). Throws if absent —
   * the deprecated `usdx` OTW package is intentionally not consulted.
   */
  creditType(): string {
    const t = this.config.packages.waterx_credit?.credit_type;
    if (!t) {
      throw new Error("creditType: packages.waterx_credit.credit_type missing from config");
    }
    return t;
  }

  /** `wormhole_bridge` package entry, throws if absent. */
  getBridge() {
    const b = this.config.packages.wormhole_bridge;
    if (!b) throw new Error("wormhole_bridge not configured for this deployment");
    return b;
  }

  /**
   * Sui Wormhole `State` object id — prefers the per-deployment
   * `wormhole_bridge.wormhole_state`, falls back to `client.wormhole`.
   */
  wormholeStateId(): string {
    return this.config.packages.wormhole_bridge?.wormhole_state ?? this.wormhole.state_id;
  }

  /** All native-custody backing-asset rows (throws if no custody vault). */
  getNativeAssets(): readonly NativeCustodyAsset[] {
    const nc = this.config.packages.native_custody;
    if (!nc) throw new Error("native_custody not configured for this deployment");
    return nc.assets;
  }

  /** A native-custody asset row by its fully-qualified Move type, throws if unknown. */
  getNativeAsset(moveType: string) {
    const row = this.getNativeAssets().find((a) => a.type === moveType);
    if (!row) throw new Error(`No native custody asset registered for type: ${moveType}`);
    return row;
  }
}

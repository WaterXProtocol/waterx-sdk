/**
 * WaterX Perp client — the perp product line (trading, orders, WLP, staking).
 *
 * One of the two sub-clients behind the umbrella `WaterXClient`; reachable as
 * `client.perp` (which also carries the perp builders). Initialization is async —
 * config is fetched from the canonical `waterx-config` JSON (default: GitHub raw).
 * See `PerpClient.create()`.
 *
 * Composition: the gRPC transport half is inherited from {@link BaseLineClient}
 * (shared with `PredictClient`); the canonical-schema lookups are delegated to a
 * {@link PerpConfigView}. This class is just the wiring + factory between them.
 */

import { BaseLineClient } from "../base-client.ts";
import type { OracleSource } from "../oracle/price-update-rule.ts";
import { assertOracleSourceConfigured } from "../oracle/rule-registry.ts";
import { PerpConfigView } from "./config-view.ts";
import {
  loadConfig,
  PYTH_DEFAULTS,
  PYTH_PRO_DEFAULTS,
  WORMHOLE_DEFAULTS,
  type LoadConfigOptions,
  type PythGeneration,
  type PythInfraConfig,
  type WaterXConfig,
  type WormholeInfraConfig,
} from "./config.ts";
import type { Network } from "./constants.ts";

export interface CreateClientOptions extends LoadConfigOptions {
  grpcUrl?: string;
  /**
   * Selects which `PriceUpdateRule` `refreshOraclePrices` uses for the
   * on-chain price-update leg (see `OracleHost.oracleSource`). Default:
   * `'pyth_rule'`. The SDK never reads `process.env` — pass this from your
   * own env var (e.g. `ORACLE_SOURCE`).
   */
  oracleSource?: OracleSource;
  /**
   * Selects which Pyth Core contract generation feeds `client.pyth` when the
   * config JSON has no explicit `pyth` override: `'core'` (default,
   * `PYTH_DEFAULTS`) or `'pro'` (`PYTH_PRO_DEFAULTS` — the post-2026-08-18
   * Pro-compatible contracts + Hermes-compatible endpoint; pair with
   * `pyth.api_key`). Orthogonal to `oracleSource`. An explicit `config.pyth`
   * always wins wholesale (see `PythGeneration`).
   */
  pythGeneration?: PythGeneration;
}

export class PerpClient extends BaseLineClient<WaterXConfig> {
  /** Pyth infra (network defaults unless overridden in JSON). */
  pyth: PythInfraConfig;
  /** Wormhole infra for the credit bridge (network defaults unless overridden). */
  wormhole: WormholeInfraConfig;
  /** Selected oracle rule source (client option, resolved at creation; default `'pyth_rule'`). See `OracleHost.oracleSource`. */
  readonly oracleSource: OracleSource;
  /** Selected Pyth Core generation (client option; default `'core'`). See `OracleHost.pythGeneration`. */
  readonly pythGeneration: PythGeneration;

  /** Canonical-schema lookups (delegated to below); no transport. */
  private readonly view: PerpConfigView;

  constructor(
    network: Network,
    config: WaterXConfig,
    opts: { grpcUrl?: string; oracleSource?: OracleSource; pythGeneration?: PythGeneration } = {},
  ) {
    super(network, config, opts);
    // Precedence: explicit config.pyth override > generation constants.
    this.pyth =
      config.pyth ?? (opts.pythGeneration === "pro" ? PYTH_PRO_DEFAULTS : PYTH_DEFAULTS)[network];
    this.wormhole = config.wormhole ?? WORMHOLE_DEFAULTS[network];
    this.oracleSource = opts.oracleSource ?? "pyth_rule";
    this.pythGeneration = opts.pythGeneration ?? "core";
    this.view = new PerpConfigView(
      () => this.config,
      () => this.wormhole,
    );
  }

  /**
   * Async factory: fetches the deployment config for `network` and returns
   * a ready-to-use client. Pass `opts.cache=true` to memoize the JSON.
   */
  static async create(network: Network, opts: CreateClientOptions = {}): Promise<PerpClient> {
    const config = await loadConfig(network, opts);
    // Fail fast: a non-default oracleSource whose rule package isn't in the
    // network config (e.g. pyth_lazer_rule on mainnet) would otherwise silently
    // route everything through the pyth_rule fallback. See
    // assertOracleSourceConfigured.
    assertOracleSourceConfigured(network, config.packages, opts.oracleSource ?? "pyth_rule");
    return new PerpClient(network, config, {
      grpcUrl: opts.grpcUrl,
      oracleSource: opts.oracleSource,
      pythGeneration: opts.pythGeneration,
    });
  }

  static mainnet(opts: CreateClientOptions = {}): Promise<PerpClient> {
    return PerpClient.create("MAINNET", opts);
  }

  static testnet(opts: CreateClientOptions = {}): Promise<PerpClient> {
    return PerpClient.create("TESTNET", opts);
  }

  // ========================================================
  // Config-schema lookups — delegated to PerpConfigView.
  // (Kept on the client so the ~50 builders typed `PerpClient` call them
  // directly, e.g. `client.wlpType()`. See perp-config-view.ts for docs.)
  // ========================================================

  /** @see PerpConfigView.getMarket */
  getMarket(ticker: string) {
    return this.view.getMarket(ticker);
  }

  /** @see PerpConfigView.getAggregator */
  getAggregator(ticker: string): string {
    return this.view.getAggregator(ticker);
  }

  /** @see PerpConfigView.getPythFeed */
  getPythFeed(ticker: string) {
    return this.view.getPythFeed(ticker);
  }

  /** @see PerpConfigView.isConstantTicker */
  isConstantTicker(ticker: string): boolean {
    return this.view.isConstantTicker(ticker);
  }

  /** @see PerpConfigView.getSupraRule */
  getSupraRule(): { published_at: string; config: string; oracle_holder: string } | undefined {
    return this.view.getSupraRule();
  }

  /** @see PerpConfigView.getPoolTokenType */
  getPoolTokenType(tickerOrName: string): string {
    return this.view.getPoolTokenType(tickerOrName);
  }

  /** @see PerpConfigView.wlpType */
  wlpType(): string {
    return this.view.wlpType();
  }

  /** @see PerpConfigView.getRewarders */
  getRewarders(
    stakeAlias: string,
  ): { alias: string; rewarder_id: string; coin_type: string; decimals: number }[] {
    return this.view.getRewarders(stakeAlias);
  }

  /** @see PerpConfigView.getRewarderTypes */
  getRewarderTypes(stakeAlias: string): string[] {
    return this.view.getRewarderTypes(stakeAlias);
  }

  /** @see PerpConfigView.getCredit */
  getCredit() {
    return this.view.getCredit();
  }

  /** @see PerpConfigView.creditType */
  creditType(): string {
    return this.view.creditType();
  }

  /** @see PerpConfigView.getBridge */
  getBridge() {
    return this.view.getBridge();
  }

  /** @see PerpConfigView.wormholeStateId */
  wormholeStateId(): string {
    return this.view.wormholeStateId();
  }

  /** @see PerpConfigView.getNativeAssets */
  getNativeAssets() {
    return this.view.getNativeAssets();
  }

  /** @see PerpConfigView.getNativeAsset */
  getNativeAsset(moveType: string) {
    return this.view.getNativeAsset(moveType);
  }
}

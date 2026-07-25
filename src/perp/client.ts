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
import { PerpConfigView } from "./config-view.ts";
import {
  loadConfig,
  PYTH_DEFAULTS,
  WORMHOLE_DEFAULTS,
  type LoadConfigOptions,
  type PythFetchPolicy,
  type PythInfraConfig,
  type WaterXConfig,
  type WormholeInfraConfig,
} from "./config.ts";
import type { Network } from "./constants.ts";

export interface CreateClientOptions extends LoadConfigOptions {
  grpcUrl?: string;
  /**
   * Which oracle price-update source drives `refreshOraclePrices`. Each source
   * is self-contained (own infra + config) with NO cross-source fallback:
   *
   * - `'pyth_rule'` (default) — Pyth Core `pyth_rule` updates (Hermes VAA +
   *   per-feed update fees), Core state + keyless Core Hermes.
   * - `'pyth_lazer_rule'` — Pyth Lazer signed updates (ONE `leEcdsa` verify
   *   per PTB, no per-feed fees); needs `packages.pyth_lazer_rule` with feeds
   *   and a `pythApiKey` (Lazer is auth-first).
   *
   * A source-neutral name on purpose — a future source need not be Pyth.
   * Selecting a source whose feed for a requested ticker is absent is NOT an
   * error at client creation: it fails at tx-build time for exactly those
   * tickers (see `refreshOraclePrices`). The Pyth Core infra is fixed per
   * network by `PYTH_DEFAULTS` and is not deployment-overridable.
   */
  oracleSource?: OracleSource;
  /**
   * Pyth Lazer access token (`Authorization: Bearer …`). Required under
   * `oracleSource: 'pyth_lazer_rule'` (Lazer is auth-first) and unused by
   * `'pyth_rule'` (keyless Core Hermes). This is a SECRET and never belongs in
   * the canonical `waterx-config` JSON — pass it at client init from your own
   * env var (e.g. `PYTH_API_KEY`); the SDK never reads `process.env`.
   */
  pythApiKey?: string;
  /**
   * Retry/timeout policy for the off-chain Hermes / Lazer update fetches (see
   * `fetchWithPolicy`). Optional — defaults to 15s timeout, 2 retries.
   */
  pythFetch?: PythFetchPolicy;
}

export class PerpClient extends BaseLineClient<WaterXConfig> {
  /** Pyth Core infra (fixed per network) plus the caller-supplied credential/policy. */
  pyth: PythInfraConfig;
  /** Wormhole infra for the credit bridge (network defaults unless overridden). */
  wormhole: WormholeInfraConfig;
  /** Selected oracle price-update source (`oracleSource` create option; default `'pyth_rule'`). */
  readonly oracleSource: OracleSource;

  /** Canonical-schema lookups (delegated to below); no transport. */
  private readonly view: PerpConfigView;

  constructor(network: Network, config: WaterXConfig, opts: CreateClientOptions = {}) {
    super(network, config, opts);
    // Pyth Core infra is fixed per network — NOT deployment-overridable and
    // NOT source-dependent (the pyth_lazer_rule source reads only api_key/fetch
    // from here). The api_key + fetch policy are caller-supplied at init: a
    // secret has no place in the canonical waterx-config JSON.
    this.pyth = {
      ...PYTH_DEFAULTS[network],
      ...(opts.pythApiKey !== undefined ? { api_key: opts.pythApiKey } : {}),
      ...(opts.pythFetch !== undefined ? { fetch: opts.pythFetch } : {}),
    };
    this.wormhole = config.wormhole ?? WORMHOLE_DEFAULTS[network];
    this.oracleSource = opts.oracleSource ?? "pyth_rule";
    this.view = new PerpConfigView(
      () => this.config,
      () => this.wormhole,
    );
  }

  /**
   * Async factory: fetches the deployment config for `network` and returns
   * a ready-to-use client. Pass `opts.cache=true` to memoize the JSON.
   *
   * No oracle-config guard here: selecting a source whose feeds are absent is
   * not an error at init — it surfaces at tx-build time for the specific
   * tickers that source can't serve (see `refreshOraclePrices`).
   */
  static async create(network: Network, opts: CreateClientOptions = {}): Promise<PerpClient> {
    const config = await loadConfig(network, opts);
    return new PerpClient(network, config, opts);
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

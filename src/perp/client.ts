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
import { ORACLE_SOURCES, type OracleSource } from "../oracle/price-update-rule.ts";
import { isOracleSource } from "../oracle/source-list.ts";
import type { FetchPolicy } from "../oracle/update-fetch.ts";
import { PerpConfigView } from "./config-view.ts";
import {
  loadConfig,
  WORMHOLE_DEFAULTS,
  type LoadConfigOptions,
  type PythAccessConfig,
  type PythFetchPolicy,
  type WaterxAccessConfig,
  type WaterXConfig,
  type WormholeInfraConfig,
} from "./config.ts";
import type { Network } from "./constants.ts";

export interface CreateClientOptions extends LoadConfigOptions {
  grpcUrl?: string;
  /**
   * Which oracle price-update source drives `refreshOraclePrices`. REQUIRED —
   * there is NO default source: every deployment names its source explicitly
   * (wire it from your own env var, e.g. `ORACLE_SOURCE`). Each source is
   * self-contained (own infra, own endpoints, own config) with NO cross-source
   * fallback:
   *
   * - `'pyth_lazer_rule'` — Pyth Lazer signed updates (ONE `leEcdsa` verify
   *   per PTB, no per-feed fees); needs `packages.pyth_lazer_rule` with feeds
   *   and a `pythApiKey` (Lazer is auth-first); Lazer infra lives in the
   *   source's own `LAZER_INFRA` table.
   * - `'waterx_rule'` — the first-party WaterX quote-center (Nautilus-TEE,
   *   ed25519-signed prices): one signed Merkle LEAF per ticker, verified AND
   *   fed by a single `collect_single_with_proof` per collector (falling back to
   *   one whole-batch envelope + `collect_batch_latest` against a quote-center
   *   with no leaf route). No credential and no per-update fee; needs
   *   `packages.waterx_rule` with feeds. Quote-center infra lives in the source's own `WATERX_INFRA`
   *   table; endpoint/transport overridable via
   *   {@link CreateClientOptions.waterxEndpoint} /
   *   {@link CreateClientOptions.waterxFetch} — the browser-CORS proxy hook,
   *   since this is the one source fetched from the page.
   *
   * The name is source-neutral on purpose — a source need not be Pyth (as
   * `'waterx_rule'` shows). Selecting a source whose feed for a requested
   * ticker is absent is NOT an error at client creation: it fails at tx-build
   * time for exactly those tickers (see `refreshOraclePrices`).
   *
   * Accepts a SINGLE source or a LIST. A list means every listed source's
   * data is fetched and fed in one build — required whenever the on-chain
   * weight tables have more than one rule weighted (e.g. a Core→Pro or
   * Pro+Waterx coexistence window): the chain drops unweighted contributions
   * (harmless) but aborts on a starved weighted rule, so the list must stay a
   * SUPERSET of every ticker's weighted set. Order is meaningful to consumers
   * (read-plane priority), not to the on-chain build.
   */
  oracleSource: OracleSource | OracleSource[];
  /**
   * Pyth Lazer access token (`Authorization: Bearer …`). Required under
   * `oracleSource: 'pyth_lazer_rule'` (Lazer is auth-first) and unused by
   * `'waterx_rule'` (public quote-center). This is a SECRET and never belongs
   * in the canonical `waterx-config` JSON — pass it at client init from your
   * own env var (e.g. `PYTH_API_KEY`); the SDK never reads `process.env`.
   */
  pythApiKey?: string;
  /**
   * Retry/timeout policy for the off-chain Lazer update fetch (see
   * `fetchWithPolicy`). Optional — defaults to 15s timeout, 2 retries.
   */
  pythFetch?: PythFetchPolicy;
  /**
   * Quote-center base URL for `oracleSource: 'waterx_rule'` — overrides the
   * source's own per-network `WATERX_INFRA` default.
   *
   * This is the one source a BROWSER fetches itself (the signed price is pulled
   * from the page), so it is bound by the quote-center deployment's CORS
   * allowlist. A front end whose origin is not allowed — or one that must route
   * egress through its own backend — points this at a same-origin proxy that
   * forwards `GET /v1/quotes/leaves` (and `GET /v1/quotes/update`, the fallback
   * route). Unused by the Pyth sources.
   *
   * An absolute URL. Any base PATH is preserved (`joinEndpointPath`), so
   * `https://app.example/api/quote-center` fetches
   * `https://app.example/api/quote-center/v1/quotes/leaves` — a proxy route
   * survives instead of being rewritten to the origin root.
   */
  waterxEndpoint?: string;
  /**
   * Retry/timeout policy — and `fetchImpl` — for the quote-center fetch (see
   * `fetchWithPolicy`). Optional: falls back to the built-in defaults — never
   * to `pythFetch` (sources stay independent). Supply `fetchImpl` to route the request through your own
   * transport (a proxying `fetch` wrapper, a non-global `fetch`, a test double).
   */
  waterxFetch?: FetchPolicy;
}

export class PerpClient extends BaseLineClient<WaterXConfig> {
  /** Caller-supplied Pyth credential + fetch policy — NO infra; each source owns its own tables. */
  pyth: PythAccessConfig;
  /**
   * Caller-supplied quote-center overrides for `oracleSource: 'waterx_rule'`
   * (`waterxEndpoint` / `waterxFetch` create options) — access-only, mirroring
   * `pyth` above; unset fields resolve against the rule's own `WATERX_INFRA`.
   */
  waterx: WaterxAccessConfig;
  /** Wormhole infra for the credit bridge (network defaults unless overridden). */
  wormhole: WormholeInfraConfig;
  /** The fed set: `oracleSource` create option normalized to a non-empty, deduped list. */
  readonly oracleSources: readonly OracleSource[];

  /** Canonical-schema lookups (delegated to below); no transport. */
  private readonly view: PerpConfigView;

  constructor(network: Network, config: WaterXConfig, opts: CreateClientOptions) {
    super(network, config, opts);
    // Access-only slice: the api_key + fetch policy are caller-supplied at
    // init (a secret has no place in the canonical waterx-config JSON). All
    // endpoint/object-id infra is per-source, owned by the rule modules —
    // nothing infra-shaped lives on the client.
    this.pyth = {
      ...(opts.pythApiKey !== undefined ? { api_key: opts.pythApiKey } : {}),
      ...(opts.pythFetch !== undefined ? { fetch: opts.pythFetch } : {}),
    };
    this.wormhole = config.wormhole ?? WORMHOLE_DEFAULTS[network];
    // Quote-center access slice: overrides only — a browser blocked by the
    // quote-center's CORS allowlist swaps `endpoint` for a same-origin proxy;
    // unset fields resolve inside the rule against WATERX_INFRA[network].
    this.waterx = {
      ...(opts.waterxEndpoint !== undefined ? { endpoint: opts.waterxEndpoint } : {}),
      ...(opts.waterxFetch !== undefined ? { fetch: opts.waterxFetch } : {}),
    };
    // Normalize single-or-list to a deduped, order-preserving list, gated by
    // `isOracleSource` — the SAME predicate `parseOracleSourceList` uses. An
    // empty list, a nullish entry (an untyped caller omitting the REQUIRED
    // option), or an unregistered value (`'core'`, `'pyth'`, …) fails
    // construction loudly instead of booting green and surfacing as
    // `OracleSourceNotImplemented` at the first tx-build.
    const sources = Array.isArray(opts.oracleSource) ? opts.oracleSource : [opts.oracleSource];
    this.oracleSources = [...new Set(sources)];
    if (
      this.oracleSources.length === 0 ||
      this.oracleSources.some((source) => !isOracleSource(source))
    ) {
      throw new Error(
        `oracleSource is REQUIRED and must name at least one of ${ORACLE_SOURCES.join(" | ")} ` +
          `(got ${JSON.stringify(sources)})`,
      );
    }
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
  static async create(network: Network, opts: CreateClientOptions): Promise<PerpClient> {
    const config = await loadConfig(network, opts);
    return new PerpClient(network, config, opts);
  }

  static mainnet(opts: CreateClientOptions): Promise<PerpClient> {
    return PerpClient.create("MAINNET", opts);
  }

  static testnet(opts: CreateClientOptions): Promise<PerpClient> {
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

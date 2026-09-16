/**
 * WaterX Perp client — the perp product line (trading, orders, WLP, staking).
 *
 * One of the two sub-clients behind the umbrella `WaterXClient`; reachable as
 * `client.perp` (which also carries the perp builders). Initialization is async —
 * config is fetched from the canonical `waterx-config` document (see
 * `src/config.ts`). See `PerpClient.create()`.
 *
 * Composition: the gRPC transport half is inherited from {@link BaseLineClient}
 * (shared with `PredictClient`); the canonical-schema lookups are delegated to a
 * {@link PerpConfigView}. This class is just the wiring + factory between them.
 */

import { WORMHOLE_DEFAULTS, type WormholeInfraConfig } from "../account/config.ts";
import { BaseLineClient } from "../base-client.ts";
import {
  assertLinePackages,
  loadConfig,
  PERP_PACKAGES,
  type LoadConfigOptions,
  type PerpLineConfig,
  type WaterXConfig,
} from "../config.ts";
import type { PythAccessConfig, PythFetchPolicy, WaterxAccessConfig } from "../oracle/config.ts";
import { ORACLE_SOURCES, type OracleSource } from "../oracle/price-update-rule.ts";
import { deriveOracleSources } from "../oracle/source-list.ts";
import type { FetchPolicy } from "../oracle/update-fetch.ts";
import { servableTickers } from "../oracle/validate.ts";
import { PerpConfigView } from "./config-view.ts";
import type { Network } from "./constants.ts";

export interface CreateClientOptions extends LoadConfigOptions {
  grpcUrl?: string;
  /**
   * Pyth Lazer access token (`Authorization: Bearer …`). Required under
   * a config that wires `pyth_lazer_rule` (Lazer is auth-first) and unused by
   * `waterx_rule` (public quote-center). This is a SECRET and never belongs
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
   * Quote-center base URL for `waterx_rule` — overrides the
   * source's own per-network `WATERX_INFRA` default.
   *
   * This is the one source a BROWSER fetches itself (the signed price is pulled
   * from the page), so it is bound by the quote-center deployment's CORS
   * allowlist. A front end whose origin is not allowed — or one that must route
   * egress through its own backend — points this at a same-origin proxy.
   * Unused by the Pyth sources.
   *
   * An absolute URL whose base PATH is preserved (`joinEndpointPath`), so
   * `https://app.example/api/quote-center` fetches
   * `https://app.example/api/quote-center/v1/sign/bbo/consensus` — a proxy route
   * survives instead of being rewritten to the origin root. See
   * {@link WaterxAccessConfig.endpoint} for EVERY route a proxy must forward.
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

export class PerpClient extends BaseLineClient<PerpLineConfig> {
  /** Caller-supplied Pyth credential + fetch policy — NO infra; each source owns its own tables. */
  pyth: PythAccessConfig;
  /**
   * Caller-supplied quote-center overrides for `waterx_rule`
   * (`waterxEndpoint` / `waterxFetch` create options) — access-only, mirroring
   * `pyth` above; unset fields resolve against the rule's own `WATERX_INFRA`.
   */
  waterx: WaterxAccessConfig;
  /** External Wormhole infra for the credit bridge — fixed per network (`WORMHOLE_DEFAULTS`). */
  wormhole: WormholeInfraConfig;
  /** The fed set, derived from the config — see {@link deriveOracleSources}. */
  readonly oracleSources: readonly OracleSource[];

  /** Canonical-schema lookups (delegated to below); no transport. */
  private readonly view: PerpConfigView;

  constructor(network: Network, config: WaterXConfig, opts: CreateClientOptions) {
    // BEFORE `super`, so the narrowing reaches it — this is what makes
    // `client.config` a `PerpLineConfig` instead of a docstring claim.
    // Line-scoped, not enforced by the loader: a prediction-only deployment
    // document still loads for prediction consumers.
    assertLinePackages(config, PERP_PACKAGES, "perp");
    super(network, config, opts);
    // Access-only slice: the api_key + fetch policy are caller-supplied at
    // init (a secret has no place in the canonical waterx-config JSON). All
    // endpoint/object-id infra is per-source, owned by the rule modules —
    // nothing infra-shaped lives on the client.
    this.pyth = {
      ...(opts.pythApiKey !== undefined ? { api_key: opts.pythApiKey } : {}),
      ...(opts.pythFetch !== undefined ? { fetch: opts.pythFetch } : {}),
    };
    this.wormhole = WORMHOLE_DEFAULTS[network];
    // Quote-center access slice: overrides only — a browser blocked by the
    // quote-center's CORS allowlist swaps `endpoint` for a same-origin proxy;
    // unset fields resolve inside the rule against WATERX_INFRA[network].
    this.waterx = {
      ...(opts.waterxEndpoint !== undefined ? { endpoint: opts.waterxEndpoint } : {}),
      ...(opts.waterxFetch !== undefined ? { fetch: opts.waterxFetch } : {}),
    };
    // The fed set is a property of the DEPLOYMENT, read off the same config
    // that wires the rules — never a create option and never an env var.
    this.oracleSources = deriveOracleSources(config);
    if (this.oracleSources.length === 0) {
      // Not a per-ticker coverage question (that is left to tx-build, on
      // purpose): a config wiring NO price-update source at all cannot price
      // anything, so every build would skip every ticker and every trade would
      // abort on chain. Fail at construction, where the config is in hand.
      throw new Error(
        `this deployment's config wires no price-update source — expected at least one of ` +
          `${ORACLE_SOURCES.join(" | ")} to serve a ticker (oracle_rules.pyth_lazer with ` +
          `lazer_feed_ids, or a non-empty symbols universe for the quote-center).`,
      );
    }
    this.view = new PerpConfigView(() => this.config);
  }

  /**
   * Async factory: fetches the deployment config for `network` and returns
   * a ready-to-use client. Pass `opts.cache=true` to memoize the document.
   *
   * No per-ticker oracle guard here: a ticker no derived source serves is not
   * an error at init — it surfaces at tx-build time for the specific tickers
   * a build depends on (see `refreshOraclePrices`).
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

  /**
   * WLP pool-token tickers THIS client's fed set can actually price — the
   * ticker set the WLP builders refresh before `assert_prices_fresh`.
   *
   * The predicate is `refreshOraclePrices`'s own (`servableTickers`), so this
   * list is exactly what a refresh would ACCEPT at config level. Post-v2 that
   * is a weaker filter than it once was: the quote-center is always listed and
   * serves the whole `symbols` universe, so the only token dropped here is one
   * in neither `symbols` nor `constant_prices`. It does NOT predict a
   * fetch-time gap — see the SCOPE note on `assertOracleWriteCoverage`.
   *
   * NOTE this is a QUERY, not what the WLP builders use — they deliberately
   * refresh and bump the WHOLE pool, because dropping an unpriceable asset
   * from both halves is silent (see `assertWlpPoolRefreshed`).
   */
  pricedPoolTickers(): string[] {
    return servableTickers(this, Object.keys(this.config.objects.wlp.pool_tokens));
  }

  /**
   * {@link pricedPoolTickers} already joined to each token's Move type.
   *
   * A query, not a build primitive: the WLP builders deliberately refresh and
   * bump the WHOLE pool (`refreshWlpPoolOracles`), because pre-filtering to
   * what this client can price silently drops an asset from both halves. Use
   * this to ASK what a fed set covers — e.g. a dashboard, or a boot assert
   * pairing it with `assertOracleWriteCoverage`.
   */
  pricedPoolTokens(): { ticker: string; tokenType: string }[] {
    return this.pricedPoolTickers().map((ticker) => ({
      ticker,
      tokenType: this.getPoolTokenType(ticker),
    }));
  }

  /** @see PerpConfigView.isConstantTicker */
  isConstantTicker(ticker: string): boolean {
    return this.view.isConstantTicker(ticker);
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
  getRewarders(stakeAlias: string): ReturnType<PerpConfigView["getRewarders"]> {
    return this.view.getRewarders(stakeAlias);
  }

  /** @see PerpConfigView.getRewarderTypes */
  getRewarderTypes(stakeAlias: string): string[] {
    return this.view.getRewarderTypes(stakeAlias);
  }

  /** @see PerpConfigView.creditType */
  creditType(): string {
    return this.view.creditType();
  }

  /** @see PerpConfigView.getNativeAsset */
  getNativeAsset(moveType: string) {
    return this.view.getNativeAsset(moveType);
  }
}

/**
 * Perp config-schema views — read-only lookups over the parsed `waterx-config`
 * document, with no transport dependency.
 *
 * Split off the transport client (`PerpClient`) so the two responsibilities stay
 * separate: `BaseLineClient` owns the gRPC half, this class owns the
 * canonical-schema half. `PerpClient` composes one of these and delegates, so
 * callers keep calling `client.getMarket(...)` / `client.wlpType()` unchanged.
 * Tested in isolation against a plain config object — no network needed.
 *
 * Only lookups that DO something live here — a keyed-map read with a throwing
 * miss, or a derived identifier. A plain block read is `client.config.objects.*`
 * at the call site.
 */

import type {
  NativeCustodyAsset,
  PerpMarketEntry,
  RewarderEntry,
  WaterXConfig,
} from "../config.ts";
import { ownEntry } from "../utils/record.ts";

export class PerpConfigView {
  // Config is read through a provider, not captured by value, so a later
  // `client.config = …` reassignment stays live (matches the pre-split behaviour
  // where every lookup read `this.config` fresh).
  constructor(private readonly getConfig: () => WaterXConfig) {}

  private get config(): WaterXConfig {
    return this.getConfig();
  }

  /** `objects.perp.markets[ticker]`, throws if unknown. */
  getMarket(ticker: string): PerpMarketEntry {
    const m = ownEntry(this.config.objects.perp.markets, ticker);
    if (!m) throw new Error(`Unknown market ticker: ${ticker}`);
    return m;
  }

  /** `objects.oracle.aggregators[ticker]`, throws if unknown. */
  getAggregator(ticker: string): string {
    const a = ownEntry(this.config.objects.oracle.aggregators, ticker);
    if (!a) throw new Error(`No aggregator listed for ticker: ${ticker}`);
    return a;
  }

  /**
   * True when `ticker` is priced by `constant_rule` (a constant pin,
   * e.g. `USDCUSD → $1`) rather than a live source. Such tickers are fed via
   * `constant_rule::feed` and need no source update leg; see
   * {@link refreshOraclePrices}.
   */
  isConstantTicker(ticker: string): boolean {
    return ownEntry(this.config.oracle_rules.constant.constant_prices, ticker) !== undefined;
  }

  /**
   * Resolve a WLP pool token's fully-qualified Move type.
   *
   * `objects.wlp.pool_tokens` is keyed by **oracle ticker** (e.g. `"USDCUSD"`)
   * — the Rust keeper requires this, since it reuses each key to look up the
   * token's aggregator + feed. For ergonomics this also accepts the coin symbol
   * (the trailing `::Struct` segment, e.g. `"USD"` → `…::usd::USD`): an exact
   * ticker hit wins, otherwise we match by coin name. Throws if neither hits.
   */
  getPoolTokenType(tickerOrName: string): string {
    const poolTokens = this.config.objects.wlp.pool_tokens;
    const exact = ownEntry(poolTokens, tickerOrName);
    if (exact) return exact;
    for (const t of Object.values(poolTokens)) {
      if (t.split("::").pop() === tickerOrName) return t;
    }
    throw new Error(`No pool token registered for ticker/name: ${tickerOrName}`);
  }

  /** Fully-qualified WLP coin type derived from `packages.wlp.original_id`. */
  wlpType(): string {
    return `${this.config.packages.wlp.original_id}::wlp::WLP`;
  }

  /**
   * List of rewarders registered for a staking pool alias, e.g. `"WLP"`.
   * Returns an empty array if the deployment has no rewarders configured.
   * Each entry carries the rewarder shared object ID + the fully-qualified
   * reward coin type, so callers don't need a separate alias-to-type lookup.
   */
  getRewarders(stakeAlias: string): ({ alias: string } & RewarderEntry)[] {
    const map = ownEntry(this.config.objects.staking.rewarders, stakeAlias);
    if (!map) return [];
    return Object.entries(map).map(([alias, entry]) => ({ alias, ...entry }));
  }

  /** Type list of every reward coin for a stake pool — convenience for stake/unstake/claim. */
  getRewarderTypes(stakeAlias: string): string[] {
    return this.getRewarders(stakeAlias).map((r) => r.coin_type);
  }

  /** Fully-qualified CREDIT coin Move type, verbatim from `objects.credit.credit_type`. */
  creditType(): string {
    return this.config.objects.credit.credit_type;
  }

  /** A native-custody asset row by its fully-qualified Move type, throws if unknown. */
  getNativeAsset(moveType: string): NativeCustodyAsset {
    const row = this.config.objects.custody.assets.find((a) => a.type === moveType);
    if (!row) throw new Error(`No native custody asset registered for type: ${moveType}`);
    return row;
  }
}

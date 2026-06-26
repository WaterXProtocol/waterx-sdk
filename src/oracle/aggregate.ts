/**
 * Oracle aggregation — the orchestrator that composes rules into the shared
 * `Oracle`. This is the ONE file that knows about every rule: it builds a
 * `PriceCollector`, feeds whichever rules a ticker is configured for
 * (Pyth / Supra / Constant), then `aggregate`s.
 *
 * Per ticker:
 *   collector = oracle::new_collector(ticker)
 *   [pyth_rule::feed]       when the ticker has a pyth_rule.feeds entry
 *   [supra_rule::feed]      when supra is enabled + wired
 *   [constant_rule::feed]   when the ticker is a constant ticker
 *   oracle::aggregate(oracle, collector)
 *
 * The fed rule set must match the on-chain weighted set for the ticker —
 * `aggregator::remove_outliers` aborts `EMissingPriceSource` if a weighted rule
 * is missing from the collector.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import { aggregate as aggregateCall, newCollector } from "../generated/waterx_oracle/oracle.ts";
import type { OracleHost } from "./host.ts";
import { updatePythPrices, type PythCache } from "./pyth.ts";
import { feedConstantRule } from "./rules/constant-rule.ts";
import { feedPythRule } from "./rules/pyth-rule.ts";
import { maybeFeedSupra } from "./rules/supra-rule.ts";

/**
 * Aggregate one ticker's price into the shared `Oracle`: build a collector, feed
 * every rule the ticker is configured for, then `aggregate`.
 *
 * - **Pyth** — fed when `priceInfoObjectId` is supplied (i.e. the ticker has a
 *   `pyth_rule.feeds` entry). Caller must run the Pyth update first so the
 *   `PriceInfoObject` is fresh.
 * - **Supra** — fed alongside Pyth when supra is enabled + wired (abstains
 *   on-chain for symbols it has no pair for).
 * - **Constant** — fed when the ticker is a constant ticker
 *   ({@link OracleHost.isConstantTicker}).
 *
 * "Dual-feed" (Pyth + Constant) and "constant-only" are not special cases — they
 * fall out of which rules the ticker is in. Throws if no rule applies.
 */
export function aggregateTicker(
  tx: Transaction,
  host: OracleHost,
  args: { ticker: string; priceInfoObjectId?: string },
): void {
  const oraclePkg = host.config.packages.waterx_oracle.published_at;
  const collector = newCollector({
    package: oraclePkg,
    arguments: { symbol: args.ticker },
  })(tx) as unknown as TransactionArgument;

  let fed = false;

  if (args.priceInfoObjectId) {
    feedPythRule(tx, host, collector, args.priceInfoObjectId);
    // Supra rides on the same collector when enabled (abstains on-chain otherwise).
    maybeFeedSupra(tx, host, collector);
    fed = true;
  }

  if (host.isConstantTicker(args.ticker)) {
    feedConstantRule(tx, host, collector);
    fed = true;
  }

  if (!fed) {
    throw new Error(
      `no oracle rule configured for ticker '${args.ticker}' (no pyth feed, not a constant ticker)`,
    );
  }

  aggregateCall({
    package: oraclePkg,
    arguments: {
      oracle: tx.object(host.config.packages.waterx_oracle.oracle),
      collector,
    },
  })(tx);
}

/**
 * Thin wrapper over {@link aggregateTicker} for a Pyth-fed ticker. Kept for
 * back-compat (e.g. WLP mint builds). Caller must run the Pyth update first.
 */
export function aggregateTickerWithPyth(
  tx: Transaction,
  host: OracleHost,
  args: { ticker: string; priceInfoObjectId: string },
): void {
  aggregateTicker(tx, host, args);
}

/**
 * {@link aggregateTicker} for a **constant-only** ticker (no Pyth update needed —
 * the price comes from the on-chain `constant_rule::Config`).
 *
 * Throws if the ticker ALSO has a `pyth_rule.feeds` entry (a dual-feed transition
 * ticker): feeding only the constant leg would leave the still-weighted Pyth rule
 * absent from the collector and abort `aggregate` with `EMissingPriceSource`. Such
 * tickers must go through {@link aggregateTicker} with a `priceInfoObjectId` (or
 * {@link refreshOraclePrices}), which feeds both.
 */
export function aggregateTickerWithConstant(
  tx: Transaction,
  host: OracleHost,
  args: { ticker: string },
): void {
  if (host.config.packages.pyth_rule?.feeds?.[args.ticker] !== undefined) {
    throw new Error(
      `'${args.ticker}' is in pyth_rule.feeds (dual-feed) — feed both via aggregateTicker({ priceInfoObjectId }) / refreshOraclePrices, not aggregateTickerWithConstant`,
    );
  }
  aggregateTicker(tx, host, { ticker: args.ticker });
}

/**
 * Refresh multiple tickers in one PTB. For each ticker {@link aggregateTicker}
 * feeds whichever rules it is configured for (Pyth if it has a `pyth_rule.feeds`
 * entry, Supra when enabled, Constant when it's a constant ticker). Tickers with a
 * Pyth feed are updated on-chain via one shared Pyth accumulator first; the rest
 * (constant-only) skip Pyth entirely.
 */
export async function refreshOraclePrices(
  tx: Transaction,
  host: OracleHost,
  tickers: string[],
  opts: {
    cache?: PythCache;
    sponsorFund?: { fund: TransactionArgument; packageId: string };
  } = {},
): Promise<void> {
  if (tickers.length === 0) return;

  // Every ticker with a pyth_rule.feeds entry needs the on-chain Pyth update
  // first (one shared accumulator). Constant-only tickers (no pyth feed) skip it.
  const pythTickers = tickers.filter(
    (t) => host.config.packages.pyth_rule?.feeds?.[t] !== undefined,
  );
  const priceInfoByTicker = new Map<string, string>();
  if (pythTickers.length > 0) {
    const entries = pythTickers.map((t) => host.getPythFeed(t));
    await updatePythPrices(
      tx,
      host,
      entries.map((e) => e.feed_id),
      opts.cache,
      opts.sponsorFund,
    );
    pythTickers.forEach((t, i) => priceInfoByTicker.set(t, entries[i]!.price_info_object));
  }

  // Aggregate each ticker, feeding whichever rules it is configured for.
  for (const ticker of tickers) {
    aggregateTicker(tx, host, { ticker, priceInfoObjectId: priceInfoByTicker.get(ticker) });
  }
}

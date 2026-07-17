/**
 * Oracle aggregation — the orchestrator that composes rules into the shared
 * `Oracle`. This is the ONE file that knows about every rule: it builds a
 * `PriceCollector`, feeds whichever rules a ticker is configured for
 * (Pyth / Lazer / Supra / Constant), then `aggregate`s.
 *
 * Per ticker:
 *   collector = oracle::new_collector(ticker)
 *   [pyth_rule::feed]       when the ticker has a pyth_rule.feeds entry
 *   [pyth_lazer_rule::feed] when the update leg produced a verified lazer Update
 *   [supra_rule::feed]      when supra is enabled + wired
 *   [constant_rule::feed]   when the ticker is a constant ticker
 *   oracle::aggregate(oracle, collector)
 *
 * The fed rule set must cover the on-chain weighted set for the ticker —
 * `aggregator::remove_outliers` aborts `EMissingPriceSource` if a weighted rule
 * is missing from the collector (an abstaining feed call counts as present;
 * a fed-but-unweighted rule is silently dropped).
 *
 * `refreshOraclePrices` additionally routes the on-chain price *update* leg
 * (the fetch + verify/push step, before any of the above feeding) through the
 * `PriceUpdateRule` selected by `host.oracleSource` — see `rule-registry.ts`.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import { aggregate as aggregateCall, newCollector } from "../generated/waterx_oracle/oracle.ts";
import type { OracleHost } from "./host.ts";
import type {
  OracleSource,
  PriceUpdateRule,
  RuleUpdateData,
  RuleUpdateHandle,
} from "./price-update-rule.ts";
import type { PythCache } from "./pyth.ts";
import { resolveOracleRule } from "./rule-registry.ts";
import { feedConstantRule } from "./rules/constant-rule.ts";
import { feedLazerRule } from "./rules/pyth-lazer-rule.ts";
import { feedPythRule } from "./rules/pyth-rule.ts";
import { maybeFeedSupra } from "./rules/supra-rule.ts";

/**
 * Aggregate one ticker's price into the shared `Oracle`: build a collector, feed
 * every rule the ticker is configured for, then `aggregate`.
 *
 * - **Pyth** — fed when `priceInfoObjectId` is supplied (i.e. the ticker has a
 *   `pyth_rule.feeds` entry). When this PTB's update leg refreshed the
 *   `PriceInfoObject` it contributes a fresh price; when it did not (a
 *   lazer-routed ticker), the on-chain rule only READS the object and abstains
 *   if it is stale — it never aborts — so the call stays mandatory while
 *   `pyth_rule` remains in the ticker's on-chain weighted set
 *   (`EMissingPriceSource` requires every weighted rule to appear).
 * - **Lazer** — fed when `lazerUpdate` is supplied: the verified
 *   `pyth_lazer::update::Update` produced by this PTB's lazer update leg
 *   (see `PythLazerRule.buildUpdateCalls`). If the ticker's aggregator does
 *   not (yet) weight `PythLazerRule`, the contribution is silently dropped
 *   on-chain — feeding ahead of the weight migration is harmless.
 * - **Supra** — fed alongside Pyth/Lazer when supra is enabled + wired
 *   (abstains on-chain for symbols it has no pair for).
 * - **Constant** — fed when the ticker is a constant ticker
 *   ({@link OracleHost.isConstantTicker}).
 *
 * "Dual-feed" (Pyth + Constant, or Pyth + Lazer) and "constant-only" are not
 * special cases — they fall out of which rules the ticker is in. Throws if no
 * rule applies.
 */
export function aggregateTicker(
  tx: Transaction,
  host: OracleHost,
  args: { ticker: string; priceInfoObjectId?: string; lazerUpdate?: TransactionArgument },
): void {
  const oraclePkg = host.config.packages.waterx_oracle.published_at;
  const collector = newCollector({
    package: oraclePkg,
    arguments: { symbol: args.ticker },
  })(tx) as unknown as TransactionArgument;

  let fed = false;

  if (args.priceInfoObjectId) {
    feedPythRule(tx, host, collector, args.priceInfoObjectId);
    fed = true;
  }

  if (args.lazerUpdate !== undefined) {
    feedLazerRule(tx, host, collector, args.lazerUpdate);
    fed = true;
  }

  if (fed) {
    // Supra rides on the same collector when enabled (abstains on-chain otherwise).
    maybeFeedSupra(tx, host, collector);
  }

  if (host.isConstantTicker(args.ticker)) {
    feedConstantRule(tx, host, collector);
    fed = true;
  }

  if (!fed) {
    throw new Error(
      `no oracle rule configured for ticker '${args.ticker}' (no pyth feed, no lazer update, not a constant ticker)`,
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
 * entry, Lazer if the lazer update leg served it — see below — Supra when
 * enabled, Constant when it's a constant ticker).
 *
 * Before that, the on-chain price *update* leg is routed by `host.oracleSource`
 * (see `rule-registry.ts`): the selected rule serves every ticker in its
 * `supportedTickers(host)`; tickers it doesn't cover fall back to `pyth_rule`
 * (`PythCoreRule`) when THEY support it — so when `oracleSource` IS `'pyth_rule'`
 * there is exactly one group, identical to the pre-routing behavior. A ticker
 * supported by neither is simply skipped from this leg (no fetch/build call for
 * it) — the same way today's non-pyth tickers (e.g. constant-only) always were;
 * it still gets aggregated below via whichever rule {@link aggregateTicker} finds.
 *
 * Each group's fetch + build runs against its own rule, which guarantees
 * per-rule PTB atomicity (no mixed-generation payload within one rule's calls).
 * When `oracleSource` isn't `'pyth_rule'`, one PTB may legitimately carry BOTH a
 * non-Pyth-Core block (selected group) and a Pyth Core block (fallback group) —
 * each verifies against its own contract objects, so that's fine. All groups'
 * off-chain fetches run concurrently (`Promise.all`) and complete before any
 * PTB mutation; on-chain reads inside `buildUpdateCalls` can still fail
 * mid-append — callers discard the tx on throw.
 *
 * **Collector-feed leg is rule-aware:** a lazer-served group's
 * `buildUpdateCalls` returns the verified `Update` PTB value
 * ({@link RuleUpdateHandle}), and every ticker in that group is aggregated
 * with `lazerUpdate` set so {@link aggregateTicker} appends
 * `pyth_lazer_rule::feed` against it. A lazer-routed ticker that still has a
 * `pyth_rule.feeds` entry ALSO keeps its `pyth_rule::feed` leg — required
 * on-chain while `pyth_rule` stays in the ticker's weighted set
 * (`aggregator::remove_outliers` aborts `EMissingPriceSource` unless every
 * weighted rule appears in the collector; an abstention counts as
 * appearing), and safe: `pyth_rule::feed` only READS the `PriceInfoObject`
 * this PTB never refreshed and abstains when it is stale rather than
 * aborting. Conversely, a lazer feed call on an aggregator that does not
 * (yet) weight `PythLazerRule` is silently dropped on-chain — so
 * lazer-routing a ticker ahead of its on-chain weight migration prices it
 * from the remaining weighted rules instead of failing.
 */
export async function refreshOraclePrices(
  tx: Transaction,
  host: OracleHost,
  tickers: string[],
  opts: {
    cache?: PythCache;
    sponsorFund?: { fund: TransactionArgument; packageId: string };
    /**
     * @internal Test-only: layer fake `PriceUpdateRule`s on top of the
     * production registry (see `rule-registry.ts`'s `resolveOracleRule`).
     * Production callers never set this — routing is by `host.oracleSource`
     * alone.
     */
    ruleOverrides?: Partial<Record<OracleSource, PriceUpdateRule>>;
  } = {},
): Promise<void> {
  if (tickers.length === 0) return;

  // price_info_object lookup for every ticker with a pyth_rule.feeds entry —
  // needed by aggregateTicker's (unchanged) Pyth feed step below regardless of
  // which rule performed the on-chain update for that ticker.
  const pythTickers = tickers.filter(
    (t) => host.config.packages.pyth_rule?.feeds?.[t] !== undefined,
  );
  const priceInfoByTicker = new Map<string, string>();
  pythTickers.forEach((t) => priceInfoByTicker.set(t, host.getPythFeed(t).price_info_object));

  // Group tickers for the on-chain update leg: selected rule first, then the
  // pyth_rule fallback for whatever the selected rule doesn't cover.
  const selectedRule = resolveOracleRule(host.oracleSource, opts.ruleOverrides);
  const selectedSupported = new Set(selectedRule.supportedTickers(host));
  const selectedGroup = tickers.filter((t) => selectedSupported.has(t));

  const groups: { rule: PriceUpdateRule; tickers: string[] }[] = [];
  if (selectedGroup.length > 0) groups.push({ rule: selectedRule, tickers: selectedGroup });

  if (host.oracleSource !== "pyth_rule") {
    const fallbackRule = resolveOracleRule("pyth_rule", opts.ruleOverrides);
    const fallbackSupported = new Set(fallbackRule.supportedTickers(host));
    const fallbackGroup = tickers.filter(
      (t) => !selectedSupported.has(t) && fallbackSupported.has(t),
    );
    if (fallbackGroup.length > 0) groups.push({ rule: fallbackRule, tickers: fallbackGroup });
  }

  // Fetch every group's off-chain payload concurrently (independent network
  // calls — no reason to serialize) and let ALL of them settle before the
  // first PTB mutation below, so a later group's fetch failure can never
  // leave an earlier group's moveCalls stranded in a caller-owned tx.
  const groupsWithData: { rule: PriceUpdateRule; tickers: string[]; data: RuleUpdateData }[] =
    await Promise.all(
      groups.map(async (group) => ({
        ...group,
        data: await group.rule.fetchUpdateData(host, group.tickers),
      })),
    );
  // Verified-`Update` handle per lazer-served ticker (one shared PTB value per
  // group) — consumed by the collector-feed leg below.
  const lazerUpdateByTicker = new Map<string, TransactionArgument>();
  for (const group of groupsWithData) {
    const handle: RuleUpdateHandle | undefined =
      (await group.rule.buildUpdateCalls(tx, host, group.data, group.tickers, {
        cache: opts.cache,
        sponsorFund: opts.sponsorFund,
      })) ?? undefined;
    // Route by the handle's kind discriminant — the one site the tag exists to
    // protect: a future non-lazer handle (e.g. a WaterxRule value) must never
    // be silently fed into pyth_lazer_rule::feed.
    if (handle?.kind === "pyth_lazer_rule") {
      for (const ticker of group.tickers) lazerUpdateByTicker.set(ticker, handle.update);
    }
  }

  // Aggregate each ticker, feeding whichever rules it is configured for.
  for (const ticker of tickers) {
    aggregateTicker(tx, host, {
      ticker,
      priceInfoObjectId: priceInfoByTicker.get(ticker),
      lazerUpdate: lazerUpdateByTicker.get(ticker),
    });
  }
}

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
 * `PriceUpdateRule` of EVERY source in the `host.oracleSources` fed set — see
 * `rule-registry.ts`.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import { aggregate as aggregateCall, newCollector } from "../generated/waterx_oracle/oracle.ts";
import type { OracleHost } from "./host.ts";
import type {
  OracleSource,
  PriceUpdateRule,
  RuleUpdateData,
  RuleUpdateHandle,
  UpdateDataProvider,
} from "./price-update-rule.ts";
import { OracleFeeSourceUnavailableError, type OracleFeeSource, type PythCache } from "./pyth.ts";
import { resolveOracleRule } from "./rule-registry.ts";
import { feedConstantRule } from "./rules/constant-rule.ts";
import { feedLazerRule } from "./rules/pyth-lazer-rule.ts";
import { feedPythRule } from "./rules/pyth-rule.ts";
import { maybeFeedSupra } from "./rules/supra-rule.ts";
import {
  feedWaterxRule,
  waterxEnvelopeOf,
  type WaterxSignedEnvelope,
} from "./rules/waterx-rule.ts";

/**
 * Resolve one group's off-chain update payload for {@link refreshOraclePrices}:
 * try `provider.get(source, tickers)` first (when a provider is configured),
 * falling back to the group's own live `rule.fetchUpdateData` on a cache miss
 * (`null`) or a throw from the provider — a broken/degraded cache must never
 * break the money path.
 *
 * A cache HIT is treated as a payload for a POSSIBLY-WIDER ticker set (a
 * provider commonly caches one whole-universe payload per source — see
 * {@link UpdateDataProvider}), so it is narrowed to exactly `group.tickers`
 * via `rule.narrowUpdateData` before use. This is load-bearing, not
 * defensive: without it a Pyth Core hit would emit an
 * `update_single_price_feed` — and charge its fee — for every cached feed
 * instead of just this group's, and a payload that cannot cover the group
 * (`narrowUpdateData` → `null`) would never reach the live-fetch fallback.
 * Each rule owns its own subsetting (Core subsets per-feed entries; Lazer's
 * indivisible payload passes whole iff fully covered), so the orchestrator
 * never branches on `kind` here. A hit whose `kind` doesn't match the
 * group's rule is a caller bug (the provider handed back a different rule's
 * payload), so that throws — via `narrowUpdateData`'s own
 * `assertRuleUpdateData` guard — instead of silently falling back.
 */
async function resolveGroupUpdateData(
  host: OracleHost,
  group: { source: OracleSource; rule: PriceUpdateRule; tickers: string[] },
  provider: UpdateDataProvider | undefined,
): Promise<RuleUpdateData> {
  if (provider) {
    let cached: RuleUpdateData | null = null;
    try {
      cached = await provider.get(group.source, group.tickers);
    } catch {
      // Provider errors must never break the money path — fall through to
      // the live fetch below exactly as a cache miss (`null`) would.
    }
    if (cached !== null) {
      // Wrong-kind hit throws inside narrowUpdateData (assertRuleUpdateData);
      // a hit that can't cover the group narrows to null → live-fetch below.
      const narrowed = group.rule.narrowUpdateData(host, cached, group.tickers);
      if (narrowed !== null) return narrowed;
    }
  }
  return group.rule.fetchUpdateData(host, group.tickers);
}

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
  args: {
    ticker: string;
    priceInfoObjectId?: string;
    lazerUpdate?: TransactionArgument;
    waterxEnvelope?: WaterxSignedEnvelope;
  },
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

  if (args.waterxEnvelope !== undefined) {
    // waterx_rule::collect_batch_latest verifies the batch signature and feeds
    // this collector's symbol from the batch. If the ticker's aggregator does
    // not (yet) weight `WaterxRule`, the contribution is silently dropped
    // on-chain — feeding ahead of the weight migration is safe for THIS tx.
    // CAVEAT (unlike lazer): the feed call records a per-symbol signed-
    // timestamp high-water mark REGARDLESS of weights, and a replayed
    // timestamp ABORTS (`EReplayedSignature`, audit F-014) — so two PTBs
    // carrying the same envelope for the same symbol cannot both land; the
    // second aborts even where waterx is unweighted. See WaterxRule's module
    // header.
    feedWaterxRule(tx, host, collector, args.waterxEnvelope);
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
 * Before that, the on-chain price *update* leg is routed by the
 * `host.oracleSources` fed set (see `rule-registry.ts`): EVERY listed source
 * updates the tickers its own `supportedTickers(host)` serves, all in this one
 * PTB. There is **no cross-source fallback** — a requested ticker NO listed
 * source serves, and that is not a constant-only ticker (which needs no
 * price-update leg), fails the build immediately with a clear error naming
 * the ticker and the list. That is the deliberate "fail the tx-build, don't
 * silently reroute" contract: a wrong-but-present feed id is NOT validated
 * here (it surfaces on-chain at dry-run); a ticker MISSING from every listed
 * source's feeds is caught here.
 *
 * Each source's fetch + build runs against its own infra, guaranteeing
 * per-rule PTB atomicity. A fee-source pre-check runs first (any listed
 * source's `requiresFeeSource`) BEFORE any off-chain fetch or PTB mutation —
 * so a fee-charging source with no `opts.feeSource` throws
 * `OracleFeeSourceUnavailable` with zero wasted network calls and zero stray
 * moveCalls. Only once that check passes do the off-chain fetches run — in
 * parallel across sources — and ALL settle before the first PTB mutation;
 * on-chain reads inside `buildUpdateCalls` can still fail mid-append for
 * other reasons — callers discard the tx on any throw.
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
    /**
     * The single resolved fee source for the Pyth update fee, forwarded
     * verbatim to each group's `PriceUpdateRule.buildUpdateCalls` as
     * `BuildUpdateOpts.feeSource`. Already-resolved by the caller (see
     * {@link OracleFeeSource}'s own doc for where/how) — this function makes
     * no sponsor-vs-gas decision itself, it only checks whether a source was
     * resolved at all. Ignored by rules with no update fee (e.g.
     * `pyth_lazer_rule`). Building with `feeSource` unset throws
     * `OracleFeeSourceUnavailable` (see `oracle/pyth.ts`) instead of
     * silently drawing from `tx.gas`.
     */
    feeSource?: OracleFeeSource;
    /**
     * @internal Test-only: layer fake `PriceUpdateRule`s on top of the
     * production registry (see `rule-registry.ts`'s `resolveOracleRule`).
     * Production callers never set this — routing is by `host.oracleSources`
     * alone.
     */
    ruleOverrides?: Partial<Record<OracleSource, PriceUpdateRule>>;
    /**
     * BE prefetch-cache seam: checked per group BEFORE that group's live
     * `rule.fetchUpdateData`. See {@link UpdateDataProvider}. A cache miss
     * (`null`) or a throw from the provider falls back to the live fetch —
     * a degraded/broken cache must never break the money path; a
     * kind-mismatched hit (the provider handed back the wrong rule's
     * payload) throws instead, since that is a caller bug, not a cache miss.
     */
    updateDataProvider?: UpdateDataProvider;
  } = {},
): Promise<void> {
  if (tickers.length === 0) return;
  // Dedupe the caller's list (order-preserving): a repeated ticker would
  // otherwise aggregate TWICE in this one PTB — wasted gas for every rule,
  // and a hard ABORT under waterx: the second `collect_batch_latest` carries
  // the same envelope, and the on-chain per-symbol replay guard rejects an
  // already-accepted signed timestamp (`EReplayedSignature`, F-014) even
  // inside a single transaction.
  tickers = [...new Set(tickers)];

  // price_info_object lookup for every ticker with a pyth_rule.feeds entry —
  // needed by aggregateTicker's (unchanged) Pyth feed step below regardless of
  // which rule performed the on-chain update for that ticker.
  const pythTickers = tickers.filter(
    (t) => host.config.packages.pyth_rule?.feeds?.[t] !== undefined,
  );
  const priceInfoByTicker = new Map<string, string>();
  pythTickers.forEach((t) => priceInfoByTicker.set(t, host.getPythFeed(t).price_info_object));

  // The fed set is a LIST (`host.oracleSources`, normalized + deduped at
  // client creation): ONE build carries every listed source's data, and the
  // chain's per-ticker weight tables decide which contributions count —
  // feeding an unweighted rule's PRICE is dropped on-chain, while starving a
  // weighted one aborts. That asymmetry is what makes weight migrations
  // safe: flip weights per ticker at any time while the fed set stays a
  // superset of every ticker's weighted set. (One caveat: waterx's feed call
  // burns a per-symbol signed-timestamp high-water mark regardless of
  // weights — see aggregateTicker's waterx branch.) Still NO fallback
  // BETWEEN sources: each group serves only the tickers its own feeds list.
  // Zero-ticker groups are dropped here so everything downstream (fee check,
  // fetch fan-out, update-leg build) can assume every group has work.
  const groups = host.oracleSources
    .map((source) => {
      const rule = resolveOracleRule(source, opts.ruleOverrides);
      const supported = new Set(rule.supportedTickers(host));
      return { source, rule, tickers: tickers.filter((t) => supported.has(t)) };
    })
    .filter((group) => group.tickers.length > 0);

  // Fail the tx-build (NOT client init, NOT a silent reroute) when NO listed
  // source has a feed for a requested ticker that actually needs a price
  // update. Only a CONSTANT-ONLY ticker is exempt — priced entirely by
  // `constant_rule`, it needs no update leg from any source. A DUAL-FEED ticker
  // (constant AND pyth) still needs its Pyth leg refreshed, so `isConstantTicker`
  // alone must NOT exempt it: with no source able to serve it, feeding an
  // unrefreshed Pyth leg would price it stale (or abort on a missing weighted
  // source). `priceInfoByTicker.has(t)` ⇔ the ticker has a `pyth_rule.feeds`
  // entry, so `constant && !hasPyth` is exactly constant-only. This catches a
  // MISSING feed; a present-but-WRONG feed id is deliberately not validated
  // here (it aborts on-chain at dry-run).
  const covered = new Set(groups.flatMap((group) => group.tickers));
  const isConstantOnly = (t: string) => host.isConstantTicker(t) && !priceInfoByTicker.has(t);
  const unservable = tickers.filter((t) => !covered.has(t) && !isConstantOnly(t));
  if (unservable.length > 0) {
    const sources = host.oracleSources.join(", ");
    throw new Error(
      `oracleSource [${sources}] has no feed configured for ticker(s): ` +
        `${unservable.join(", ")}. Sources are self-contained with no fallback — add ` +
        `feeds for them under a listed source, or list a source that serves them.`,
    );
  }

  // Fee-source pre-check, hoisted ABOVE the off-chain fetches and PTB build
  // below. It consults only `rule.requiresFeeSource` — known before any fetch
  // or PTB mutation — so a fee-charging source (Pyth Core) in the fed set with
  // no `feeSource` throws with ZERO wasted network calls and zero PTB
  // commands, rather than waiting for `buildPythPriceUpdateCalls`'s own
  // per-call guard to fire after the off-chain fetches already ran.
  if (!opts.feeSource && groups.some((group) => group.rule.requiresFeeSource)) {
    throw new OracleFeeSourceUnavailableError();
  }

  // Phase 1 — resolve every group's update data IN PARALLEL: the per-source
  // fetches (Hermes VAA / Lazer POST / quote-center GET) are independent
  // network calls on the tx-build money path, so a multi-source fed set must
  // not pay one RTT per source sequentially. ALL fetches settle before the
  // first PTB mutation below, so a fetch failure never strands moveCalls in a
  // caller-owned tx — and a failure in ANY group fails the whole build (a
  // listed source is load-bearing; silently building without it would starve
  // its weighted tickers on-chain).
  const dataByGroup = await Promise.all(
    groups.map((group) => resolveGroupUpdateData(host, group, opts.updateDataProvider)),
  );

  // Phase 2 — build each group's update leg sequentially, in list order, so
  // PTB command order stays deterministic. The carry step below is an
  // exhaustive switch over the group's rule kind: a future source whose feed
  // leg needs per-ticker data from its update leg must decide its carry here
  // — falling through silently would starve its weighted tickers on-chain.
  const lazerUpdateByTicker = new Map<string, TransactionArgument>();
  // Signed batch envelope per waterx-served ticker. Unlike Lazer's shared PTB
  // handle, waterx's verify+feed is bundled into `collect_batch_latest` in the
  // per-ticker feed leg, so its `buildUpdateCalls` emits nothing and the
  // envelope is carried straight from the group's fetched data.
  const waterxEnvelopeByTicker = new Map<string, WaterxSignedEnvelope>();
  for (const [i, group] of groups.entries()) {
    const data = dataByGroup[i] ?? null;
    const handle: RuleUpdateHandle | undefined =
      (await group.rule.buildUpdateCalls(tx, host, data, {
        cache: opts.cache,
        feeSource: opts.feeSource,
      })) ?? undefined;
    switch (group.rule.kind) {
      case "pyth_rule":
        // Core's update leg wrote the PriceInfoObjects in place — the feed
        // leg reads them by id (`priceInfoByTicker`), nothing to carry.
        break;
      case "pyth_lazer_rule":
        // Route by the handle's kind discriminant — the tag exists so a
        // non-lazer handle can never be silently fed into
        // pyth_lazer_rule::feed.
        if (handle?.kind === "pyth_lazer_rule") {
          for (const ticker of group.tickers) lazerUpdateByTicker.set(ticker, handle.update);
        }
        break;
      case "waterx_rule": {
        // waterx_rule emits no shared handle (verify+feed is bundled into the
        // per-ticker `collect_batch_latest`), so the envelope is carried
        // straight from this group's fetched data to the feed leg below.
        const envelope = waterxEnvelopeOf(data);
        if (envelope) {
          for (const ticker of group.tickers) waterxEnvelopeByTicker.set(ticker, envelope);
        }
        break;
      }
      default: {
        const exhausted: never = group.rule.kind;
        throw new Error(`refreshOraclePrices: unhandled rule kind '${String(exhausted)}'`);
      }
    }
  }

  // Aggregate each ticker, feeding whichever rules it is configured for.
  for (const ticker of tickers) {
    aggregateTicker(tx, host, {
      ticker,
      priceInfoObjectId: priceInfoByTicker.get(ticker),
      lazerUpdate: lazerUpdateByTicker.get(ticker),
      waterxEnvelope: waterxEnvelopeByTicker.get(ticker),
    });
  }
}

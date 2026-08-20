/**
 * Oracle aggregation — the orchestrator that composes rules into the shared
 * `Oracle`. This is the ONE file that knows about every rule: it builds a
 * `PriceCollector`, feeds whichever rules a ticker is configured for
 * (Lazer / WaterX / Supra / Constant), then `aggregate`s.
 *
 * Per ticker:
 *   collector = oracle::new_collector(ticker)
 *   [pyth_lazer_rule::feed]              when the update leg produced a verified lazer Update
 *   [waterx_rule::collect_single_…]      when the waterx group carried this symbol's signed data
 *   [supra_rule::feed]                   when supra is enabled + wired
 *   [constant_rule::feed]                when the ticker is a constant ticker
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
import { configuredOracleRules } from "./feeds.ts";
import type { OracleHost } from "./host.ts";
import type {
  OracleSource,
  PriceUpdateRule,
  RuleUpdateData,
  RuleUpdateHandle,
  UpdateDataProvider,
} from "./price-update-rule.ts";
import { resolveOracleRule } from "./rule-registry.ts";
import { feedConstantRule } from "./rules/constant-rule.ts";
import { feedLazerRule } from "./rules/pyth-lazer-rule.ts";
import { maybeFeedSupra } from "./rules/supra-rule.ts";
import {
  feedWaterxRule,
  feedWaterxRuleWithProof,
  waterxEnvelopeOf,
  waterxLeavesOf,
  type WaterxSignedEnvelope,
  type WaterxSignedLeaf,
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
 * defensive: a payload that cannot cover the group (`narrowUpdateData` →
 * `null`) would otherwise never reach the live-fetch fallback, and a wider
 * hit would push data for symbols this build never asked about. Each rule
 * owns its own subsetting (waterx subsets per-symbol leaves; Lazer's
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
 * - **Lazer** — fed when `lazerUpdate` is supplied: the verified update this
 *   PTB's lazer update leg produced with the network's verify entry
 *   (`update_v2::Update` on mainnet, `update::Update` on testnet — see
 *   `PythLazerRule.buildUpdateCalls`). If the ticker's aggregator does
 *   not (yet) weight `PythLazerRule`, the contribution is silently dropped
 *   on-chain — feeding ahead of the weight migration is harmless.
 * - **Supra** — fed alongside Lazer/WaterX when supra is enabled + wired
 *   (abstains on-chain for symbols it has no pair for).
 * - **Constant** — fed when the ticker is a constant ticker
 *   ({@link OracleHost.isConstantTicker}).
 *
 * "Dual-feed" (WaterX + Constant, or Lazer + WaterX) and "constant-only" are
 * not special cases — they fall out of which rules the ticker is in. Throws if
 * no rule applies.
 */
export function aggregateTicker(
  tx: Transaction,
  host: OracleHost,
  args: {
    ticker: string;
    lazerUpdate?: TransactionArgument;
    /** This ticker's signed Merkle leaf — the default waterx shape. */
    waterxLeaf?: WaterxSignedLeaf;
    /** Batch envelope covering this ticker — the fallback waterx shape. */
    waterxEnvelope?: WaterxSignedEnvelope;
  },
): void {
  const oraclePkg = host.config.packages.waterx_oracle.published_at;
  const collector = newCollector({
    package: oraclePkg,
    arguments: { symbol: args.ticker },
  })(tx) as unknown as TransactionArgument;

  let fed = false;

  if (args.lazerUpdate !== undefined) {
    feedLazerRule(tx, host, collector, args.lazerUpdate);
    fed = true;
  }

  // One waterx leg at most, and the leaf shape wins: both entries record the
  // same per-symbol signed-timestamp high-water mark and feed the same rule
  // witness into this collector, so emitting both would make the second one
  // abstain on its own predecessor's mark for no gain. `refreshOraclePrices`
  // only ever supplies one; a caller that passes both gets the cheaper leg.
  if (args.waterxLeaf !== undefined) {
    // waterx_rule::collect_single_with_proof re-derives the snapshot root from
    // this leaf + its proof, verifies the enclave signature over that root, and
    // feeds the price. If the ticker's aggregator does not (yet) weight
    // `WaterxRule`, the contribution is silently dropped on-chain — feeding
    // ahead of the weight migration is safe. See WaterxRule's module header for
    // the abort-vs-abstain split.
    feedWaterxRuleWithProof(tx, host, collector, args.waterxLeaf);
    fed = true;
  } else if (args.waterxEnvelope !== undefined) {
    // Fallback shape: collect_batch_latest re-verifies the WHOLE batch
    // signature (every item rebuilt in-PTB) and feeds this collector's symbol
    // out of it. Only reached against a quote-center with no leaf route.
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
      `no oracle rule configured for ticker '${args.ticker}' ` +
        "(no lazer update, no waterx signed price, not a constant ticker)",
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
 * {@link aggregateTicker} for a **constant-only** ticker — the price comes from
 * the on-chain `constant_rule::Config`, so no update leg of any kind is needed.
 *
 * Only correct for a ticker whose on-chain weighted set is `constant_rule`
 * alone. A ticker that is ALSO served by a price source (dual-feed) must go
 * through {@link refreshOraclePrices}, which runs that source's update leg and
 * feeds both — feeding only the constant leg here would leave the other
 * weighted rule absent from the collector and abort `aggregate` with
 * `EMissingPriceSource`.
 */
export function aggregateTickerWithConstant(
  tx: Transaction,
  host: OracleHost,
  args: { ticker: string },
): void {
  aggregateTicker(tx, host, { ticker: args.ticker });
}

/**
 * What {@link refreshOraclePrices} actually put in the PTB.
 *
 * - `refreshed` — tickers that got a collector + `oracle::aggregate` (deduped,
 *   in the caller's order).
 * - `skipped` — tickers the loaded config wires NO rule for, so there was
 *   nothing to feed. They are dropped from the PTB rather than failing the
 *   build; their on-chain price is whatever the `Oracle` already holds. A
 *   caller trading one of them should log/alert on this — the trading call is
 *   what will reject a too-stale price, and it does so on chain.
 */
export interface OracleRefreshSummary {
  refreshed: string[];
  skipped: string[];
}

/**
 * Refresh multiple tickers in one PTB. For each ticker {@link aggregateTicker}
 * feeds whichever rules it is configured for (Lazer if the lazer update leg
 * served it — see below — WaterX if its group carried a signed price, Supra
 * when enabled, Constant when it's a constant ticker).
 *
 * Before that, the on-chain price *update* leg is routed by the
 * `host.oracleSources` fed set (see `rule-registry.ts`): EVERY listed source
 * updates the tickers its own `supportedTickers(host)` serves, all in this one
 * PTB. There is **no cross-source fallback**, and a listed source the loaded
 * config has no block (or no `feeds`) for simply contributes nothing — the fed
 * set names what this client is WILLING to push; the config decides what it
 * CAN push. Listing a retired source is therefore not an error at any layer.
 *
 * A requested ticker the config wires no rule at all for is **skipped**, not
 * thrown on, and reported back in {@link OracleRefreshSummary.skipped}: the
 * PTB gets the legs the deployment actually has. A wrong-but-present feed id
 * is likewise not validated here — it surfaces on-chain at dry-run.
 *
 * Each source's fetch + build runs against its own infra, guaranteeing
 * per-rule PTB atomicity. A fee-source pre-check runs first (any listed
 * source's `requiresFeeSource`, over the groups that actually have work)
 * BEFORE any off-chain fetch or PTB mutation —
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
 * `pyth_lazer_rule::feed` against it. A lazer feed call on an aggregator that
 * does not (yet) weight `PythLazerRule` is silently dropped on-chain — so
 * lazer-routing a ticker ahead of its on-chain weight migration prices it
 * from the remaining weighted rules instead of failing. Conversely, starving
 * a rule the aggregator DOES weight aborts `EMissingPriceSource`, which is why
 * the fed set must stay a superset of every ticker's weighted set.
 */
export async function refreshOraclePrices(
  tx: Transaction,
  host: OracleHost,
  tickers: string[],
  opts: {
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
): Promise<OracleRefreshSummary> {
  if (tickers.length === 0) return { refreshed: [], skipped: [] };
  // Dedupe the caller's list (order-preserving): a repeated ticker would
  // otherwise aggregate TWICE in this one PTB — wasted gas for every rule, and
  // under waterx the second collect would be dead weight on top of that: the
  // on-chain per-symbol replay guard (F-014) sees its own predecessor's
  // high-water mark from earlier in this same transaction and abstains, so the
  // repeat pays full verification cost to contribute nothing.
  tickers = [...new Set(tickers)];

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
  // Zero-ticker groups are dropped here so everything downstream (fetch
  // fan-out, update-leg build) can assume every group has work.
  const groups = host.oracleSources
    .map((source) => {
      const rule = resolveOracleRule(source, opts.ruleOverrides);
      const supported = new Set(rule.supportedTickers(host));
      return { source, rule, tickers: tickers.filter((t) => supported.has(t)) };
    })
    .filter((group) => group.tickers.length > 0);

  // SKIP — do not throw — the requested tickers no listed source can price.
  // The fed set and the config's rule blocks are both deployment-owned and
  // both move (testnet retired `pyth_rule` outright), so a build must not die
  // because a caller's ticker list is wider than what the deployment currently
  // prices; it builds the legs that exist and reports the rest as
  // {@link OracleRefreshSummary.skipped}. This handles a MISSING feed only —
  // a present-but-WRONG feed id is deliberately not validated here (it aborts
  // on-chain at dry-run).
  //
  // The one exemption is deliberately narrow: a ticker needs no update leg
  // only when `constant_rule` is the ONLY rule the config wires for it, since
  // its price lives entirely on chain. A ticker that is constant AND carries a
  // price source's feed (dual-feed) is NOT exempt — feeding just the constant
  // leg would leave the other, still-weighted rule absent from the collector
  // and abort `EMissingPriceSource`, which is strictly worse than leaving the
  // ticker out of this refresh.
  const covered = new Set(groups.flatMap((group) => group.tickers));
  const isConstantOnly = (t: string) =>
    host.isConstantTicker(t) &&
    configuredOracleRules(host.config, t).every((rule) => rule === "constant_rule");
  const servable = (t: string) => covered.has(t) || isConstantOnly(t);
  const skipped = tickers.filter((t) => !servable(t));
  if (skipped.length > 0) {
    // Everything below (fetch fan-out, update-leg build, aggregate loop) works
    // off the narrowed list. `groups` already holds only servable tickers.
    tickers = tickers.filter(servable);
    if (tickers.length === 0) return { refreshed: [], skipped };
  }

  // Phase 1 — resolve every group's update data IN PARALLEL: the per-source
  // fetches (Lazer POST / quote-center GET) are independent
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
  // Signed waterx data per served ticker — a per-symbol Merkle leaf normally, a
  // shared batch envelope on the fallback shape. Unlike Lazer's shared PTB
  // handle, waterx's verify+feed is bundled into the per-ticker collect call, so
  // its `buildUpdateCalls` emits nothing and the signed data is carried straight
  // from the group's fetched data.
  const waterxLeafByTicker = new Map<string, WaterxSignedLeaf>();
  const waterxEnvelopeByTicker = new Map<string, WaterxSignedEnvelope>();
  for (const [i, group] of groups.entries()) {
    const data = dataByGroup[i] ?? null;
    const handle: RuleUpdateHandle | undefined =
      (await group.rule.buildUpdateCalls(tx, host, data, {})) ?? undefined;
    switch (group.rule.kind) {
      case "pyth_lazer_rule": {
        // Route by the handle's kind discriminant — the tag exists so a
        // non-lazer handle can never be silently fed into
        // pyth_lazer_rule::feed.
        if (handle?.kind === "pyth_lazer_rule") {
          for (const ticker of group.tickers) lazerUpdateByTicker.set(ticker, handle.update);
        } else {
          // Fail the BUILD, naming the cause — mirrors the waterx guard below.
          // A lazer group has exactly one way to reach its feed leg (this
          // handle), and `refreshOraclePrices` already vouched these tickers as
          // servable, so no handle means the rule broke its own contract.
          // Left alone it surfaces two frames later as `aggregateTicker`'s
          // generic "no oracle rule configured for ticker" — which points at
          // the config rather than at the rule that actually misbehaved.
          throw new Error(
            "pyth_lazer_rule.buildUpdateCalls returned no verified Update handle for " +
              `ticker(s): ${group.tickers.join(", ")}. Its feed leg has no other source ` +
              "for the Update — a rule that serves tickers must return a " +
              "`{ kind: 'pyth_lazer_rule', update }` handle.",
          );
        }
        break;
      }
      case "waterx_rule": {
        // waterx_rule emits no shared handle (verify+feed is bundled into the
        // per-ticker collect call), so the signed data is carried straight from
        // this group's fetched data to the feed leg below. Leaves are per-symbol
        // and indexed BY symbol — never fanned out across the group like the
        // envelope, since each leaf only verifies for its own symbol
        // (`ECollectorSymbolMismatch`). A leaf for a symbol outside this group is
        // dropped rather than carried: the feed leg is keyed by ticker anyway.
        const leaves = waterxLeavesOf(data);
        // `length > 0` matters: `{ leaves: [] }` is shape-valid (`[].every(...)`
        // is `true`), so a bare truthiness test would TAKE this branch, carry
        // nothing, and `break` past the envelope branch below.
        if (leaves && leaves.length > 0) {
          const served = new Set(group.tickers);
          for (const leaf of leaves) {
            if (served.has(leaf.symbol)) waterxLeafByTicker.set(leaf.symbol, leaf);
          }
        } else {
          const envelope = waterxEnvelopeOf(data);
          if (envelope) {
            for (const ticker of group.tickers) waterxEnvelopeByTicker.set(ticker, envelope);
          }
        }
        // Fail the BUILD, not the chain. Both suppliers of `data` already
        // guarantee full coverage — the live fetch through `assertCoverage`, a
        // cached payload through `narrowUpdateData` (which returns `null`, i.e.
        // "miss → live fetch", rather than a partial) — so reaching here with a
        // ticker uncarried means one of those invariants broke. Left alone it
        // emits a collector with no waterx leg, which surfaces MUCH later as an
        // opaque on-chain `EMissingPriceSource` (or, if the rule is unweighted
        // for that ticker, as a silently thinner weighted set). This names the
        // tickers instead.
        const uncarried = group.tickers.filter(
          (t) => !waterxLeafByTicker.has(t) && !waterxEnvelopeByTicker.has(t),
        );
        if (uncarried.length > 0) {
          throw new Error(
            `waterx_rule update data carries no signed price for ticker(s): ${uncarried.join(", ")}. ` +
              "Expected one signed leaf per ticker (or a batch envelope covering all of " +
              "them) — a payload that serves none of a group's tickers must be reported " +
              "as a miss, not fed.",
          );
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
      lazerUpdate: lazerUpdateByTicker.get(ticker),
      waterxLeaf: waterxLeafByTicker.get(ticker),
      waterxEnvelope: waterxEnvelopeByTicker.get(ticker),
    });
  }

  return { refreshed: tickers, skipped };
}

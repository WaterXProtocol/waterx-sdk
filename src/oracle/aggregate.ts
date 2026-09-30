/**
 * Oracle aggregation — the orchestrator that composes rules into the shared
 * `Oracle`. This is the ONE file that knows about every rule: it builds a
 * `PriceCollector`, feeds whichever rules a ticker is configured for
 * (Lazer / Waterx / Constant), then `aggregate`s.
 *
 * Per ticker:
 *   collector = oracle::new_collector(ticker)
 *   [pyth_lazer_rule::feed] when the update leg produced a verified lazer Update
 *   [waterx_rule::collect_*] when the update leg fetched signed waterx data
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
import {
  oracleCredentialsFromHost,
  type OracleSource,
  type PriceUpdateRule,
  type RuleUpdateData,
  type RuleUpdateHandle,
  type UpdateDataProvider,
} from "./price-update-rule.ts";
import { resolveOracleRule } from "./rule-registry.ts";
import { feedConstantRule } from "./rules/constant-rule.ts";
import { feedLazerRule } from "./rules/pyth-lazer-rule.ts";
import {
  feedWaterxRule,
  feedWaterxRuleWithProof,
  waterxEnvelopeOf,
  waterxLeavesOf,
  type WaterxSignedEnvelope,
  type WaterxSignedLeaf,
} from "./rules/waterx-rule.ts";
import { partitionServableTickers } from "./validate.ts";

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
 * `null`) would never reach the live-fetch fallback without it, and a
 * divisible payload (waterx leaves) is subset instead of fanned out whole.
 * Each rule owns its own subsetting (waterx subsets per-symbol leaves;
 * Lazer's indivisible payload passes whole iff fully covered), so the
 * orchestrator never branches on `kind` here. A hit whose `kind` doesn't
 * match the group's rule is a caller bug (the provider handed back a
 * different rule's payload), so that throws — via `narrowUpdateData`'s own
 * `assertRuleUpdateData` guard — instead of silently falling back.
 */
async function resolveCachedUpdateData(
  host: OracleHost,
  group: { source: OracleSource; rule: PriceUpdateRule; tickers: string[] },
  provider: UpdateDataProvider | undefined,
): Promise<RuleUpdateData> {
  if (!provider) return null;
  let cached: RuleUpdateData | null;
  try {
    cached = await provider.get(group.source, group.tickers);
  } catch {
    // Provider errors must never break the money path — report a miss and let
    // the caller live-fetch, exactly as a `null` return would.
    return null;
  }
  if (cached === null) return null;
  // Wrong-kind hit throws inside narrowUpdateData (assertRuleUpdateData); a
  // hit that can't cover the group narrows to null, i.e. a miss.
  return group.rule.narrowUpdateData(host, cached, group.tickers);
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
 * - **Waterx** — fed when `waterxLeaf` (default shape) or `waterxEnvelope`
 *   (fallback shape) is supplied; verify AND feed are bundled into the one
 *   collect call per collector.
 * - **Constant** — fed when the ticker is a constant ticker
 *   ({@link OracleHost.isConstantTicker}).
 *
 * "Dual-feed" (Lazer + Constant, or Lazer + Waterx) and "constant-only" are not
 * special cases — they fall out of which rules the ticker is in. Throws if no
 * rule applies.
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

  if (host.isConstantTicker(args.ticker)) {
    feedConstantRule(tx, host, collector);
    fed = true;
  }

  if (!fed) {
    throw new Error(
      `no oracle rule configured for ticker '${args.ticker}' (no lazer update, no waterx data, not a constant ticker)`,
    );
  }

  aggregateCall({
    package: oraclePkg,
    arguments: {
      oracle: tx.object(host.config.objects.oracle.oracle),
      collector,
    },
  })(tx);
}

/**
 * {@link aggregateTicker} for a **constant-only** ticker (no source update
 * needed — the price comes from the on-chain `constant_rule::Config`). Kept as
 * a named entry so constant-only call sites (e.g. WLP builders refreshing the
 * USDCUSD pool token) read as what they are; it adds nothing over
 * `aggregateTicker(tx, host, { ticker })`.
 */
export function aggregateTickerWithConstant(
  tx: Transaction,
  host: OracleHost,
  args: { ticker: string },
): void {
  aggregateTicker(tx, host, { ticker: args.ticker });
}

/**
 * What {@link refreshOraclePrices} actually put on chain.
 *
 * `skipped` holds the requested tickers NO listed source can price (and that
 * `constant_rule` does not pin). They got no collector and no aggregate, so
 * their on-chain price is whatever a previous transaction left — which is why
 * every caller whose ACTION depends on a ticker must check this rather than
 * assume the refresh covered its whole request.
 */
export interface OracleRefreshSummary {
  /** Tickers aggregated in this PTB — includes constant-pinned ones. */
  refreshed: string[];
  /** Requested tickers no listed source serves. */
  skipped: string[];
}

/**
 * Refresh multiple tickers in one PTB. For each ticker {@link aggregateTicker}
 * feeds whichever rules it is configured for (Lazer if the lazer update leg
 * served it, Waterx if the waterx leg fetched signed data for it — see below —
 * Constant when it's a constant ticker).
 *
 * Before that, the on-chain price *update* leg is routed by the
 * `host.oracleSources` fed set (see `rule-registry.ts`): EVERY listed source
 * updates the tickers its own `supportedTickers(config)` serves, all in this one
 * PTB. There is **no cross-source fallback** — a requested ticker NO listed
 * source serves, and that `constant_rule` does not pin (a pin needs no
 * price-update leg), is SKIPPED and named in
 * {@link OracleRefreshSummary.skipped} rather than thrown on: this is a broad
 * primitive callers sweep whole market lists through, so losing 29 tickers to
 * an unconfigured 30th is the wrong trade. Failing closed happens one level
 * up, where the ACTION is known — the `build*Tx` composers raise
 * `OracleTickerUnservedError` for the tickers their specific call depends on
 * (see `perp/tx-builders/common.ts`). A wrong-but-present feed id is NOT
 * validated here either; it surfaces on-chain at dry-run.
 *
 * Each source's fetch + build runs against its own infra, guaranteeing
 * per-rule PTB atomicity. A credential pre-check runs early: any group that
 * still needs to fetch, whose rule declares a `credential` the host does not
 * carry while `host.pyth.api_key` is unset, throws `LazerApiKeyMissing`
 * BEFORE any ORACLE fetch or PTB mutation — zero wasted oracle calls, zero
 * stray moveCalls. (With an `updateDataProvider` configured, its per-source
 * lookups run first so the check can be scoped to the groups the cache did
 * NOT serve; a consumer-implemented provider may do I/O of its own, so the
 * guarantee is about oracle fetches, not about every possible round trip.)
 * Only once that check passes do the off-chain fetches run — in
 * parallel across sources — and ALL settle before the first PTB mutation;
 * on-chain reads inside `buildUpdateCalls` can still fail mid-append for
 * other reasons — callers discard the tx on any throw.
 *
 * **Collector-feed leg is rule-aware:** a lazer-served group's
 * `buildUpdateCalls` returns the verified `Update` PTB value
 * ({@link RuleUpdateHandle}), and every ticker in that group is aggregated
 * with `lazerUpdate` set so {@link aggregateTicker} appends
 * `pyth_lazer_rule::feed` against it. A waterx-served group's signed data is
 * carried straight from its fetched payload to the per-ticker collect call.
 * A feed call on an aggregator that does not (yet) weight that rule is
 * silently dropped on-chain — so routing a ticker ahead of its on-chain
 * weight migration prices it from the remaining weighted rules instead of
 * failing.
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

  // The fed set is a LIST (`host.oracleSources`, derived from the config at
  // client creation): ONE build carries every listed source's data, and the
  // chain's per-ticker weight tables decide which contributions count —
  // feeding an unweighted rule's PRICE is dropped on-chain, while starving a
  // weighted one aborts. That asymmetry is what makes a weight migration
  // safe TO SEQUENCE: raise a weight only once the rule is fed everywhere,
  // and drop it before the feeds go. Nothing here keeps the fed set a
  // superset of the weighted set — a rule's feed list lives in waterx-config
  // and its weight on chain — so that ordering is the operator's, and
  // `assertOracleWeightCoverage` is its gate. (One caveat: waterx's feed call
  // burns a per-symbol signed-timestamp high-water mark regardless of
  // weights — see aggregateTicker's waterx branch.) Still NO fallback
  // BETWEEN sources: each group serves only the tickers its own feeds list.
  // Zero-ticker groups are dropped here so everything downstream (credential
  // check, fetch fan-out, update-leg build) can assume every group has work.
  const groups = host.oracleSources
    .map((source) => {
      const rule = resolveOracleRule(source, opts.ruleOverrides);
      const supported = new Set(rule.supportedTickers(host.config));
      return { source, rule, tickers: tickers.filter((t) => supported.has(t)) };
    })
    .filter((group) => group.tickers.length > 0);

  // The constant-pin exemption the partition below applies: pinning alone is
  // a safe exemption, where it once had to be narrowed to "constant-ONLY". A
  // source is listed exactly when it serves at least one ticker
  // (`deriveOracleSources` over `supportedTickers`), so a pinned ticker that
  // any configured source ALSO serves is already in the fed set and gets that
  // source's leg alongside the constant one. A constant-only collector is
  // therefore emitted only for a ticker no source in this config can serve —
  // or that every listing source failed to serve this round — which is
  // precisely the case the chain cannot weight to a source. The stricter test
  // guarded a gap the v1 schema allowed (a rule carrying informational feeds
  // while sitting outside the fed set) and that the consolidated document no
  // longer expresses.
  //
  // Catches a MISSING feed only; a present-but-WRONG feed id is deliberately
  // left to abort on-chain at dry-run.
  //
  // (The refreshed/skipped partition itself moves BELOW the fetches: a
  // partial-coverage source can shrink its group there, and a ticker that
  // loses its last source this round belongs in `skipped` too — same
  // authority, applied once, after coverage is actually known.)

  // Credential pre-check, hoisted ABOVE the oracle fetches and PTB build below
  // (the position the retired fee-source pre-check held). It consults only
  // `rule.credential` — known without fetching anything — so a keyless build
  // against an auth-first source (Lazer) in the fed set throws with ZERO
  // wasted ORACLE calls and zero PTB commands, rather than waiting for that
  // group's own fetch guard to fire after sibling groups' fetches already ran.
  // Fully generic: the kind→value mapping is the port's
  // (`oracleCredentialsFromHost`) and the ERROR is the rule's own, so this
  // loop names neither a credential kind nor a rule.
  //
  // It does NOT run before absolutely everything, and cannot: scoping it to
  // the groups that still need to fetch means knowing which ones the cache
  // served, and `UpdateDataProvider` is consumer-implemented, so its lookup
  // may do I/O. That is the trade — a provider round trip may precede the
  // throw, an oracle fetch never does — and it buys the scoping below.
  //
  // The check is scoped to the groups that will actually FETCH. An
  // `updateDataProvider` is a per-SOURCE cache (`get(source, tickers)`), so a
  // consumer holding the credential out-of-band for one source must not
  // exempt the whole fed set — with a waterx-only cache and a keyless Lazer
  // group, a blanket skip would let the quote-center GET fire before the
  // Lazer group failed. So cache lookups (no network) run first, and only the
  // groups that missed are credential-checked.
  //
  // Phase 0 — resolve cache hits. Cheap and network-free by contract.
  const cachedByGroup = await Promise.all(
    groups.map((group) => resolveCachedUpdateData(host, group, opts.updateDataProvider)),
  );
  const needsFetch = groups.filter((_, i) => cachedByGroup[i] === null);

  const credentials = oracleCredentialsFromHost(host);
  for (const { rule } of needsFetch) {
    if (rule.credential && !credentials[rule.credential.kind]) {
      throw rule.credential.missing();
    }
  }

  // Phase 1 — live-fetch whatever the cache did not serve, IN PARALLEL: the
  // per-source fetches (Lazer POST / quote-center GET) are independent network
  // calls on the tx-build money path, so a multi-source fed set must not pay
  // one RTT per source sequentially. ALL of them settle before the first PTB
  // mutation below, so a fetch failure never strands moveCalls in a
  // caller-owned tx — and a failure in ANY group fails the whole build (a
  // listed source is load-bearing; silently building without it would starve
  // its weighted tickers on-chain).
  const fetched = new Map<OracleSource, RuleUpdateData>();
  // Which tickers came back unserved, across every source. Collected flat: no
  // caller needs to know WHICH source declined, only that the ticker is gone.
  const unserved = new Set<string>();
  await Promise.all(
    needsFetch.map(async (group) => {
      // Partial coverage where the rule offers it (divisible payloads): one
      // unserved ticker must cost ITSELF, not the batch — under the strict
      // arm a single symbol the quote-center declined to serve failed every
      // sibling ticker's refresh and reported nothing. The gap flows into
      // the post-fetch partition below, where the unserved ticker is skipped
      // OUTRIGHT (see the `unserved` comment there for why no other leg —
      // constant pin included — may stand in for a configured source the
      // chain might weight).
      if (group.rule.fetchUpdateDataPartial) {
        const { data, missing } = await group.rule.fetchUpdateDataPartial(host, group.tickers);
        fetched.set(group.source, data);
        for (const ticker of missing) unserved.add(ticker);
      } else {
        fetched.set(group.source, await group.rule.fetchUpdateData(host, group.tickers));
      }
    }),
  );
  // A ticker ANY of its listing sources failed to serve this round is
  // UNSERVED — and unserved means SKIPPED OUTRIGHT, never "aggregate with
  // whatever legs are left". The chain's per-ticker weight tables are
  // invisible to this SDK, so a missing source cannot be proven unweighted —
  // and aggregating a collector that lacks a weighted source aborts the
  // WHOLE PTB in `aggregator::remove_outliers` (`EMissingPriceSource`); a
  // constant pin does not waive that requirement either. An on-chain abort
  // of the whole transaction is strictly worse than the skip, so the gap
  // costs the ticker, never the batch and never the PTB. The ticker leaves
  // EVERY group (an update leg for a ticker that gets no collector would be
  // dead weight), and lands in `skipped` below even where another source —
  // or a constant pin — could still feed it.
  //
  // A group emptied by that filter is DROPPED, not merely narrowed. The
  // zero-ticker guard above ran BEFORE the fetches, so without this a group
  // whose every ticker went unserved would still reach Phase 2 and append its
  // update leg — e.g. Lazer's `verify_le_ecdsa_update` — to the caller's PTB,
  // producing a command whose return value nothing consumes for a refresh that
  // reports zero refreshed tickers.
  const servedGroups = groups
    .map((group, i) => ({
      ...group,
      tickers: group.tickers.filter((t) => !unserved.has(t)),
      data: cachedByGroup[i] ?? fetched.get(group.source) ?? null,
    }))
    .filter((group) => group.tickers.length > 0);

  // The refreshed/skipped partition. A ticker no listed source can price, or
  // that lost a listing source this round (`unserved`), is SKIPPED — not
  // thrown on — and named in the returned summary. This is a broad
  // primitive: callers sweep whole market lists through it, and losing 29
  // tickers because the 30th is unserved is the wrong trade — the 29 still
  // need their prices on chain. Safety lives one level up, where the ACTION
  // is known: the `build*Tx` composers fail closed on the tickers their
  // specific call actually depends on (`assertTickersRefreshed` /
  // `assertWlpPoolRefreshed` in `perp/tx-builders/common.ts`); a bare caller
  // composing its own PTB reads `skipped` and decides for itself.
  //
  // The constant-only exemption applies ONLY at the CONFIG level (a pinned
  // ticker no source lists at all — the deployed USDCUSD shape, in no rule's
  // feed map): there the chain cannot weight a source this
  // deployment doesn't carry, so a constant-only collector is sound. A
  // FETCH-time gap gets no such exemption — the source is configured, the
  // chain may well weight it, and only the skip is provably safe.
  const covered = new Set(servedGroups.flatMap((group) => group.tickers));
  const configServable = new Set(partitionServableTickers(host, tickers, covered).servable);
  const refreshed: string[] = [];
  const skipped: string[] = [];
  for (const ticker of tickers) {
    (configServable.has(ticker) && !unserved.has(ticker) ? refreshed : skipped).push(ticker);
  }

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
  for (const group of servedGroups) {
    const { data } = group;
    const handle: RuleUpdateHandle | undefined =
      (await group.rule.buildUpdateCalls(tx, host, data)) ?? undefined;
    switch (group.rule.kind) {
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

  // Aggregate each REFRESHED ticker, feeding whichever rules it is configured
  // for. A skipped ticker gets no collector at all — aggregating one with no
  // feed leg would write an empty collector and abort `EMissingPriceSource`.
  for (const ticker of refreshed) {
    aggregateTicker(tx, host, {
      ticker,
      lazerUpdate: lazerUpdateByTicker.get(ticker),
      waterxLeaf: waterxLeafByTicker.get(ticker),
      waterxEnvelope: waterxEnvelopeByTicker.get(ticker),
    });
  }

  return { refreshed, skipped };
}

/**
 * Oracle aggregation — the orchestrator that composes rules into the shared
 * `Oracle`. This is the ONE file that knows about every rule: it builds a
 * `PriceCollector`, feeds whichever rules a ticker is configured for
 * (Lazer / Waterx / Supra / Constant), then `aggregate`s.
 *
 * Per ticker:
 *   collector = oracle::new_collector(ticker)
 *   [pyth_lazer_rule::feed] when the update leg produced a verified lazer Update
 *   [waterx_rule::collect_*] when the update leg fetched signed waterx data
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
import { resolveOracleRule } from "./rule-registry.ts";
import { feedConstantRule } from "./rules/constant-rule.ts";
import { feedLazerRule, LazerApiKeyMissingError } from "./rules/pyth-lazer-rule.ts";
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
 * `null`) would never reach the live-fetch fallback without it, and a
 * divisible payload (waterx leaves) is subset instead of fanned out whole.
 * Each rule owns its own subsetting (waterx subsets per-symbol leaves;
 * Lazer's indivisible payload passes whole iff fully covered), so the
 * orchestrator never branches on `kind` here. A hit whose `kind` doesn't
 * match the group's rule is a caller bug (the provider handed back a
 * different rule's payload), so that throws — via `narrowUpdateData`'s own
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
 * - **Waterx** — fed when `waterxLeaf` (default shape) or `waterxEnvelope`
 *   (fallback shape) is supplied; verify AND feed are bundled into the one
 *   collect call per collector.
 * - **Supra** — fed alongside the sources when supra is enabled + wired
 *   (abstains on-chain for symbols it has no pair for).
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
      `no oracle rule configured for ticker '${args.ticker}' (no lazer update, no waterx data, not a constant ticker)`,
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
 * Refresh multiple tickers in one PTB. For each ticker {@link aggregateTicker}
 * feeds whichever rules it is configured for (Lazer if the lazer update leg
 * served it, Waterx if the waterx leg fetched signed data for it — see below —
 * Supra when enabled, Constant when it's a constant ticker).
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
 * per-rule PTB atomicity. A credential pre-check runs first: any non-empty
 * group whose rule declares `requiredCredential: "pyth_api_key"` while
 * `host.pyth.api_key` is unset throws `LazerApiKeyMissing` BEFORE any
 * off-chain fetch or PTB mutation — zero wasted network calls, zero stray
 * moveCalls. Only once that check passes do the off-chain fetches run — in
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
): Promise<void> {
  if (tickers.length === 0) return;
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
  // Zero-ticker groups are dropped here so everything downstream (credential
  // check, fetch fan-out, update-leg build) can assume every group has work.
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
  // `constant_rule`, it needs no update leg from any source. Every source now
  // reads AND writes through its own feeds namespace, so `isConstantTicker`
  // alone decides the exemption. This catches a MISSING feed; a
  // present-but-WRONG feed id is deliberately not validated here (it aborts
  // on-chain at dry-run).
  const covered = new Set(groups.flatMap((group) => group.tickers));
  const unservable = tickers.filter((t) => !covered.has(t) && !host.isConstantTicker(t));
  if (unservable.length > 0) {
    const sources = host.oracleSources.join(", ");
    throw new Error(
      `oracleSource [${sources}] has no feed configured for ticker(s): ` +
        `${unservable.join(", ")}. Sources are self-contained with no fallback — add ` +
        `feeds for them under a listed source, or list a source that serves them.`,
    );
  }

  // Credential pre-check, hoisted ABOVE the off-chain fetches and PTB build
  // below (the position the retired fee-source pre-check held). It consults
  // only `rule.requiredCredential` — known before any fetch or PTB mutation —
  // so a keyless build against an auth-first source (Lazer) in the fed set
  // throws with ZERO wasted network calls and zero PTB commands, rather than
  // waiting for that group's own fetch guard to fire after sibling groups'
  // fetches already ran.
  for (const group of groups) {
    if (group.rule.requiredCredential === "pyth_api_key" && !host.pyth.api_key) {
      throw new LazerApiKeyMissingError();
    }
  }

  // Phase 1 — resolve every group's update data IN PARALLEL: the per-source
  // fetches (Lazer POST / quote-center GET) are independent network calls on
  // the tx-build money path, so a multi-source fed set must not pay one RTT
  // per source sequentially. ALL fetches settle before the first PTB mutation
  // below, so a fetch failure never strands moveCalls in a caller-owned tx —
  // and a failure in ANY group fails the whole build (a listed source is
  // load-bearing; silently building without it would starve its weighted
  // tickers on-chain).
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

  // Aggregate each ticker, feeding whichever rules it is configured for.
  for (const ticker of tickers) {
    aggregateTicker(tx, host, {
      ticker,
      lazerUpdate: lazerUpdateByTicker.get(ticker),
      waterxLeaf: waterxLeafByTicker.get(ticker),
      waterxEnvelope: waterxEnvelopeByTicker.get(ticker),
    });
  }
}

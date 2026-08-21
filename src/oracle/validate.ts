/**
 * `validate.ts` — boot-time oracle-deployment asserts consumers (FE/BE) fold
 * onto instead of each hand-rolling them:
 *
 * - {@link assertOracleWriteCoverage} — the "this fed set can actually price
 *   the tickers I care about" guard. Because every source reads through its
 *   own feeds namespace, write set == read set — passing this ALSO validates
 *   the read plane (there is deliberately no separate read-coverage assert).
 * - {@link missingOracleCredentials} — the env-shaped credential audit: which
 *   listed sources cannot run with the credentials this deployment supplied.
 *   Boot-time mirror of `refreshOraclePrices`'s own per-build credential
 *   pre-check (`aggregate.ts`), keyed off the same rule-owned
 *   `credential` declaration so the two can never disagree.
 *
 * Deliberately NOT called by `PerpClient` itself: client creation stays
 * guard-free (a source with absent feeds surfaces at tx-build for exactly the
 * tickers it can't serve). These are for consumers whose deployment policy is
 * "fail the BOOT, not the first trade".
 */

import type { OracleHost } from "./host.ts";
import {
  ORACLE_SOURCES,
  type OracleCredentialKind,
  type OracleCredentials,
  type OracleSource,
} from "./price-update-rule.ts";
import { resolveOracleRule } from "./rule-registry.ts";

// The credential-kind union is the PORT's (`price-update-rule.ts`, next to
// `credential`); re-exported here so consumers keep importing it off
// the validation surface they already use.
export type { OracleCredentialKind };

/**
 * A build depends on a ticker this client's fed set cannot price.
 *
 * Distinct from {@link OracleFedSetError}, which is about a deployment being
 * misconfigured at all. This one is per-BUILD: `refreshOraclePrices` skipped
 * the ticker (by design — see `OracleRefreshSummary`), and the composer decided
 * that particular ticker was load-bearing for the action being built.
 */
export class OracleTickerUnservedError extends Error {
  readonly tickers: string[];
  readonly sources: readonly string[];

  constructor(tickers: string[], sources: readonly string[], why?: string) {
    super(
      `fed set [${sources.join(", ")}] has no feed for ticker(s): ${tickers.join(", ")}. ` +
        (why ?? "This build depends on their prices, so it cannot proceed. ") +
        "Add feeds under a listed source, list a source that serves them, or pass " +
        "allowUnrefreshedPrices: true to build anyway against whatever price the " +
        "chain already holds.",
    );
    this.name = "OracleTickerUnservedError";
    this.tickers = tickers;
    this.sources = sources;
  }
}

/**
 * Assert this deployment's fed set can price every ticker in `tickers`.
 *
 * Throws {@link OracleTickerUnservedError} naming ALL the unservable ones (not
 * just the first — an operator fixing a config wants the whole list).
 *
 * This is the boot-time twin of the per-build behaviour, and it guards the gap
 * that per-build handling deliberately leaves open: `refreshOraclePrices`
 * SKIPS a ticker no source serves, and only a composer that happens to depend
 * on that ticker turns the skip into an error. A market nobody trades today
 * would therefore stay silently unpriceable until someone did. Pass the ticker
 * set your deployment cares about (typically every market) and find out at
 * boot instead.
 *
 * It does NOT check "every listed source has feeds" any more: the fed set is
 * derived from exactly that condition (see `deriveOracleSources`), so that
 * assert became unreachable for any real client — it could only fire for a
 * config mutated after construction, which is a test fixture, not a
 * deployment. Write set == read set by construction (each source reads its own
 * feeds), so this single assert still covers both planes.
 */
export function assertOracleWriteCoverage(host: OracleHost, tickers: readonly string[]): void {
  const { unservable } = partitionServableTickers(host, tickers);
  if (unservable.length > 0) {
    throw new OracleTickerUnservedError(unservable, host.oracleSources);
  }
}

/** Tickers the client's LISTED sources carry a feed for. */
function fedSetTickers(host: OracleHost): Set<string> {
  return new Set(
    host.oracleSources.flatMap((source) => resolveOracleRule(source).supportedTickers(host)),
  );
}

/**
 * Tickers ANY rule in this config carries a feed for — listed or not.
 *
 * The fed set answers "can THIS client price it"; this answers "does the chain
 * plausibly weight a price-update rule for it", which is what decides whether
 * a constant leg alone is the whole picture. `supra_rule` counts (it is a
 * weighted leg even though it is not an `OracleSource`) but only when it is
 * actually wired — an unwired block's feeds map is documented as
 * informational, and honouring a stale one would strand constant-only tickers
 * for no benefit.
 */
function tickersWithAnySourceFeed(host: OracleHost): Set<string> {
  const out = new Set<string>();
  for (const source of ORACLE_SOURCES) {
    for (const ticker of resolveOracleRule(source).supportedTickers(host)) out.add(ticker);
  }
  if (host.getSupraRule() !== undefined) {
    for (const ticker of Object.keys(host.config.packages.supra_rule?.feeds ?? {})) out.add(ticker);
  }
  return out;
}

/**
 * THE acceptance predicate, in partition form — the single definition of
 * "will `refreshOraclePrices` put a price on chain for this ticker".
 *
 * A ticker is servable when some LISTED source's feeds carry it, or when it is
 * CONSTANT-ONLY: `constant_rule` pins it and no other rule in the config feeds
 * it. The stricter constant test matters — a constant-pinned ticker that some
 * other rule also feeds gets aggregated from a constant-only collector, and if
 * the chain weights that other rule the aggregate aborts `EMissingPriceSource`.
 * (`aggregateTicker` only appends a supra leg when a price-update source
 * already fed the collector, so a constant-only collector can never carry one.)
 *
 * `covered` lets a caller that has ALREADY resolved which of its tickers its
 * fed set serves — `refreshOraclePrices`, off its rule groups — pass that in
 * rather than have it recomputed. Both callers therefore share one rule, which
 * is the point: a consumer pre-filtering with {@link servableTickers} cannot
 * hand the build a ticker it will silently skip.
 *
 * Order-preserving. The `anyFeed` set is built at most once per call, and only
 * when a constant-pinned ticker actually needs it.
 */
export function partitionServableTickers(
  host: OracleHost,
  tickers: readonly string[],
  covered?: ReadonlySet<string>,
): { servable: string[]; unservable: string[] } {
  const fed = covered ?? fedSetTickers(host);
  const servable: string[] = [];
  const unservable: string[] = [];
  let anyFeed: Set<string> | undefined;

  for (const ticker of tickers) {
    if (fed.has(ticker)) {
      servable.push(ticker);
    } else if (host.isConstantTicker(ticker)) {
      anyFeed ??= tickersWithAnySourceFeed(host);
      (anyFeed.has(ticker) ? unservable : servable).push(ticker);
    } else {
      unservable.push(ticker);
    }
  }
  return { servable, unservable };
}

/**
 * The subset of `tickers` this deployment's fed set can actually price — the
 * servable half of {@link partitionServableTickers}, which is literally the
 * rule `refreshOraclePrices` applies.
 */
export function servableTickers(host: OracleHost, tickers: readonly string[]): string[] {
  return partitionServableTickers(host, tickers).servable;
}

/**
 * Which of `sources` cannot run with the supplied credentials — one row per
 * (source, missing credential). Empty array ⇒ the fed set is fully
 * credentialed. Pure and env-shaped on purpose: consumers call it from their
 * boot-time env asserts (zod superRefine, config validators) BEFORE any
 * client exists, passing the raw values their env resolved. The per-build
 * enforcement twin — `refreshOraclePrices`'s credential pre-check — reads the
 * same rule-owned `credential` declaration, so a deployment this function passes
 * cannot later trip that check for a listed source.
 */
export function missingOracleCredentials(
  sources: readonly OracleSource[],
  creds: { pythApiKey?: string },
): { source: OracleSource; credential: OracleCredentialKind }[] {
  // The env-shaped bag, normalized to the kind-keyed shape ONCE — the check
  // below then never mentions a specific kind.
  const supplied: OracleCredentials = { pyth_api_key: creds.pythApiKey };
  const missing: { source: OracleSource; credential: OracleCredentialKind }[] = [];
  for (const source of sources) {
    const required = resolveOracleRule(source).credential?.kind;
    if (required !== undefined && !supplied[required]) {
      missing.push({ source, credential: required });
    }
  }
  return missing;
}

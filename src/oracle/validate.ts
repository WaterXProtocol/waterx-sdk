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
import type { OracleCredentialKind, OracleCredentials, OracleSource } from "./price-update-rule.ts";
import { resolveOracleRule } from "./rule-registry.ts";

// The credential-kind union is the PORT's (`price-update-rule.ts`, next to
// `credential`); re-exported here so consumers keep importing it off
// the validation surface they already use.
export type { OracleCredentialKind };

/**
 * A build depends on a ticker this client's fed set cannot price.
 *
 * Raised from two places, deliberately the same type: the per-BUILD composers
 * (`refreshOraclePrices` skipped the ticker by design — see
 * `OracleRefreshSummary` — and the composer decided it was load-bearing for
 * the action) and the boot-time {@link assertOracleWriteCoverage}. One error
 * for one question: "this fed set cannot price these tickers".
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
 * SCOPE, post-v2 — read this before relying on it. The quote-center serves the
 * whole `symbols` universe, so `waterx_rule` (always wired: its block is
 * schema-required) makes every symbol servable. What this assert still catches
 * is a requested ticker OUTSIDE `symbols` and not constant-pinned — e.g. a
 * market or pool token the document never introduced as a symbol. What it can
 * NO LONGER catch is a symbol the document lists but the quote-center does not
 * actually serve; that surfaces at the first build's fetch instead. Verifying
 * the on-chain half is `assertOracleWeightCoverage` (`weight-coverage.ts`),
 * which reads the aggregators.
 */
export function assertOracleWriteCoverage(host: OracleHost, tickers: readonly string[]): void {
  const { unservable } = partitionServableTickers(host, tickers);
  if (unservable.length > 0) {
    throw new OracleTickerUnservedError(unservable, host.oracleSources);
  }
}

/** Tickers the client's LISTED sources serve. */
function fedSetTickers(host: OracleHost): Set<string> {
  return new Set(
    host.oracleSources.flatMap((source) => resolveOracleRule(source).supportedTickers(host.config)),
  );
}

/**
 * THE acceptance predicate, in partition form — the single definition of
 * "will `refreshOraclePrices` put a price on chain for this ticker".
 *
 * A ticker is servable when some LISTED source serves it, or when
 * `constant_rule` pins it. No stricter constant test is needed: a source is
 * listed exactly when it serves at least one ticker (`deriveOracleSources`),
 * so a constant-pinned ticker that any source also serves is ALREADY in the
 * fed set and gets that source's leg alongside the constant one — a
 * constant-only collector is only ever emitted for a ticker no source in the
 * config can serve, which the chain cannot weight to a source.
 *
 * `covered` lets a caller that has ALREADY resolved which of its tickers its
 * fed set serves — `refreshOraclePrices`, off its rule groups — pass that in
 * rather than have it recomputed. Both callers therefore share one rule, which
 * is the point: a consumer pre-filtering with {@link servableTickers} cannot
 * hand the build a ticker it will silently skip.
 *
 * Order-preserving.
 */
export function partitionServableTickers(
  host: OracleHost,
  tickers: readonly string[],
  covered?: ReadonlySet<string>,
): { servable: string[]; unservable: string[] } {
  const fed = covered ?? fedSetTickers(host);
  const servable: string[] = [];
  const unservable: string[] = [];
  for (const ticker of tickers) {
    (fed.has(ticker) || host.isConstantTicker(ticker) ? servable : unservable).push(ticker);
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

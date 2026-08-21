/**
 * `validate.ts` — boot-time oracle-deployment asserts consumers (FE/BE) fold
 * onto instead of each hand-rolling them:
 *
 * - {@link assertOracleWriteCoverage} — the "this fed set can actually write"
 *   guard: every listed source must have a non-empty feeds block in the
 *   loaded config. Because every source reads through its own feeds
 *   namespace, write set == read set — passing this ALSO validates the read
 *   plane (there is deliberately no separate read-coverage assert).
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
 * Thrown by {@link assertOracleWriteCoverage} for a listed source whose
 * feeds block is missing or empty in the loaded config — that source can
 * serve NO ticker, so listing it is config drift, not a working fed set.
 * `instanceof`-able; `source` names the offender for operator dashboards.
 */
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

export class OracleFedSetError extends Error {
  /** The listed source with no servable tickers. */
  readonly source: OracleSource;

  constructor(source: OracleSource) {
    super(
      `oracle source '${source}' is listed in ORACLE_SOURCE but the loaded config gives it no ` +
        `feeds — it can serve no ticker (write OR read). Fix the deployment's config (publish ` +
        `the source's feeds block) or drop the source from the list.`,
    );
    this.name = "OracleFedSetError";
    this.source = source;
  }
}

/**
 * Assert every source in `host.oracleSources` can serve at least one ticker
 * under the loaded config (its `supportedTickers(host)` is non-empty).
 * Throws {@link OracleFedSetError} naming the first empty source.
 *
 * Write set == read set by construction (each source reads its own feeds),
 * so this single assert covers both planes — the old read-coverage check is
 * resolved-by-design, not merely dropped.
 */
export function assertOracleWriteCoverage(host: OracleHost): void {
  for (const source of host.oracleSources) {
    const rule = resolveOracleRule(source);
    if (rule.supportedTickers(host).length === 0) {
      throw new OracleFedSetError(source);
    }
  }
}

/**
 * The subset of `tickers` this deployment's fed set can actually price — the
 * SAME acceptance rule `refreshOraclePrices` enforces, so a caller that
 * pre-filters with this can never hand it a ticker it will reject: a ticker is
 * servable when some LISTED source's feeds carry it, or when `constant_rule`
 * pins it (a constant ticker needs no update leg from any source).
 *
 * Order-preserving, and keyed off `host.oracleSources` rather than "any rule
 * that exists" — a pool token only `waterx_rule` serves is NOT servable to a
 * lazer-only client, and pretending otherwise is exactly how a refresh throws
 * mid-build.
 */
export function servableTickers(host: OracleHost, tickers: readonly string[]): string[] {
  const fedSet = new Set(
    host.oracleSources.flatMap((source) => resolveOracleRule(source).supportedTickers(host)),
  );
  return tickers.filter((ticker) => fedSet.has(ticker) || host.isConstantTicker(ticker));
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

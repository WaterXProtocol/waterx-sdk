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
 *   `requiredCredential` so the two can never disagree.
 *
 * Deliberately NOT called by `PerpClient` itself: client creation stays
 * guard-free (a source with absent feeds surfaces at tx-build for exactly the
 * tickers it can't serve). These are for consumers whose deployment policy is
 * "fail the BOOT, not the first trade".
 */

import type { OracleHost } from "./host.ts";
import type { OracleSource } from "./price-update-rule.ts";
import { resolveOracleRule } from "./rule-registry.ts";

/**
 * Thrown by {@link assertOracleWriteCoverage} for a listed source whose
 * feeds block is missing or empty in the loaded config — that source can
 * serve NO ticker, so listing it is config drift, not a working fed set.
 * `instanceof`-able; `source` names the offender for operator dashboards.
 */
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

/** The credential kinds a rule can declare via `PriceUpdateRule.requiredCredential`. */
export type OracleCredentialKind = "pyth_api_key";

/**
 * Which of `sources` cannot run with the supplied credentials — one row per
 * (source, missing credential). Empty array ⇒ the fed set is fully
 * credentialed. Pure and env-shaped on purpose: consumers call it from their
 * boot-time env asserts (zod superRefine, config validators) BEFORE any
 * client exists, passing the raw values their env resolved. The per-build
 * enforcement twin — `refreshOraclePrices`'s credential pre-check — reads the
 * same rule-owned `requiredCredential`, so a deployment this function passes
 * cannot later trip that check for a listed source.
 */
export function missingOracleCredentials(
  sources: readonly OracleSource[],
  creds: { pythApiKey?: string },
): { source: OracleSource; credential: OracleCredentialKind }[] {
  const missing: { source: OracleSource; credential: OracleCredentialKind }[] = [];
  for (const source of sources) {
    const required = resolveOracleRule(source).requiredCredential;
    if (required === "pyth_api_key" && !creds.pythApiKey) {
      missing.push({ source, credential: required });
    }
  }
  return missing;
}

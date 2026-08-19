/**
 * `source-list.ts` — THE parser for a consumer's `ORACLE_SOURCE` env string
 * (comma list of `OracleSource` values → the fed set). The FE and BE
 * previously carried twin hand-written parsers whose semantics drifted once
 * in review (a trailing comma booted one deployment green and 500'd the
 * other); this canonical behavior is what both fold onto:
 *
 *  - split on `,`, trim entries, DROP empties (trailing/doubled commas are
 *    the most common env typo, never a boot failure)
 *  - validate every entry against {@link ORACLE_SOURCES}
 *  - dedupe, order-preserving (list order is consumer read-plane policy —
 *    the SDK's own fed-set build treats the list as a set)
 *  - throw an operator-actionable error on empty/unset/invalid input —
 *    there is NO default oracle source
 *
 * The SDK still never reads `process.env` — callers pass the raw string.
 *
 * STRICTER than the consumers' previous `in`-operator checks: a value named
 * like an `Object.prototype` key (`toString`, `constructor`, …) passed those
 * and died deep in the stack; `Set.has` rejects it here at parse.
 *
 * Zod adopters: this THROWS a plain Error. Inside a zod `.transform()` a
 * throw escapes `schema.parse()` un-aggregated and masks sibling issues —
 * wrap it: `try { return parseOracleSourceList(raw); } catch (e) {
 * ctx.addIssue({ code: "custom", message: (e as Error).message }); return
 * z.NEVER; }`.
 */

import { ORACLE_SOURCES, type OracleSource } from "./price-update-rule.ts";

// Widened-annotation Set (not an assertion) so the type predicate below
// narrows by CONSTRUCTION rather than by cast.
const ORACLE_SOURCE_SET: ReadonlySet<string> = new Set(ORACLE_SOURCES);

/**
 * THE runtime membership check for {@link ORACLE_SOURCES} — the parser below
 * and `PerpClient`'s ctor validation both use this one predicate, so the env
 * parser and the create-option front door can never disagree. `Set.has`,
 * never `in`/bracket reads (prototype-chain safe by construction).
 */
export function isOracleSource(value: string): value is OracleSource {
  return ORACLE_SOURCE_SET.has(value);
}

export function parseOracleSourceList(raw: string | null | undefined): OracleSource[] {
  const parts = (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const sources = parts.filter(isOracleSource);
  if (parts.length === 0 || sources.length !== parts.length) {
    const got = raw == null || raw.trim() === "" ? "unset" : `'${raw}'`;
    // A deployment still carrying the 5.0.0-retired value gets told exactly
    // what happened rather than the generic "not a member" — the operator fix
    // (delete one list entry) is different in kind from a typo'd source name.
    const retiredHint = parts.includes("pyth_rule")
      ? " (pyth_rule retired — remove it from ORACLE_SOURCE)"
      : "";
    throw new Error(
      `ORACLE_SOURCE must be a comma-separated list of ${ORACLE_SOURCES.join(" | ")} ` +
        `(got ${got}) — there is NO default oracle source; set it in the deployment's env.` +
        retiredHint,
    );
  }

  return [...new Set(sources)];
}

/**
 * `rule-registry.ts` — maps a client-selected `OracleSource` to its concrete
 * `PriceUpdateRule` implementation. `refreshOraclePrices` (`aggregate.ts`) is
 * the only production caller; this is the one place `OracleSource` values are
 * wired to a rule instance. Selection is driven purely by the value passed in
 * (ultimately `OracleHost.oracleSource`, a client create option) — never by a
 * config JSON `enabled` flag and never by `process.env`.
 *
 * Both sources are registered: `pyth_rule` (`PythCoreRule`, Hermes VAA) and
 * `pyth_lazer_rule` (`PythLazerRule`, Lazer signed updates). Resolving a
 * source with no registered rule throws a clear `OracleSourceNotImplemented`
 * error instead of silently falling back to Pyth Core.
 */

import type { OracleSource, PriceUpdateRule } from "./price-update-rule.ts";
import { PythCoreRule } from "./rules/pyth-core-rule.ts";
import { PythLazerRule } from "./rules/pyth-lazer-rule.ts";

/**
 * Production registry. Frozen — tests inject a fake rule via
 * `resolveOracleRule`'s `overrides` param instead of mutating this.
 */
const DEFAULT_RULES: Partial<Record<OracleSource, PriceUpdateRule>> = Object.freeze({
  pyth_rule: PythCoreRule,
  pyth_lazer_rule: PythLazerRule,
});

/**
 * Thrown by {@link resolveOracleRule} when `source` has no `PriceUpdateRule`
 * registered in either the production registry or a test's `overrides` map.
 * `instanceof`-able (mirrors `OracleFeeSourceUnavailableError` in `pyth.ts`)
 * so a consumer can branch on the failure type directly instead of
 * string-matching `error.message`.
 */
export class OracleSourceNotImplementedError extends Error {
  /** The unregistered `OracleSource` that was requested. */
  readonly source: OracleSource;

  constructor(source: OracleSource) {
    super(`OracleSourceNotImplemented: ${source}`);
    this.name = "OracleSourceNotImplementedError";
    this.source = source;
  }
}

/**
 * Resolve the `PriceUpdateRule` registered for `source`.
 *
 * `overrides` — test-only — layers on top of the production registry so a
 * spec can inject a fake rule (e.g. a stub `pyth_lazer_rule`) without
 * touching {@link DEFAULT_RULES}; production callers never pass it.
 *
 * Throws {@link OracleSourceNotImplementedError} (`OracleSourceNotImplemented:
 * <source>`) when nothing is registered for `source` in either map.
 */
export function resolveOracleRule(
  source: OracleSource,
  overrides?: Partial<Record<OracleSource, PriceUpdateRule>>,
): PriceUpdateRule {
  const rule = overrides?.[source] ?? DEFAULT_RULES[source];
  if (!rule) {
    throw new OracleSourceNotImplementedError(source);
  }
  return rule;
}

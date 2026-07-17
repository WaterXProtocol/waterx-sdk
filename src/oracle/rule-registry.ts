/**
 * `rule-registry.ts` — maps a client-selected `OracleSource` to its concrete
 * `PriceUpdateRule` implementation. `refreshOraclePrices` (`aggregate.ts`) is
 * the only production caller; this is the one place `OracleSource` values are
 * wired to a rule instance. Selection is driven purely by the value passed in
 * (ultimately `OracleHost.oracleSource`, a client create option) — never by a
 * config JSON `enabled` flag and never by `process.env`.
 *
 * Only `pyth_rule` (`PythCoreRule`) is registered today. `pyth_lazer_rule` is
 * a valid `OracleSource` value — a future `PythLazerRule` will register it —
 * but resolving it before then throws a clear `OracleSourceNotImplemented`
 * error instead of silently falling back to Pyth Core.
 */

import type { OracleSource, PriceUpdateRule } from "./price-update-rule.ts";
import { PythCoreRule } from "./rules/pyth-core-rule.ts";

/** Production registry. Tests inject a fake rule via `resolveOracleRule`'s `overrides` param instead of mutating this. */
const DEFAULT_RULES: Partial<Record<OracleSource, PriceUpdateRule>> = {
  pyth_rule: PythCoreRule,
};

/**
 * Resolve the `PriceUpdateRule` registered for `source`.
 *
 * `overrides` — test-only — layers on top of the production registry so a
 * spec can inject a fake rule (e.g. a stub `pyth_lazer_rule`) without
 * touching {@link DEFAULT_RULES}; production callers never pass it.
 *
 * Throws `OracleSourceNotImplemented: <source>` when nothing is registered
 * for `source` in either map.
 */
export function resolveOracleRule(
  source: OracleSource,
  overrides?: Partial<Record<OracleSource, PriceUpdateRule>>,
): PriceUpdateRule {
  const rule = overrides?.[source] ?? DEFAULT_RULES[source];
  if (!rule) {
    throw new Error(`OracleSourceNotImplemented: ${source}`);
  }
  return rule;
}

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
 * Thrown by {@link assertOracleSourceConfigured} when a client selects an
 * `oracleSource` whose on-chain rule package is not configured on the network.
 */
export class OracleSourceNotConfiguredError extends Error {
  /** The selected `OracleSource` that the network config does not support. */
  readonly source: OracleSource;
  readonly network: string;

  constructor(source: OracleSource, network: string) {
    super(
      `OracleSourceNotConfigured: oracleSource '${source}' has no on-chain rule ` +
        `package (packages.${source} with feeds) in the ${network} config — that ` +
        `network does not support it. Configure it, or use the default 'pyth_rule'.`,
    );
    this.name = "OracleSourceNotConfiguredError";
    this.source = source;
    this.network = network;
  }
}

/**
 * Fail-fast guard for client creation. A selected `oracleSource` OTHER than the
 * always-present default `pyth_rule` must have its rule package (with feeds)
 * present in the loaded config for the network. Without this check, an
 * `oracleSource` whose config is absent — e.g. `pyth_lazer_rule` on mainnet —
 * would NOT error: `PythLazerRule.supportedTickers` returns `[]` (its
 * `packages.pyth_lazer_rule?.feeds ?? {}`), and `refreshOraclePrices` then
 * silently routes EVERY ticker through the `pyth_rule` fallback. The client
 * would run entirely on Pyth Core while believing it is on the selected source
 * — a dangerous silent misconfiguration. Throw {@link
 * OracleSourceNotConfiguredError} instead.
 */
export function assertOracleSourceConfigured(
  network: string,
  packages: Partial<Record<OracleSource, { feeds?: Record<string, unknown> }>>,
  source: OracleSource,
): void {
  if (source === "pyth_rule") return; // Pyth Core rule — the default, always present.
  const feeds = packages[source]?.feeds;
  if (!feeds || Object.keys(feeds).length === 0) {
    throw new OracleSourceNotConfiguredError(source, network);
  }
}

/**
 * Thrown by {@link assertPythGenerationCompatible} when a client running
 * `pythGeneration: 'pro'` would build the `pyth_rule` feed/update leg against
 * a rule package NOT compiled for the Pro generation. Move types are
 * package-qualified: the deployed core-compiled `pyth_rule::feed` takes the
 * CORE `PythState` type, so handing it the Pro state object aborts on-chain
 * with `CommandArgumentError { TypeMismatch }` deep in the money path
 * (verified on mainnet 2026-07-22). This turns that into a loud client-side
 * error. Cleared by a config whose `pyth_rule.generation === 'pro'` (i.e. a
 * Pro-compiled rule deployment).
 */
export class PythGenerationMismatchError extends Error {
  constructor() {
    super(
      "PythGenerationMismatch: pythGeneration 'pro' cannot build the pyth_rule feed leg — " +
        "the deployed pyth_rule Move package is compiled against the CORE pyth contracts, " +
        "so its feed rejects the Pro PythState on-chain (CommandArgumentError TypeMismatch). " +
        "Use 'core' for tx-building; 'pro' remains fine for data-plane reads. This gate " +
        "lifts only with an SDK release that binds a Pro-compiled rule package.",
    );
    this.name = "PythGenerationMismatchError";
  }
}

/**
 * Fail-fast for the pro-generation/core-rule mismatch above. Called by
 * `refreshOraclePrices` BEFORE any fetch or PTB mutation whenever the request
 * involves a `pyth_rule`-fed ticker; deliberately NOT called at client
 * creation, so data-plane-only 'pro' clients (price reads, prefetch caches)
 * keep working — only tx-building is refused.
 *
 * Unconditional on the config: only two rule packages exist (`pyth_rule`,
 * `pyth_lazer_rule`) and every deployed `pyth_rule` is Core-compiled. There
 * is deliberately NO config marker to lift this — a Pro-compiled rule would
 * be a new package needing new SDK bindings anyway, so the SDK release that
 * binds it removes this gate.
 */
export function assertPythGenerationCompatible(host: {
  pythGeneration?: "core" | "pro";
}): void {
  if ((host.pythGeneration ?? "core") !== "pro") return;
  throw new PythGenerationMismatchError();
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

/**
 * `source-list.ts` — THE fed set, derived from the deployment config.
 *
 * There is no `oracleSource` option and no `ORACLE_SOURCE` env var. Which
 * sources a build feeds is a property of the DEPLOYMENT, so it is read from
 * the same canonical JSON that carries their packages and feeds: a source is
 * in the fed set when its block is published AND carries at least one feed.
 *
 * Why derived rather than declared. The chain arbitrates — per-ticker weights
 * decide which contributions count, feeding an UNWEIGHTED rule is dropped
 * on-chain, and starving a WEIGHTED one aborts `EMissingPriceSource`. The
 * failure is therefore one-sided: over-feeding is free, under-feeding is fatal.
 * A hand-typed list errs in the fatal direction (the classic being one copied
 * between networks, naming a source that deployment does not carry); the
 * config cannot, because it IS what wires the rules. Mainnet derives
 * `[pyth_lazer_rule, waterx_rule]` and testnet `[waterx_rule]` with no
 * per-deployment configuration at all.
 *
 * Retired rules are inert here by construction: `pyth_rule` and
 * `pyth_sponsor_rule` still sit in the live configs, but neither is an
 * {@link ORACLE_SOURCES} member — there is no rule module that could feed one
 * — so their blocks are never consulted.
 *
 * Deliberately NOT filtered by which credentials the caller holds. A keyless
 * client whose config wires Lazer fails loudly at build
 * (`LazerApiKeyMissing`); silently dropping the source instead would starve a
 * rule the chain may weight and turn a clear build error into an opaque
 * on-chain abort.
 */

import type { OracleConfig } from "./config.ts";
import { ORACLE_SOURCES, type OracleSource } from "./price-update-rule.ts";

/**
 * The fed set this deployment wires: every implementable source with a
 * published package and a non-empty feeds map, in {@link ORACLE_SOURCES}
 * order.
 *
 * Pure and config-only, so consumers can call it before a client exists (e.g.
 * to pair with {@link missingOracleCredentials} in a boot assert).
 */
export function deriveOracleSources(config: OracleConfig): OracleSource[] {
  return ORACLE_SOURCES.filter((source) => {
    const block = config.packages[source];
    if (!block?.published_at || Object.keys(block.feeds ?? {}).length === 0) return false;
    // `enabled` is the one lever the schema offers for switching a source off,
    // and with routing derived from config it is the ONLY lever left — so it
    // is honoured here. Absent means ON: every live config omits it, and a
    // published block with feeds is a wired source. (`supra_rule` is
    // default-OFF and requires an explicit `true` — it is an auxiliary leg,
    // not a source, so the asymmetry is deliberate.)
    return block.enabled !== false;
  });
}

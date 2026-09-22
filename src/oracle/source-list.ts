/**
 * `source-list.ts` — THE fed set, derived from the deployment config.
 *
 * There is no `oracleSource` option and no `ORACLE_SOURCE` env var. Which
 * sources a build feeds is a property of the DEPLOYMENT, so it is read from
 * the same canonical document that wires the rules: a source is in the fed
 * set when its rule can serve at least one ticker — `oracle_rules.pyth_lazer`
 * published with `lazer_feed_ids` for Lazer, `oracle_rules.waterx` carrying
 * a non-empty `feeds` map for the quote-center (`served-tickers.ts` is where
 * each rule's list is read).
 *
 * Why derived rather than declared. The chain arbitrates — per-ticker weights
 * decide which contributions count, feeding an UNWEIGHTED rule is dropped
 * on-chain, and starving a WEIGHTED one aborts `EMissingPriceSource`. The
 * failure is therefore one-sided: over-feeding is free, under-feeding is fatal.
 * A hand-typed list errs in the fatal direction (the classic being one copied
 * between networks, naming a source that deployment does not carry); the
 * config cannot, because it IS what wires the rules — and it is also where a
 * deployment turns a source OFF: mainnet ships no `waterx.feeds`, so it
 * derives `[pyth_lazer_rule]`; testnet lists no Lazer block, so it derives
 * `[waterx_rule]`. No per-deployment SDK configuration either way.
 *
 * Retired rules are inert here by construction: `pyth_rule` (Pyth Core) is
 * not an {@link ORACLE_SOURCES} member — there is no rule module that could
 * feed it — and the v2 document no longer carries an `oracle_rules.pyth`
 * block at all.
 *
 * Deliberately NOT filtered by which credentials the caller holds. A keyless
 * client whose config wires Lazer fails loudly at build
 * (`LazerApiKeyMissing`); silently dropping the source instead would starve a
 * rule the chain may weight and turn a clear build error into an opaque
 * on-chain abort.
 */

import type { WaterXConfig } from "../config.ts";
import { ORACLE_SOURCES, type OracleSource } from "./price-update-rule.ts";
import { lazerServedTickers, waterxServedTickers } from "./served-tickers.ts";

/**
 * The fed set this deployment wires: every implementable source whose rule
 * serves at least one ticker, in {@link ORACLE_SOURCES} order. Each rule's
 * `supportedTickers` is the single definition of "wired", so this and the
 * per-ticker routing in `refreshOraclePrices` can never disagree.
 *
 * Pure and config-only, so consumers can call it before a client exists (e.g.
 * to pair with {@link missingOracleCredentials} in a boot assert).
 */
export function deriveOracleSources(config: WaterXConfig): OracleSource[] {
  // Reads the served sets directly rather than through `resolveOracleRule`:
  // the registry pulls in every rule module and its generated Move bindings,
  // which would break this function's config-only contract for a consumer
  // calling it before any client exists.
  return ORACLE_SOURCES.filter((source) =>
    source === "pyth_lazer_rule"
      ? lazerServedTickers(config).length > 0
      : waterxServedTickers(config).length > 0,
  );
}

/**
 * `weight-coverage.ts` — the ON-CHAIN half of "can this deployment price these
 * tickers", and the only place the fed-set invariant is actually enforced.
 *
 * Everything in `validate.ts` reasons from config alone: it answers "does some
 * listed source carry a feed for this ticker". That is necessary and not
 * sufficient, because the aggregator decides which contributions COUNT. The
 * dangerous shape is a ticker that is servable by config yet weighted to a rule
 * the fed set cannot supply: `refreshOraclePrices` happily aggregates it from a
 * source the chain does not weight, `remove_outliers` finds no weighted
 * contribution, and the abort takes down the WHOLE PTB — every other ticker in
 * the same build with it.
 *
 * The mirror-image shape is just as dangerous and less obvious: a ticker
 * weighted to a rule this client DOES list, but whose feed that source does not
 * carry. Being in the fed set buys nothing per ticker — `refreshOraclePrices`
 * groups a ticker under a source only when that source's feeds have it — so the
 * leg never appears and the weighted rule is starved just the same.
 *
 * That is live on mainnet today, not hypothetical. `XAGUSD` / `WTIUSD` /
 * `BRENTUSD` are in `waterx_rule.feeds` (so: servable) while their aggregators
 * still weight the retired `PythRule@1`, which 5.0.0 cannot feed at all. The
 * config-only asserts wave all three through; only reading the weights catches
 * them.
 *
 * Async and chain-reading, so it is NOT on the build path — it belongs in a
 * deployment's boot sequence or a pre-release check, next to
 * `assertOracleWriteCoverage`.
 */

import type { OracleHost } from "./host.ts";
import type { OracleSource } from "./price-update-rule.ts";
import { resolveOracleRule } from "./rule-registry.ts";

/**
 * The on-chain witness struct each SDK source feeds. The aggregator's weight
 * table is keyed by these type names, so this is the join between what the
 * chain requires and what the fed set can supply.
 *
 * `ConstantRule` and `SupraRule` are auxiliary legs rather than sources — the
 * SDK feeds them alongside whichever source ran, so a ticker weighted only to
 * them needs no source. Anything NOT in this map (notably the retired
 * `PythRule`) cannot be supplied by this SDK at any fed set.
 */
const WITNESS_TO_SOURCE: Readonly<Record<string, OracleSource>> = Object.freeze({
  PythLazerRule: "pyth_lazer_rule",
  WaterxRule: "waterx_rule",
});

/**
 * Auxiliary witnesses — fed alongside a source rather than being one.
 *
 * Their emission is CONDITIONAL, per ticker, so they cannot be treated as
 * globally available (which certified a ticker clean that then aborted):
 *
 * - `ConstantRule` rides only when `host.isConstantTicker(ticker)`.
 * - `SupraRule` rides only when the deployment has supra wired AND a price
 *   -update source already fed that collector — `aggregateTicker` puts the
 *   supra leg inside `if (fed)`, so a ticker no listed source serves never
 *   gets one, constant-only tickers included.
 */
// (Both are handled by `suppliableFor` inside `readOracleWeightCoverage`.)

/** One ticker's on-chain weighting, as far as fed-set coverage is concerned. */
export interface TickerWeightCoverage {
  ticker: string;
  /** Weighted rule witness names, as the aggregator holds them. */
  weighted: string[];
  /** Weighted rules this client's fed set cannot feed (retired, or unlisted). */
  unsuppliable: string[];
}

/** Raised by {@link assertOracleWeightCoverage}; `rows` names every offender. */
export class OracleWeightCoverageError extends Error {
  readonly rows: TickerWeightCoverage[];

  constructor(rows: TickerWeightCoverage[]) {
    const detail = rows.map((r) => `${r.ticker} weights ${r.unsuppliable.join(" + ")}`).join("; ");
    super(
      `on-chain aggregator weights name rule(s) this fed set cannot supply: ${detail}. ` +
        `Aggregating such a ticker emits a collector with no WEIGHTED contribution, so ` +
        `remove_outliers aborts EMissingPriceSource and takes the whole PTB down — every ` +
        `other ticker in the same build with it. Fix by migrating the on-chain weight to a ` +
        `rule this deployment feeds, or by not requesting these tickers.`,
    );
    this.name = "OracleWeightCoverageError";
    this.rows = rows;
  }
}

/** Raised when an aggregator object cannot be decoded — see `readOracleWeightCoverage`. */
export class OracleWeightUnreadableError extends Error {
  readonly ticker: string;

  constructor(ticker: string, aggregatorId: string, why: string) {
    super(
      `cannot read aggregator ${aggregatorId} for ${ticker}: ${why}. This check exists to fail ` +
        `CLOSED, so an undecodable weight table is an error rather than an empty one — treating ` +
        `it as "no weights" would certify every ticker clean without verifying anything.`,
    );
    this.name = "OracleWeightUnreadableError";
    this.ticker = ticker;
  }
}

/** `0x…::aggregator::PythRule` → `PythRule`; already-short names pass through. */
function witnessName(raw: unknown): string {
  const s = typeof raw === "string" ? raw : String((raw as { name?: unknown })?.name ?? raw);
  return s.split("::").pop() ?? s;
}

/**
 * Read each ticker's aggregator and report which weighted rules this fed set
 * cannot supply.
 *
 * Tickers with no aggregator entry in the config are skipped, not failed: an
 * unlisted aggregator means the deployment does not price that ticker on chain
 * at all, which {@link assertOracleWriteCoverage} is the right check for.
 */
export async function readOracleWeightCoverage(
  host: OracleHost,
  tickers: readonly string[],
): Promise<TickerWeightCoverage[]> {
  const aggregators = host.config.packages.waterx_oracle.aggregators;

  // Which tickers each LISTED source actually feeds — per source, not merged.
  //
  // Being in the fed set is not enough: `refreshOraclePrices` groups a ticker
  // under a source only when that source's feeds carry it, so a lazer-weighted
  // ticker that only WaterX feeds gets no lazer leg no matter that lazer is
  // listed. Treating a listed source as suppliable for EVERY ticker passed
  // exactly that case, which then aborts `EMissingPriceSource` on chain.
  const feedsByWitness = new Map<string, Set<string>>();
  for (const [witness, source] of Object.entries(WITNESS_TO_SOURCE)) {
    if (host.oracleSources.includes(source)) {
      feedsByWitness.set(witness, new Set(resolveOracleRule(source).supportedTickers(host)));
    }
  }
  const supraWired = host.getSupraRule() !== undefined;
  /** Some listed source feeds this ticker, so a collector gets fed at all. */
  const anySourceFeeds = (ticker: string): boolean => {
    for (const served of feedsByWitness.values()) if (served.has(ticker)) return true;
    return false;
  };

  const suppliableFor = (ticker: string, witness: string): boolean => {
    const served = feedsByWitness.get(witness);
    // A source witness: suppliable only where that source has THIS ticker's feed.
    if (served !== undefined) return served.has(ticker);
    if (witness === "ConstantRule") return host.isConstantTicker(ticker);
    // Supra rides on a collector a SOURCE already fed — never on its own, and
    // never on a constant-only collector.
    if (witness === "SupraRule") return supraWired && anySourceFeeds(ticker);
    return false;
  };

  const wanted = tickers.filter((t) => Object.hasOwn(aggregators, t));
  // Independent reads — one round trip each would make a 30-market boot assert
  // needlessly serial.
  const objects = await Promise.all(
    wanted.map((t) =>
      // Explicit field mask: the client's `getObject` wrapper requests none, so
      // `json` would come back undefined and every aggregator would look
      // weightless — an assert that passes exactly where it must fail.
      host.grpcClient.getObject({ objectId: aggregators[t]!, include: { json: true } }),
    ),
  );

  return wanted.map((ticker, i) => {
    // FAIL CLOSED on anything undecodable. Defaulting a missing object / JSON /
    // weights map to an empty list made the assert succeed without verifying a
    // single weight — the exact fail-open shape this gate exists to prevent.
    const id = aggregators[ticker]!;
    const json = objects[i]?.object?.json;
    if (json === undefined || json === null || typeof json !== "object") {
      throw new OracleWeightUnreadableError(ticker, id, "no JSON payload in the object read");
    }
    const raw = (json as { weights?: { contents?: unknown[] } | unknown[] }).weights;
    const entries = Array.isArray(raw) ? raw : raw?.contents;
    if (!Array.isArray(entries)) {
      throw new OracleWeightUnreadableError(ticker, id, "no decodable `weights` table");
    }
    const weighted = entries.map((e) => witnessName((e as { key?: unknown }).key));
    if (weighted.some((w) => w === "" || w === "undefined")) {
      throw new OracleWeightUnreadableError(ticker, id, "a weight entry has no rule type name");
    }
    return {
      ticker,
      weighted,
      unsuppliable: weighted.filter((w) => !suppliableFor(ticker, w)),
    };
  });
}

/**
 * Throw {@link OracleWeightCoverageError} when any of `tickers` is weighted to
 * a rule this fed set cannot feed.
 *
 * The chain-reading twin of `assertOracleWriteCoverage`: that one catches a
 * ticker NO source serves (loud at build anyway), this one catches the quieter
 * and more damaging case — a ticker every config check passes, which aborts the
 * entire transaction on chain.
 */
export async function assertOracleWeightCoverage(
  host: OracleHost,
  tickers: readonly string[],
): Promise<void> {
  const rows = await readOracleWeightCoverage(host, tickers);
  const bad = rows.filter((r) => r.unsuppliable.length > 0);
  if (bad.length > 0) throw new OracleWeightCoverageError(bad);
}

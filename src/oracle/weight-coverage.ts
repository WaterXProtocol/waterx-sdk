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

import type { OracleSource } from "./price-update-rule.ts";

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
const WITNESS_TO_SOURCE: Readonly<Record<string, OracleSource | "auxiliary">> = Object.freeze({
  PythLazerRule: "pyth_lazer_rule",
  WaterxRule: "waterx_rule",
  ConstantRule: "auxiliary",
  SupraRule: "auxiliary",
});

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

/**
 * Minimal client slice this module needs.
 *
 * Reads go through `grpcClient` with an explicit `include: { json: true }`
 * mask, NOT the client's `getObject` convenience wrapper: that wrapper requests
 * no mask, so `json` comes back undefined and every aggregator would parse as
 * "no weights" — an assert that passes on exactly the deployments it exists to
 * fail. (It did, until this was caught against live mainnet.)
 */
interface WeightCoverageHost {
  readonly oracleSources: readonly OracleSource[];
  readonly config: { packages: { waterx_oracle: { aggregators: Record<string, string> } } };
  readonly grpcClient: {
    getObject(input: {
      objectId: string;
      include: { json: true };
    }): Promise<{ object?: { json?: unknown } }>;
  };
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
  host: WeightCoverageHost,
  tickers: readonly string[],
): Promise<TickerWeightCoverage[]> {
  const aggregators = host.config.packages.waterx_oracle.aggregators;
  const suppliable = new Set<string>();
  for (const [witness, source] of Object.entries(WITNESS_TO_SOURCE)) {
    if (source === "auxiliary" || host.oracleSources.includes(source)) suppliable.add(witness);
  }

  const wanted = tickers.filter((t) => Object.hasOwn(aggregators, t));
  // Independent reads — one round trip each would make a 30-market boot assert
  // needlessly serial.
  const objects = await Promise.all(
    wanted.map((t) =>
      host.grpcClient.getObject({ objectId: aggregators[t]!, include: { json: true } }),
    ),
  );

  return wanted.map((ticker, i) => {
    const json = objects[i]?.object?.json ?? {};
    const raw = (json as { weights?: { contents?: unknown[] } | unknown[] }).weights;
    const entries = Array.isArray(raw) ? raw : (raw?.contents ?? []);
    const weighted = entries.map((e) => witnessName((e as { key?: unknown }).key));
    return { ticker, weighted, unsuppliable: weighted.filter((w) => !suppliable.has(w)) };
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
  host: WeightCoverageHost,
  tickers: readonly string[],
): Promise<void> {
  const rows = await readOracleWeightCoverage(host, tickers);
  const bad = rows.filter((r) => r.unsuppliable.length > 0);
  if (bad.length > 0) throw new OracleWeightCoverageError(bad);
}

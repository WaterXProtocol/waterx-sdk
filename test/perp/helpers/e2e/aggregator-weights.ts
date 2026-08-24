/**
 * Read a ticker's on-chain `PriceAggregator.weights` and compare it against the
 * rule set an SDK build actually feeds into the collector.
 *
 * `aggregator::remove_outliers` aborts `EMissingPriceSource` when ANY weighted
 * rule is absent from the collector (an abstaining feed counts as present). That
 * one abort code covers two very different situations:
 *
 *   1. an SDK regression that stopped feeding a rule it should feed — a REAL
 *      integration break the e2e suites exist to catch; and
 *   2. a deployment whose aggregator weights a rule this build never feeds
 *      (e.g. an aggregator still weighting the retired `pyth_rule`, or
 *      weighting `waterx_rule` under a lazer-only `oracleSource` — neither is
 *      satisfiable by any 5.0.0 build).
 *
 * So the abort text alone must never gate a skip. {@link unfedWeightedRules}
 * names exactly which weighted rules this client cannot feed for a ticker,
 * computed from the live aggregator object plus the client's own config +
 * `oracleSource`. Empty ⇒ the environment is satisfiable and an
 * `EMissingPriceSource` is case 1: a real failure that must stay red.
 */
import type { PerpClient } from "../../../../src/perp/client.ts";

/** `0x`-prefixed, lowercase, zero-padded to 32 bytes — TypeName strings drop the `0x`. */
function normalizeAddress(addr: string): string {
  const hex = addr.replace(/^0x/, "").toLowerCase();
  return `0x${hex.padStart(64, "0")}`;
}

/** `<package>::<module>::<Struct>` with the package address normalized. */
function normalizeTypeName(typeName: string): string {
  const [pkg, module, struct] = typeName.split("::");
  if (!pkg || !module || !struct) return typeName;
  return `${normalizeAddress(pkg)}::${module}::${struct}`;
}

/** Collector witness type per rule package — `original_id` is what a TypeName carries. */
const RULE_WITNESS: Record<string, string> = {
  pyth_lazer_rule: "pyth_lazer_rule::PythLazerRule",
  waterx_rule: "waterx_rule::WaterxRule",
  constant_rule: "constant_rule::ConstantRule",
  supra_rule: "supra_rule::SupraRule",
};

function witnessTypeName(client: PerpClient, pkg: keyof typeof RULE_WITNESS): string | undefined {
  const entry = (
    client.config.packages as unknown as Record<string, { original_id?: string } | undefined>
  )[pkg];
  const original = entry?.original_id;
  return original ? `${normalizeAddress(original)}::${RULE_WITNESS[pkg]}` : undefined;
}

/**
 * The weighted rule TypeNames on `ticker`'s live `PriceAggregator`, normalized.
 * `undefined` when the aggregator is unknown/unreadable — callers must then NOT
 * skip (an unverifiable environment is not a licence to ignore a failure).
 */
export async function readAggregatorWeightRules(
  client: PerpClient,
  ticker: string,
): Promise<string[] | undefined> {
  const aggregatorId = client.config.packages.waterx_oracle?.aggregators?.[ticker];
  if (!aggregatorId) return undefined;
  try {
    const { object } = await client.grpcClient.getObject({
      objectId: aggregatorId,
      include: { json: true },
    });
    const json = object?.json as Record<string, unknown> | null | undefined;
    const fields = (json && typeof json === "object" && "fields" in json ? json.fields : json) as
      | Record<string, unknown>
      | undefined;
    const weights = fields?.weights as { contents?: { key?: unknown }[] } | undefined;
    const contents = weights?.contents;
    if (!Array.isArray(contents)) return undefined;
    return contents
      .map((entry) => (typeof entry?.key === "string" ? normalizeTypeName(entry.key) : undefined))
      .filter((t): t is string => t !== undefined);
  } catch {
    // Unreadable aggregator ⇒ unverified environment ⇒ no skip licence.
    return undefined;
  }
}

/**
 * The rule witnesses a `refreshOraclePrices` build feeds for `ticker`:
 * constant, supra when wired, plus whichever sources `oracleSource` selects.
 * Mirrors `aggregate.ts::aggregateTicker` — keep the two in step. (A weighted
 * `pyth_rule` has no witness here at all: the source is retired, so such an
 * aggregator is unsatisfiable and correctly reported as unfed.)
 */
function fedWitnesses(client: PerpClient, ticker: string): Set<string> {
  const fed = new Set<string>();
  const add = (pkg: keyof typeof RULE_WITNESS) => {
    const t = witnessTypeName(client, pkg);
    if (t) fed.add(t);
  };
  if (client.isConstantTicker(ticker)) add("constant_rule");
  if (client.getSupraRule()) add("supra_rule");
  if (client.oracleSources.includes("pyth_lazer_rule")) add("pyth_lazer_rule");
  if (client.oracleSources.includes("waterx_rule")) add("waterx_rule");
  return fed;
}

/**
 * Weighted rules on `ticker`'s aggregator that this client does NOT feed —
 * i.e. the aggregate is unsatisfiable in this environment no matter what the
 * SDK does. Empty (including when the aggregator can't be read) means an
 * `EMissingPriceSource` here is a real regression, not an environment state.
 */
export async function unfedWeightedRules(client: PerpClient, ticker: string): Promise<string[]> {
  const weighted = await readAggregatorWeightRules(client, ticker);
  if (!weighted) return [];
  const fed = fedWitnesses(client, ticker);
  return weighted.filter((rule) => !fed.has(rule));
}

/** `unfedWeightedRules` over several tickers, deduped (a PTB refreshes them together). */
export async function unfedWeightedRulesForTickers(
  client: PerpClient,
  tickers: string[],
): Promise<string[]> {
  const perTicker = await Promise.all(tickers.map((t) => unfedWeightedRules(client, t)));
  return [...new Set(perTicker.flat())];
}

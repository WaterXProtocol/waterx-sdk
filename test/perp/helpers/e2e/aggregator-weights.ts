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
 *      (e.g. an aggregator still weighting the retired `pyth_rule` or the
 *      never-fed `supra_rule`, or weighting `pyth_lazer_rule` for a ticker the
 *      config carries no Lazer feed id for — none is satisfiable by any build).
 *
 * So the abort text alone must never gate a skip. {@link unfedWeightedRules}
 * names exactly which weighted rules this client cannot feed for a ticker,
 * computed from the live aggregator object plus the client's own config and
 * its config-derived fed set (`client.oracleSources`). Empty ⇒ the environment
 * is satisfiable and an `EMissingPriceSource` is case 1: a real failure that
 * must stay red.
 */
import { resolveOracleRule } from "../../../../src/oracle/rule-registry.ts";
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

/**
 * Collector witness per rule the SDK can feed: the `oracle_rules` block that
 * names the rule's package (a TypeName carries that package's `original_id`)
 * and the `<module>::<Struct>` suffix.
 */
const RULE_WITNESS = {
  pyth_lazer_rule: { block: "pyth_lazer", witness: "pyth_lazer_rule::PythLazerRule" },
  waterx_rule: { block: "waterx", witness: "waterx_rule::WaterxRule" },
  constant_rule: { block: "constant", witness: "constant_rule::ConstantRule" },
} as const;

type FedRule = keyof typeof RULE_WITNESS;

/** `undefined` when the config does not wire the rule's `oracle_rules` block. */
function witnessTypeName(client: PerpClient, rule: FedRule): string | undefined {
  const { block, witness } = RULE_WITNESS[rule];
  const wired = client.config.oracle_rules[block];
  if (!wired) return undefined;
  // `loadConfig` asserts the package entry every rule block names, so this
  // index cannot miss on a parsed config.
  return `${normalizeAddress(client.config.packages[wired.package].original_id)}::${witness}`;
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
  const aggregatorId = client.config.objects.oracle.aggregators[ticker];
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
 * The rule witnesses a `refreshOraclePrices` build feeds for `ticker`: constant
 * when the ticker is constant-pinned, plus every source in the config-derived
 * fed set whose rule serves `ticker`. Mirrors `aggregate.ts::refreshOraclePrices`
 * routing (`rule.supportedTickers(config)` per source) — keep the two in step.
 * (The retired `pyth_rule` and the never-fed `supra_rule` have no witness here
 * at all, so an aggregator weighting either is correctly reported as unfed.)
 */
function fedWitnesses(client: PerpClient, ticker: string): Set<string> {
  const fed = new Set<string>();
  const add = (rule: FedRule) => {
    const t = witnessTypeName(client, rule);
    if (t) fed.add(t);
  };
  if (client.isConstantTicker(ticker)) add("constant_rule");
  for (const source of client.oracleSources) {
    if (resolveOracleRule(source).supportedTickers(client.config).includes(ticker)) add(source);
  }
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

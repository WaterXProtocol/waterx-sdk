/**
 * `weight-coverage.ts` — the ON-CHAIN half of fed-set coverage.
 *
 * The config-only asserts answer "does some listed source feed this ticker".
 * The aggregator decides which contributions COUNT, so a ticker can pass every
 * config check and still abort the whole PTB. These cases pin that gap — and
 * the two ways this check could quietly stop working: certifying an auxiliary
 * leg this client will not emit, and treating an undecodable weight table as an
 * empty one.
 */
import { describe, expect, it, vi } from "vitest";

import type { OracleHost } from "../../../src/oracle/host.ts";
import {
  assertOracleWeightCoverage,
  OracleWeightCoverageError,
  OracleWeightUnreadableError,
  readOracleWeightCoverage,
} from "../../../src/oracle/weight-coverage.ts";

interface HostOpts {
  /**
   * Tickers each source serves, keyed by source — Lazer's become
   * `oracle_rules.pyth_lazer.lazer_feed_ids`, the quote-center's the `symbols`
   * universe.
   */
  feeds?: Partial<Record<"pyth_lazer_rule" | "waterx_rule", string[]>>;
  constantTickers?: string[];
  /** Override the raw object read, to exercise undecodable shapes. */
  getObject?: (id: string) => unknown;
}

/** An `OracleHost` whose aggregators report the given weights. */
function hostWith(
  oracleSources: string[],
  weightsByTicker: Record<string, string[]>,
  opts: HostOpts = {},
): OracleHost {
  const aggregators = Object.fromEntries(
    Object.keys(weightsByTicker).map((t, i) => [t, `0x${String(i + 1).padStart(2, "0")}`]),
  );
  const byId = new Map(Object.entries(aggregators).map(([t, id]) => [id, weightsByTicker[t]!]));
  const lazerFeedIds = Object.fromEntries(
    (opts.feeds?.pyth_lazer_rule ?? []).map((t, i) => [t, i + 1]),
  );
  const symbols = Object.fromEntries(
    (opts.feeds?.waterx_rule ?? []).map((t) => [t, { kind: "perp" }]),
  );

  return {
    oracleSources,
    network: "TESTNET",
    isConstantTicker: (t: string) => (opts.constantTickers ?? []).includes(t),
    config: {
      symbols,
      objects: { oracle: { oracle: "0xoracle", aggregators } },
      oracle_rules: {
        pyth_lazer: {
          package: "pyth_lazer_rule",
          lazer_state_object: "0xs",
          lazer_config_object: "0xc",
          lazer_feed_ids: lazerFeedIds,
        },
      },
    },
    grpcClient: {
      getObject: vi.fn(async ({ objectId }: { objectId: string }) =>
        opts.getObject
          ? opts.getObject(objectId)
          : {
              object: {
                json: {
                  weights: {
                    contents: (byId.get(objectId) ?? []).map((w) => ({
                      key: { name: `0xabc::aggregator::${w}` },
                      value: "1",
                    })),
                  },
                },
              },
            },
      ),
    },
  } as unknown as OracleHost;
}

describe("readOracleWeightCoverage — unsuppliable weights", () => {
  it("flags a ticker weighted to a RETIRED rule even though a listed source feeds it", async () => {
    // The live mainnet shape: XAGUSD is in the `symbols` universe (so every
    // config check passes) while its aggregator still weights the retired
    // PythRule. Aggregating it emits a collector with no weighted
    // contribution, and remove_outliers aborts EMissingPriceSource — taking
    // the WHOLE PTB down.
    const host = hostWith(
      ["waterx_rule"],
      { XAGUSD: ["PythRule"], BTCUSD: ["WaterxRule"] },
      { feeds: { waterx_rule: ["XAGUSD", "BTCUSD"] } },
    );
    const rows = await readOracleWeightCoverage(host, ["XAGUSD", "BTCUSD"]);

    expect(rows.find((r) => r.ticker === "XAGUSD")?.unsuppliable).toEqual(["PythRule"]);
    expect(rows.find((r) => r.ticker === "BTCUSD")?.unsuppliable).toEqual([]);
  });

  it("flags a rule that EXISTS but is not in this client's fed set", async () => {
    const host = hostWith(
      ["waterx_rule"],
      { ETHUSD: ["PythLazerRule"] },
      { feeds: { waterx_rule: ["ETHUSD"] } },
    );
    const [row] = await readOracleWeightCoverage(host, ["ETHUSD"]);
    expect(row?.unsuppliable).toEqual(["PythLazerRule"]);
  });

  it("passes when every weighted rule is in the fed set", async () => {
    const host = hostWith(
      ["waterx_rule", "pyth_lazer_rule"],
      { BTCUSD: ["PythLazerRule"], SUIUSD: ["WaterxRule"] },
      { feeds: { pyth_lazer_rule: ["BTCUSD"], waterx_rule: ["SUIUSD"] } },
    );
    await expect(assertOracleWeightCoverage(host, ["BTCUSD", "SUIUSD"])).resolves.toBeUndefined();
  });

  it("throws naming EVERY offender, not just the first", async () => {
    const host = hostWith(
      ["waterx_rule"],
      { XAGUSD: ["PythRule"], WTIUSD: ["PythRule"], BTCUSD: ["WaterxRule"] },
      { feeds: { waterx_rule: ["XAGUSD", "WTIUSD", "BTCUSD"] } },
    );
    let caught: unknown;
    try {
      await assertOracleWeightCoverage(host, ["XAGUSD", "WTIUSD", "BTCUSD"]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(OracleWeightCoverageError);
    expect((caught as OracleWeightCoverageError).rows.map((r) => r.ticker)).toEqual([
      "XAGUSD",
      "WTIUSD",
    ]);
  });

  it("skips tickers with no aggregator — that is write-coverage's question", async () => {
    const host = hostWith(
      ["waterx_rule"],
      { BTCUSD: ["WaterxRule"] },
      { feeds: { waterx_rule: ["BTCUSD"] } },
    );
    const rows = await readOracleWeightCoverage(host, ["BTCUSD", "NOT_ON_CHAIN"]);
    expect(rows.map((r) => r.ticker)).toEqual(["BTCUSD"]);
  });
});

describe("readOracleWeightCoverage — a LISTED source is not suppliable everywhere", () => {
  // Being in the fed set buys nothing per ticker. `refreshOraclePrices` groups a
  // ticker under a source only when that source's feeds carry it, so a listed
  // source with no feed for THIS ticker emits no leg for it.

  it("flags a lazer-weighted ticker that only WaterX feeds, even with lazer listed", async () => {
    // Both sources listed; XAUUSD is in the symbols universe only, but the
    // aggregator weights PythLazerRule. No lazer leg is ever emitted for
    // XAUUSD, so the weighted rule is starved and remove_outliers aborts —
    // while a fed-set membership check waves it through.
    const host = hostWith(
      ["waterx_rule", "pyth_lazer_rule"],
      { XAUUSD: ["PythLazerRule"] },
      { feeds: { waterx_rule: ["XAUUSD"], pyth_lazer_rule: ["BTCUSD"] } },
    );
    const [row] = await readOracleWeightCoverage(host, ["XAUUSD"]);
    expect(row?.unsuppliable).toEqual(["PythLazerRule"]);
  });

  it("passes the same ticker once that source actually carries its feed", async () => {
    const host = hostWith(
      ["waterx_rule", "pyth_lazer_rule"],
      { XAUUSD: ["PythLazerRule"] },
      { feeds: { waterx_rule: ["XAUUSD"], pyth_lazer_rule: ["XAUUSD"] } },
    );
    const [row] = await readOracleWeightCoverage(host, ["XAUUSD"]);
    expect(row?.unsuppliable).toEqual([]);
  });

  it("judges each weighted rule on ITS own feed, not on the union", async () => {
    // Weighted to both. Waterx carries it, lazer does not — so exactly one of
    // the two is unsuppliable, and merging the sources' ticker sets would have
    // reported neither.
    const host = hostWith(
      ["waterx_rule", "pyth_lazer_rule"],
      { XAUUSD: ["WaterxRule", "PythLazerRule"] },
      { feeds: { waterx_rule: ["XAUUSD"], pyth_lazer_rule: ["BTCUSD"] } },
    );
    const [row] = await readOracleWeightCoverage(host, ["XAUUSD"]);
    expect(row?.unsuppliable).toEqual(["PythLazerRule"]);
  });
});

describe("readOracleWeightCoverage — auxiliary legs are PER TICKER", () => {
  // They are not globally available: `aggregateTicker` emits the constant leg
  // only when the ticker is constant-pinned. Treating it as always-suppliable
  // certified a ticker clean that then aborted.

  it("ConstantRule counts only for a ticker that is actually constant-pinned", async () => {
    const host = hostWith(
      ["waterx_rule"],
      { USDCUSD: ["ConstantRule"], XAUUSD: ["ConstantRule"] },
      { constantTickers: ["USDCUSD"], feeds: { waterx_rule: ["XAUUSD"] } },
    );
    const rows = await readOracleWeightCoverage(host, ["USDCUSD", "XAUUSD"]);

    expect(rows.find((r) => r.ticker === "USDCUSD")?.unsuppliable).toEqual([]);
    // XAUUSD is weighted to Constant but is NOT constant-pinned here, so no
    // constant leg is ever emitted for it.
    expect(rows.find((r) => r.ticker === "XAUUSD")?.unsuppliable).toEqual(["ConstantRule"]);
  });

  it("SupraRule is never suppliable — the SDK feeds no supra leg at any fed set", async () => {
    // The config's optional supra block is never read, so a supra weight is
    // exactly as unsuppliable as a retired rule's.
    const host = hostWith(
      ["waterx_rule"],
      { XAUUSD: ["WaterxRule", "SupraRule"] },
      { feeds: { waterx_rule: ["XAUUSD"] } },
    );
    expect((await readOracleWeightCoverage(host, ["XAUUSD"]))[0]?.unsuppliable).toEqual([
      "SupraRule",
    ]);
  });
});

describe("readOracleWeightCoverage — fails CLOSED on an undecodable aggregator", () => {
  // Defaulting a missing object / JSON / weights map to an empty list made the
  // assert succeed without verifying a single weight — precisely the fail-open
  // behaviour this gate exists to prevent.

  it("throws when the object read carries no JSON payload", async () => {
    const host = hostWith(["waterx_rule"], { BTCUSD: ["WaterxRule"] }, { getObject: () => ({}) });
    await expect(readOracleWeightCoverage(host, ["BTCUSD"])).rejects.toThrow(
      OracleWeightUnreadableError,
    );
  });

  it("throws when the JSON carries no decodable weights table", async () => {
    const host = hostWith(
      ["waterx_rule"],
      { BTCUSD: ["WaterxRule"] },
      { getObject: () => ({ object: { json: { allowed_versions: [1] } } }) },
    );
    await expect(readOracleWeightCoverage(host, ["BTCUSD"])).rejects.toThrow(
      /no decodable `weights` table/,
    );
  });

  it("throws when a weight entry has no rule type name", async () => {
    const host = hostWith(
      ["waterx_rule"],
      { BTCUSD: ["WaterxRule"] },
      { getObject: () => ({ object: { json: { weights: { contents: [{ value: "1" }] } } } }) },
    );
    await expect(readOracleWeightCoverage(host, ["BTCUSD"])).rejects.toThrow(/no rule type name/);
  });

  it("a genuinely EMPTY weights table is not an error — it is decodable", async () => {
    // Distinct from undecodable: an aggregator with no weights is a real state,
    // and nothing is unsuppliable in it.
    const host = hostWith(["waterx_rule"], { BTCUSD: [] }, { feeds: { waterx_rule: ["BTCUSD"] } });
    const [row] = await readOracleWeightCoverage(host, ["BTCUSD"]);
    expect(row).toEqual({ ticker: "BTCUSD", weighted: [], unsuppliable: [] });
  });
});

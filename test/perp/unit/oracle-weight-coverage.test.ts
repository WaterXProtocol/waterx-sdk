/**
 * `weight-coverage.ts` — the ON-CHAIN half of fed-set coverage.
 *
 * The config-only asserts answer "does some listed source feed this ticker".
 * The aggregator decides which contributions COUNT, so a ticker can pass every
 * config check and still abort the whole PTB. These cases pin that gap.
 */
import { describe, expect, it, vi } from "vitest";

import {
  assertOracleWeightCoverage,
  OracleWeightCoverageError,
  readOracleWeightCoverage,
} from "../../../src/oracle/weight-coverage.ts";

/** A client slice whose aggregator objects report the given weights. */
function hostWith(
  oracleSources: string[],
  weightsByTicker: Record<string, string[]>,
): Parameters<typeof readOracleWeightCoverage>[0] {
  const aggregators = Object.fromEntries(
    Object.keys(weightsByTicker).map((t, i) => [t, `0x${String(i + 1).padStart(2, "0")}`]),
  );
  const byId = new Map(Object.entries(aggregators).map(([t, id]) => [id, weightsByTicker[t]!]));
  return {
    oracleSources,
    config: { packages: { waterx_oracle: { aggregators } } },
    grpcClient: {
      getObject: vi.fn(async ({ objectId }: { objectId: string }) => ({
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
      })),
    },
  } as unknown as Parameters<typeof readOracleWeightCoverage>[0];
}

describe("readOracleWeightCoverage", () => {
  it("flags a ticker weighted to a RETIRED rule even though a listed source feeds it", async () => {
    // The live mainnet shape: XAGUSD is in waterx_rule.feeds (so every config
    // check passes) while its aggregator still weights the retired PythRule.
    // Aggregating it emits a collector with no weighted contribution, and
    // remove_outliers aborts EMissingPriceSource — taking the WHOLE PTB down.
    const host = hostWith(["waterx_rule"], { XAGUSD: ["PythRule"], BTCUSD: ["WaterxRule"] });
    const rows = await readOracleWeightCoverage(host, ["XAGUSD", "BTCUSD"]);

    expect(rows.find((r) => r.ticker === "XAGUSD")?.unsuppliable).toEqual(["PythRule"]);
    expect(rows.find((r) => r.ticker === "BTCUSD")?.unsuppliable).toEqual([]);
  });

  it("flags a rule that EXISTS but is not in this client's fed set", async () => {
    // Not only retired rules: a lazer-weighted ticker is unsuppliable to a
    // waterx-only deployment, and aborts the same way.
    const host = hostWith(["waterx_rule"], { ETHUSD: ["PythLazerRule"] });
    const [row] = await readOracleWeightCoverage(host, ["ETHUSD"]);
    expect(row?.unsuppliable).toEqual(["PythLazerRule"]);
  });

  it("treats constant and supra as always suppliable — they are auxiliary legs", async () => {
    // The SDK feeds them alongside whichever source ran, so a ticker weighted
    // to them needs no source of its own.
    const host = hostWith(["waterx_rule"], {
      USDCUSD: ["ConstantRule"],
      XAUUSD: ["WaterxRule", "SupraRule"],
    });
    const rows = await readOracleWeightCoverage(host, ["USDCUSD", "XAUUSD"]);
    expect(rows.every((r) => r.unsuppliable.length === 0)).toBe(true);
  });

  it("skips tickers with no aggregator — that is write-coverage's question, not this one", async () => {
    const host = hostWith(["waterx_rule"], { BTCUSD: ["WaterxRule"] });
    const rows = await readOracleWeightCoverage(host, ["BTCUSD", "NOT_ON_CHAIN"]);
    expect(rows.map((r) => r.ticker)).toEqual(["BTCUSD"]);
  });

  it("assert throws naming EVERY offender, not just the first", async () => {
    const host = hostWith(["waterx_rule"], {
      XAGUSD: ["PythRule"],
      WTIUSD: ["PythRule"],
      BTCUSD: ["WaterxRule"],
    });
    await expect(assertOracleWeightCoverage(host, ["XAGUSD", "WTIUSD", "BTCUSD"])).rejects.toThrow(
      OracleWeightCoverageError,
    );

    let caught: unknown;
    try {
      await assertOracleWeightCoverage(host, ["XAGUSD", "WTIUSD", "BTCUSD"]);
    } catch (e) {
      caught = e;
    }
    expect((caught as OracleWeightCoverageError).rows.map((r) => r.ticker)).toEqual([
      "XAGUSD",
      "WTIUSD",
    ]);
  });

  it("passes when every weighted rule is in the fed set", async () => {
    const host = hostWith(["waterx_rule", "pyth_lazer_rule"], {
      BTCUSD: ["PythLazerRule"],
      SUIUSD: ["WaterxRule"],
    });
    await expect(assertOracleWeightCoverage(host, ["BTCUSD", "SUIUSD"])).resolves.toBeUndefined();
  });
});

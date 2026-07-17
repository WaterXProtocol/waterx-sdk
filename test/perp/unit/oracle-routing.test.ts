/**
 * Env-selected oracle rule routing — `oracleSource` client option threading
 * (unified-client → PerpClient → OracleHost) and `refreshOraclePrices`'s
 * per-rule grouping via `rule-registry.ts`. No real network; Hermes fetch and
 * the Pyth on-chain gRPC reads are mocked (see `pyth-mock-grpc.ts`).
 */
import { toHex } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OracleHost } from "../../../src/oracle/host.ts";
import { aggregateTicker, refreshOraclePrices } from "../../../src/oracle/index.ts";
import type {
  BuildUpdateOpts,
  OracleSource,
  PriceUpdateRule,
  RuleUpdateData,
} from "../../../src/oracle/price-update-rule.ts";
import { PythCache, updatePythPrices } from "../../../src/oracle/pyth.ts";
import { resolveOracleRule } from "../../../src/oracle/rule-registry.ts";
import { PythCoreRule } from "../../../src/oracle/rules/pyth-core-rule.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import * as configModule from "../../../src/perp/config.ts";
import { PredictClient } from "../../../src/prediction/client.ts";
import { WaterXClient } from "../../../src/unified-client.ts";
import { createMockPredictClient } from "../../prediction/helpers/mock-client.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";
import { attachPythGrpcMocks, mockAccumulatorUpdate } from "../helpers/fixtures/pyth-mock-grpc.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

/** `module::function` for every MoveCall command in a built PTB. */
function moveTargets(tx: Transaction): string[] {
  const out: string[] = [];
  for (const c of tx.getData().commands ?? []) {
    if (c.$kind === "MoveCall" && c.MoveCall) {
      out.push(`${c.MoveCall.module}::${c.MoveCall.function}`);
    }
  }
  return out;
}

/** Fake `PriceUpdateRule` — supports exactly `supported`, no on-chain calls. */
function createFakeRule(kind: OracleSource, supported: string[]): PriceUpdateRule {
  return {
    kind,
    supportedTickers: vi.fn((_host: OracleHost): string[] => supported),
    fetchUpdateData: vi.fn(
      async (_host: OracleHost, tickers: string[]): Promise<RuleUpdateData> => ({
        kind,
        payload: { tickers },
      }),
    ),
    buildUpdateCalls: vi.fn(
      async (
        _tx: Transaction,
        _host: OracleHost,
        _data: RuleUpdateData,
        _tickers: string[],
        _opts?: BuildUpdateOpts,
      ): Promise<void> => {},
    ),
  };
}

function mockHermesFetch(): void {
  const update = mockAccumulatorUpdate();
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ binary: { data: [toHex(update)] } }),
  })) as unknown as typeof fetch;
}

describe("refreshOraclePrices — default oracleSource ('pyth_rule')", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("routes every pyth-feed ticker to PythCoreRule, producing the exact same PTB as today's direct updatePythPrices + aggregateTicker", async () => {
    const client = createUnitTestClient();
    attachPythGrpcMocks(client);
    mockHermesFetch();

    const referenceTx = new Transaction();
    const feedIds = ["BTCUSD", "ETHUSD"].map((t) => client.getPythFeed(t).feed_id);
    await updatePythPrices(referenceTx, client, feedIds);
    aggregateTicker(referenceTx, client, {
      ticker: "BTCUSD",
      priceInfoObjectId: client.getPythFeed("BTCUSD").price_info_object,
    });
    aggregateTicker(referenceTx, client, {
      ticker: "ETHUSD",
      priceInfoObjectId: client.getPythFeed("ETHUSD").price_info_object,
    });

    const actualTx = new Transaction();
    await refreshOraclePrices(actualTx, client, ["BTCUSD", "ETHUSD"]);

    // Full command + input structures, not just module::function names —
    // both builds are deterministic given the same mocked inputs, so a
    // divergence anywhere (argument encoding, ordering, extra commands)
    // must fail this.
    expect(actualTx.getData()).toEqual(referenceTx.getData());
  });
});

describe("refreshOraclePrices — 'pyth_lazer_rule' with a fake rule injected", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("routes supported tickers to the fake lazer rule and unsupported tickers to the PythCoreRule fallback", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    attachPythGrpcMocks(client);
    mockHermesFetch();

    const fakeLazer = createFakeRule("pyth_lazer_rule", ["ETHUSD"]);
    const fallbackSpy = vi.spyOn(PythCoreRule, "fetchUpdateData");

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "ETHUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });

    // Each rule's fetch is called exactly once, with exactly its own group.
    expect(fakeLazer.fetchUpdateData).toHaveBeenCalledTimes(1);
    expect(fakeLazer.fetchUpdateData).toHaveBeenCalledWith(client, ["ETHUSD"]);
    expect(fallbackSpy).toHaveBeenCalledTimes(1);
    expect(fallbackSpy).toHaveBeenCalledWith(client, ["BTCUSD"]);

    // Both tickers still get aggregated (aggregateTicker/collector feeding unchanged).
    const targets = moveTargets(tx);
    expect(targets).toContain("oracle::aggregate");
    expect(targets.filter((t) => t === "oracle::new_collector")).toHaveLength(2);
  });

  it("forwards the same tx and opts.cache/opts.sponsorFund into buildUpdateCalls, alongside the exact payload fetchUpdateData resolved", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    // The fake covers every requested ticker, so no PythCoreRule fallback
    // engages here — no real on-chain Pyth/sponsor call runs, so it's safe
    // to forward an inert sponsorFund stub through to the fake alone.
    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);

    const tx = new Transaction();
    const cache = new PythCache();
    const sponsorFund = { fund: tx.pure.u64(0), packageId: "0xsponsor" };
    await refreshOraclePrices(tx, client, ["BTCUSD"], {
      cache,
      sponsorFund,
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });

    expect(fakeLazer.buildUpdateCalls).toHaveBeenCalledTimes(1);
    expect(fakeLazer.buildUpdateCalls).toHaveBeenCalledWith(
      tx,
      client,
      { kind: "pyth_lazer_rule", payload: { tickers: ["BTCUSD"] } }, // == fetchUpdateData's resolved value
      ["BTCUSD"],
      { cache, sponsorFund },
    );
  });
});

describe("refreshOraclePrices — 'pyth_lazer_rule' with no rule registered", () => {
  it("throws a clear OracleSourceNotImplemented error naming the source", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    const tx = new Transaction();

    await expect(refreshOraclePrices(tx, client, ["BTCUSD"])).rejects.toThrow(
      "OracleSourceNotImplemented: pyth_lazer_rule",
    );
  });
});

describe("refreshOraclePrices — ticker supported by neither rule", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("skips it without throwing (mirrors today's non-pyth-ticker filter), while other tickers still process via their group", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    attachPythGrpcMocks(client);
    mockHermesFetch();

    // USDCUSD: constant-only — not in pyth_rule.feeds, and the fake lazer rule
    // below doesn't cover it either, so it's supported by neither group.
    client.config.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    delete client.config.packages.pyth_rule!.feeds.USDCUSD;

    const fakeLazer = createFakeRule("pyth_lazer_rule", []); // supports nothing
    const fallbackSpy = vi.spyOn(PythCoreRule, "fetchUpdateData");

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "USDCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });

    // USDCUSD never reaches either rule's fetch step …
    expect(fakeLazer.fetchUpdateData).not.toHaveBeenCalled();
    // … yet still gets fed via constant_rule at the (unchanged) aggregate step.
    const targets = moveTargets(tx);
    expect(targets).toContain("constant_rule::feed");

    // BTCUSD: not lazer-supported, falls back to PythCoreRule and is fed normally.
    expect(fallbackSpy).toHaveBeenCalledWith(client, ["BTCUSD"]);
    expect(targets).toContain("pyth_rule::feed");
  });
});

describe("refreshOraclePrices — per-environment acceptance (staging Lazer vs prod Core split)", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("routes differently for two clients built from the same config fixture, based solely on oracleSource", async () => {
    const prodClient = createUnitTestClient(); // prod: default → pyth_rule
    const stagingClient = createUnitTestClient({ oracleSource: "pyth_lazer_rule" }); // staging: lazer
    attachPythGrpcMocks(prodClient);
    attachPythGrpcMocks(stagingClient);
    mockHermesFetch();

    const fakeForProd = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);
    const fakeForStaging = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);

    await refreshOraclePrices(new Transaction(), prodClient, ["BTCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeForProd },
    });
    await refreshOraclePrices(new Transaction(), stagingClient, ["BTCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeForStaging },
    });

    // Same fixture, same ticker — prod (pyth_rule) never touches the lazer rule …
    expect(fakeForProd.fetchUpdateData).not.toHaveBeenCalled();
    // … while staging (pyth_lazer_rule) routes through it.
    expect(fakeForStaging.fetchUpdateData).toHaveBeenCalledWith(stagingClient, ["BTCUSD"]);
  });
});

describe("PerpClient.oracleSource — default resolution", () => {
  it("defaults to 'pyth_rule' when the create option is omitted", () => {
    const client = createUnitTestClient();
    expect(client.oracleSource).toBe("pyth_rule");
  });

  it("resolves to the passed oracleSource option", () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    expect(client.oracleSource).toBe("pyth_lazer_rule");
  });
});

describe("PerpClient.create — oracleSource threads through the async factory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to 'pyth_rule' when omitted", async () => {
    vi.spyOn(configModule, "loadConfig").mockResolvedValue(MOCK_TESTNET_CONFIG);
    const client = await PerpClient.create("TESTNET");
    expect(client.oracleSource).toBe("pyth_rule");
  });

  it("threads an explicit oracleSource option", async () => {
    vi.spyOn(configModule, "loadConfig").mockResolvedValue(MOCK_TESTNET_CONFIG);
    const client = await PerpClient.create("TESTNET", { oracleSource: "pyth_lazer_rule" });
    expect(client.oracleSource).toBe("pyth_lazer_rule");
  });
});

describe("WaterXClient.create — oracleSource threads into PerpClient.create", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards the top-level oracleSource option to PerpClient.create", async () => {
    const perpCreate = vi.spyOn(PerpClient, "create").mockResolvedValue(createUnitTestClient());
    vi.spyOn(PredictClient, "create").mockResolvedValue(createMockPredictClient());

    await WaterXClient.create({ oracleSource: "pyth_lazer_rule" });

    expect(perpCreate).toHaveBeenCalledWith(
      "TESTNET",
      expect.objectContaining({ oracleSource: "pyth_lazer_rule" }),
    );
  });

  it("passes oracleSource: undefined (PerpClient defaults to 'pyth_rule') when omitted", async () => {
    const perpCreate = vi.spyOn(PerpClient, "create").mockResolvedValue(createUnitTestClient());
    vi.spyOn(PredictClient, "create").mockResolvedValue(createMockPredictClient());

    await WaterXClient.create();

    expect(perpCreate).toHaveBeenCalledWith(
      "TESTNET",
      expect.objectContaining({ oracleSource: undefined }),
    );
  });
});

describe("resolveOracleRule", () => {
  it("resolves 'pyth_rule' to PythCoreRule by default", () => {
    expect(resolveOracleRule("pyth_rule")).toBe(PythCoreRule);
  });

  it("throws OracleSourceNotImplemented for an unregistered source", () => {
    expect(() => resolveOracleRule("pyth_lazer_rule")).toThrow(
      "OracleSourceNotImplemented: pyth_lazer_rule",
    );
  });

  it("lets an override map supply a rule for an otherwise-unregistered source", () => {
    const fake = createFakeRule("pyth_lazer_rule", []);
    expect(resolveOracleRule("pyth_lazer_rule", { pyth_lazer_rule: fake })).toBe(fake);
  });

  it("overrides take precedence over the production registry for a registered source", () => {
    const fake = createFakeRule("pyth_rule", []);
    expect(resolveOracleRule("pyth_rule", { pyth_rule: fake })).toBe(fake);
  });
});

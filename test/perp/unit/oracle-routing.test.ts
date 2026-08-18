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
  UpdateDataProvider,
} from "../../../src/oracle/price-update-rule.ts";
import {
  OracleFeeSourceUnavailableError,
  PythCache,
  updatePythPrices,
  type OracleFeeSource,
} from "../../../src/oracle/pyth.ts";
import {
  OracleSourceNotImplementedError,
  resolveOracleRule,
} from "../../../src/oracle/rule-registry.ts";
import { PythCoreRule } from "../../../src/oracle/rules/pyth-core-rule.ts";
import {
  LazerApiKeyMissingError,
  PythLazerRule,
} from "../../../src/oracle/rules/pyth-lazer-rule.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import * as configModule from "../../../src/perp/config.ts";
import { PredictClient } from "../../../src/prediction/client.ts";
import { WaterXClient } from "../../../src/unified-client.ts";
import { createMockPredictClient } from "../../prediction/helpers/mock-client.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";
import { moveTargets } from "../helpers/fixtures/ptb-inspect.ts";
import { attachPythGrpcMocks, mockAccumulatorUpdate } from "../helpers/fixtures/pyth-mock-grpc.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

/** Fake `PriceUpdateRule` — supports exactly `supported`, no on-chain calls. */
function createFakeRule(kind: OracleSource, supported: string[]): PriceUpdateRule {
  return {
    kind,
    // The mocked `buildUpdateCalls` below never charges anything, regardless
    // of which real rule `kind` it stands in for — honestly fee-free.
    requiresFeeSource: false,
    supportedTickers: vi.fn((_host: OracleHost): string[] => supported),
    fetchUpdateData: vi.fn(
      async (_host: OracleHost, tickers: string[]): Promise<RuleUpdateData> => ({
        kind,
        payload: { tickers },
      }),
    ),
    // Honest indivisible fake, faithful to the port contract:
    //  - a wrong-`kind` payload is a routing bug → THROWS (real rules enforce
    //    this via `assertRuleUpdateData`), it is never a miss;
    //  - otherwise serves the payload whole for covered tickers, misses
    //    (`null`) as soon as any requested ticker is outside `supported`.
    narrowUpdateData: vi.fn(
      (_host: OracleHost, data: RuleUpdateData, tickers: string[]): RuleUpdateData => {
        if (data !== null && data.kind !== kind) {
          throw new Error(
            `narrowUpdateData: received a payload of kind '${data.kind}', expected '${kind}'`,
          );
        }
        return data !== null && tickers.length > 0 && tickers.every((t) => supported.includes(t))
          ? data
          : null;
      },
    ),
    buildUpdateCalls: vi.fn(
      async (
        _tx: Transaction,
        _host: OracleHost,
        _data: RuleUpdateData,
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
    await updatePythPrices(referenceTx, client, feedIds, { feeSource: { kind: "gas" } });
    aggregateTicker(referenceTx, client, {
      ticker: "BTCUSD",
      priceInfoObjectId: client.getPythFeed("BTCUSD").price_info_object,
    });
    aggregateTicker(referenceTx, client, {
      ticker: "ETHUSD",
      priceInfoObjectId: client.getPythFeed("ETHUSD").price_info_object,
    });

    const actualTx = new Transaction();
    await refreshOraclePrices(actualTx, client, ["BTCUSD", "ETHUSD"], {
      feeSource: { kind: "gas" },
    });

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

  it("routes served tickers to the selected source and NEVER touches another source (no fallback)", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    attachPythGrpcMocks(client);
    mockHermesFetch();

    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD", "ETHUSD"]);
    const coreSpy = vi.spyOn(PythCoreRule, "fetchUpdateData");

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "ETHUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });

    // The selected source serves its whole group in one call; PythCoreRule is
    // never consulted — there is no fallback group.
    expect(fakeLazer.fetchUpdateData).toHaveBeenCalledTimes(1);
    expect(fakeLazer.fetchUpdateData).toHaveBeenCalledWith(client, ["BTCUSD", "ETHUSD"]);
    expect(coreSpy).not.toHaveBeenCalled();

    const targets = moveTargets(tx);
    expect(targets).toContain("oracle::aggregate");
    expect(targets.filter((t) => t === "oracle::new_collector")).toHaveLength(2);
  });

  it("fails the tx-build (no fallback) when the selected source has no feed for a requested ticker", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    attachPythGrpcMocks(client);
    mockHermesFetch();

    // Fake lazer serves only ETHUSD; BTCUSD is a normal (non-constant) ticker
    // with no lazer feed → the build must throw instead of rerouting it to
    // PythCoreRule.
    const fakeLazer = createFakeRule("pyth_lazer_rule", ["ETHUSD"]);
    const coreSpy = vi.spyOn(PythCoreRule, "fetchUpdateData");

    await expect(
      refreshOraclePrices(new Transaction(), client, ["BTCUSD", "ETHUSD"], {
        ruleOverrides: { pyth_lazer_rule: fakeLazer },
      }),
    ).rejects.toThrow(/oracleSource \[pyth_lazer_rule\] has no feed configured.*BTCUSD/);

    // No fallback rule ran, and the selected rule never fetched either (throw
    // is hoisted above every off-chain call).
    expect(coreSpy).not.toHaveBeenCalled();
    expect(fakeLazer.fetchUpdateData).not.toHaveBeenCalled();
  });

  it("forwards the same tx and opts.cache/opts.feeSource into buildUpdateCalls, alongside the exact payload fetchUpdateData resolved", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    // The fake covers every requested ticker, so no real on-chain Pyth/sponsor
    // call runs — safe to forward an inert feeSource stub through to it.
    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);

    const tx = new Transaction();
    const cache = new PythCache();
    const feeSource: OracleFeeSource = {
      kind: "sponsor",
      fund: tx.pure.u64(0),
      packageId: "0xsponsor",
    };
    await refreshOraclePrices(tx, client, ["BTCUSD"], {
      cache,
      feeSource,
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });

    expect(fakeLazer.buildUpdateCalls).toHaveBeenCalledTimes(1);
    expect(fakeLazer.buildUpdateCalls).toHaveBeenCalledWith(
      tx,
      client,
      { kind: "pyth_lazer_rule", payload: { tickers: ["BTCUSD"] } }, // == fetchUpdateData's resolved value
      { cache, feeSource },
    );
  });
});

describe("refreshOraclePrices — 'pyth_lazer_rule' resolves the real registered rule", () => {
  it("reaches PythLazerRule's auth-first fetch (LazerApiKeyMissing) instead of OracleSourceNotImplemented", async () => {
    // No ruleOverrides: the production registry serves `pyth_lazer_rule`. The
    // fixture has lazer feeds but no `pyth.api_key`, so the real rule's fetch
    // throws its auth-first error — proof the source is registered and routed.
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    const tx = new Transaction();

    const rejection = expect(refreshOraclePrices(tx, client, ["BTCUSD"])).rejects;
    await rejection.toThrow(/LazerApiKeyMissing/);
    await rejection.toBeInstanceOf(LazerApiKeyMissingError);
  });
});

describe("refreshOraclePrices — a ticker the selected source can't serve", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("a constant-only ticker is EXEMPT from the no-feed throw (needs no price-update source)", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    attachPythGrpcMocks(client);
    mockHermesFetch();

    // USDCUSD: constant-only — priced by constant_rule, not in pyth_rule.feeds,
    // and the fake lazer rule below doesn't cover it. It needs no update leg
    // from any source, so it must NOT trip the missing-feed throw.
    client.config.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    delete client.config.packages.pyth_rule!.feeds.USDCUSD;

    const fakeLazer = createFakeRule("pyth_lazer_rule", []); // supports nothing
    const coreSpy = vi.spyOn(PythCoreRule, "fetchUpdateData");

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["USDCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });

    // No update-leg fetch of any kind …
    expect(fakeLazer.fetchUpdateData).not.toHaveBeenCalled();
    expect(coreSpy).not.toHaveBeenCalled();
    // … yet it is still fed via constant_rule at the (unchanged) aggregate step.
    expect(moveTargets(tx)).toContain("constant_rule::feed");
  });

  it("a non-constant ticker with no feed for the selected source throws (no reroute to PythCoreRule)", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    attachPythGrpcMocks(client);
    mockHermesFetch();

    // BTCUSD is in pyth_rule.feeds but the fake lazer rule doesn't serve it —
    // under the old design it fell back to PythCoreRule; now it fails the build.
    const fakeLazer = createFakeRule("pyth_lazer_rule", []);
    const coreSpy = vi.spyOn(PythCoreRule, "fetchUpdateData");

    await expect(
      refreshOraclePrices(new Transaction(), client, ["BTCUSD"], {
        ruleOverrides: { pyth_lazer_rule: fakeLazer },
      }),
    ).rejects.toThrow(/no feed configured.*BTCUSD/);
    expect(coreSpy).not.toHaveBeenCalled();
  });

  it("a DUAL-FEED ticker (constant + pyth) missing the selected feed throws — not exempted as constant", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    attachPythGrpcMocks(client);
    mockHermesFetch();

    // BTCUSD keeps its pyth_rule.feeds entry AND is pinned in constant_rule →
    // dual-feed. It still NEEDS its Pyth leg refreshed, so `isConstantTicker`
    // must NOT exempt it: under lazer (fake serves nothing) with no fallback,
    // it must fail the build rather than silently feed a stale/unrefreshed Pyth
    // leg. Only a constant-ONLY ticker (no pyth_rule.feeds) is exempt.
    client.config.packages.constant_rule!.feeds = { BTCUSD: { price: "1000000000" } };
    expect(client.config.packages.pyth_rule!.feeds.BTCUSD).toBeDefined(); // still dual-feed
    expect(client.isConstantTicker("BTCUSD")).toBe(true); // would have been wrongly exempted

    const fakeLazer = createFakeRule("pyth_lazer_rule", []);
    const coreSpy = vi.spyOn(PythCoreRule, "fetchUpdateData");

    await expect(
      refreshOraclePrices(new Transaction(), client, ["BTCUSD"], {
        ruleOverrides: { pyth_lazer_rule: fakeLazer },
      }),
    ).rejects.toThrow(/no feed configured.*BTCUSD/);
    expect(coreSpy).not.toHaveBeenCalled();
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
      feeSource: { kind: "gas" },
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
    expect(client.oracleSources).toEqual(["pyth_rule"]);
  });

  it("resolves to the passed oracleSource option", () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    expect(client.oracleSources).toEqual(["pyth_lazer_rule"]);
  });
});

describe("PerpClient.create — oracleSource threads through the async factory", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // No "defaults when omitted" case on purpose: `oracleSource` is a REQUIRED
  // create option — omitting it is a compile error, not a runtime default.
  it("resolves the passed oracleSource option", async () => {
    vi.spyOn(configModule, "loadConfig").mockResolvedValue(MOCK_TESTNET_CONFIG);
    const client = await PerpClient.create("TESTNET", { oracleSource: "pyth_lazer_rule" });
    expect(client.oracleSources).toEqual(["pyth_lazer_rule"]);
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

  it("the top-level oracleSource is required and forwarded verbatim", async () => {
    const perpCreate = vi.spyOn(PerpClient, "create").mockResolvedValue(createUnitTestClient());
    vi.spyOn(PredictClient, "create").mockResolvedValue(createMockPredictClient());

    await WaterXClient.create({ oracleSource: "pyth_rule" });

    expect(perpCreate).toHaveBeenCalledWith(
      "TESTNET",
      expect.objectContaining({ oracleSource: "pyth_rule" }),
    );
  });
});

describe("refreshOraclePrices — updateDataProvider (BE prefetch-cache seam)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the provider's cached data instead of the rule's live fetch on a matching-kind hit", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);
    const cachedData: RuleUpdateData = { kind: "pyth_lazer_rule", payload: { cached: true } };
    const provider: UpdateDataProvider = { get: vi.fn(async () => cachedData) };

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
      updateDataProvider: provider,
    });

    expect(provider.get).toHaveBeenCalledWith("pyth_lazer_rule", ["BTCUSD"]);
    // The hit is narrowed to the group's tickers before use (here the
    // indivisible Lazer payload covers BTCUSD, so it passes through whole).
    expect(fakeLazer.narrowUpdateData).toHaveBeenCalledWith(client, cachedData, ["BTCUSD"]);
    expect(fakeLazer.fetchUpdateData).not.toHaveBeenCalled();
    expect(fakeLazer.buildUpdateCalls).toHaveBeenCalledWith(tx, client, cachedData, {
      cache: undefined,
      feeSource: undefined,
    });
  });

  it("narrows a whole-universe cached hit down to the group's tickers before building (divisible Pyth Core payload)", async () => {
    // Regression: without narrowing, a whole-universe Core hit would emit an
    // update_single_price_feed — and charge its fee — for every cached feed
    // instead of just this group's requested ticker.
    const client = createUnitTestClient(); // default 'pyth_rule'
    const wholeUniverse: RuleUpdateData = {
      kind: "pyth_rule",
      payload: { feedIds: ["btc-feed", "eth-feed"], updates: ["blob"] },
    };
    const narrowedToBtc: RuleUpdateData = {
      kind: "pyth_rule",
      payload: { feedIds: ["btc-feed"], updates: ["blob"] },
    };
    const fakeCore: PriceUpdateRule = {
      ...createFakeRule("pyth_rule", ["BTCUSD", "ETHUSD"]),
      // Divisible payload: subsets to exactly the requested tickers.
      narrowUpdateData: vi.fn((_host: OracleHost, _data: RuleUpdateData, tickers: string[]) =>
        tickers.length === 1 && tickers[0] === "BTCUSD" ? narrowedToBtc : null,
      ),
    };
    const provider: UpdateDataProvider = { get: vi.fn(async () => wholeUniverse) };

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD"], {
      ruleOverrides: { pyth_rule: fakeCore },
      updateDataProvider: provider,
    });

    // Provider returned the whole universe; the rule narrowed it; the build
    // (and thus the on-chain update fee) sees ONLY the BTC subset.
    expect(fakeCore.narrowUpdateData).toHaveBeenCalledWith(client, wholeUniverse, ["BTCUSD"]);
    expect(fakeCore.buildUpdateCalls).toHaveBeenCalledWith(tx, client, narrowedToBtc, {
      cache: undefined,
      feeSource: undefined,
    });
    expect(fakeCore.fetchUpdateData).not.toHaveBeenCalled();
  });

  it("live-fetches when a cached hit cannot cover the group's tickers (narrowUpdateData → null miss)", async () => {
    // An indivisible cached payload built for a different ticker set can't
    // serve this group — narrowUpdateData misses (null), and the group must
    // fall through to a live fetch, NOT throw and NOT ship the wrong payload.
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    const cachedForOthers: RuleUpdateData = {
      kind: "pyth_lazer_rule",
      payload: { covers: ["ETHUSD"] },
    };
    const fakeLazer: PriceUpdateRule = {
      ...createFakeRule("pyth_lazer_rule", ["BTCUSD"]),
      narrowUpdateData: vi.fn((): RuleUpdateData => null),
    };
    const provider: UpdateDataProvider = { get: vi.fn(async () => cachedForOthers) };

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
      updateDataProvider: provider,
    });

    expect(fakeLazer.narrowUpdateData).toHaveBeenCalledWith(client, cachedForOthers, ["BTCUSD"]);
    expect(fakeLazer.fetchUpdateData).toHaveBeenCalledWith(client, ["BTCUSD"]);
    expect(fakeLazer.buildUpdateCalls).toHaveBeenCalledWith(
      tx,
      client,
      { kind: "pyth_lazer_rule", payload: { tickers: ["BTCUSD"] } },
      { cache: undefined, feeSource: undefined },
    );
  });

  it("throws when the provider's hit carries a different rule's kind (caller bug, not a cache miss)", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);
    const wrongKindData: RuleUpdateData = {
      kind: "pyth_rule",
      payload: { updates: [], feedIds: [] },
    };
    const provider: UpdateDataProvider = { get: vi.fn(async () => wrongKindData) };

    const tx = new Transaction();
    // A kind mismatch surfaces from narrowUpdateData's own guard (real rules
    // route it through assertRuleUpdateData) — the orchestrator no longer
    // duplicates that check.
    await expect(
      refreshOraclePrices(tx, client, ["BTCUSD"], {
        ruleOverrides: { pyth_lazer_rule: fakeLazer },
        updateDataProvider: provider,
      }),
    ).rejects.toThrow(
      /narrowUpdateData: received a payload of kind 'pyth_rule'.*expected 'pyth_lazer_rule'/,
    );
    // A kind mismatch is a caller bug — it must throw, never silently fall
    // back to a live fetch (that would mask the bug as a cache miss).
    expect(fakeLazer.fetchUpdateData).not.toHaveBeenCalled();
  });

  it("falls back to the rule's live fetch when the provider throws (a broken cache must never break the money path)", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);
    const provider: UpdateDataProvider = {
      get: vi.fn(async () => {
        throw new Error("cache layer down");
      }),
    };

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
      updateDataProvider: provider,
    });

    expect(provider.get).toHaveBeenCalledWith("pyth_lazer_rule", ["BTCUSD"]);
    expect(fakeLazer.fetchUpdateData).toHaveBeenCalledWith(client, ["BTCUSD"]);
  });

  it("falls back to the rule's live fetch when the provider returns null (cache miss)", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);
    const provider: UpdateDataProvider = { get: vi.fn(async () => null) };

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
      updateDataProvider: provider,
    });

    expect(provider.get).toHaveBeenCalledWith("pyth_lazer_rule", ["BTCUSD"]);
    expect(fakeLazer.fetchUpdateData).toHaveBeenCalledWith(client, ["BTCUSD"]);
  });

  it("is never consulted when no updateDataProvider is passed (default behavior unchanged)", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });

    expect(fakeLazer.fetchUpdateData).toHaveBeenCalledWith(client, ["BTCUSD"]);
  });
});

describe("resolveOracleRule", () => {
  it("resolves 'pyth_rule' to PythCoreRule by default", () => {
    expect(resolveOracleRule("pyth_rule")).toBe(PythCoreRule);
  });

  it("resolves 'pyth_lazer_rule' to PythLazerRule", () => {
    expect(resolveOracleRule("pyth_lazer_rule")).toBe(PythLazerRule);
  });

  it("throws OracleSourceNotImplemented for a genuinely unregistered source", () => {
    // Deliberately-invalid input: only a cast can reach the unregistered path
    // now that all three real sources (pyth / lazer / waterx) resolve.
    // `supra_rule` is a PriceUpdateRuleKind but NOT a selectable OracleSource,
    // so it stays unregistered — the clean stand-in for the unregistered path.
    let caught: unknown;
    try {
      resolveOracleRule("supra_rule" as OracleSource);
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toBe("OracleSourceNotImplemented: supra_rule");
    // instanceof-able (mirrors OracleFeeSourceUnavailableError) — a consumer
    // can branch on the error type directly instead of string-matching
    // `.message`.
    expect(caught).toBeInstanceOf(OracleSourceNotImplementedError);
  });

  it("lets an override map replace the registered lazer rule", () => {
    const fake = createFakeRule("pyth_lazer_rule", []);
    expect(resolveOracleRule("pyth_lazer_rule", { pyth_lazer_rule: fake })).toBe(fake);
  });

  it("overrides take precedence over the production registry for a registered source", () => {
    const fake = createFakeRule("pyth_rule", []);
    expect(resolveOracleRule("pyth_rule", { pyth_rule: fake })).toBe(fake);
  });
});

describe("refreshOraclePrices — multi-source fed set", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * A fake waterx rule must honor the port's payload contract — the routing
   * in refreshOraclePrices hands a waterx group's data to `waterxEnvelopeOf`,
   * which (correctly) THROWS on a non-envelope payload rather than missing.
   */
  function createFakeWaterxRule(supported: string[]): PriceUpdateRule {
    const fake = createFakeRule("waterx_rule", supported);
    const envelope = { intent: 1, timestamp_ms: 0n, signature: "", payload: { items: [] } };
    vi.mocked(fake.fetchUpdateData).mockResolvedValue({
      kind: "waterx_rule",
      payload: { envelope },
    });
    return fake;
  }

  it("dedupes the caller's ticker list — a repeated ticker must not double-aggregate in one PTB", async () => {
    // Pre-existing base hazard: a duplicated ticker aggregated TWICE in one
    // tx — wasted gas everywhere, and under waterx the repeat is pure waste:
    // the second collect replays the same signed timestamp, so the per-symbol
    // high-water mark (F-014) makes it abstain after paying full verification.
    const client = createUnitTestClient({ oracleSource: ["waterx_rule"] });
    attachPythGrpcMocks(client);
    const fakeWaterx = createFakeWaterxRule(["BTCUSD", "ETHUSD"]);

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "ETHUSD", "BTCUSD"], {
      ruleOverrides: { waterx_rule: fakeWaterx },
    });

    expect(fakeWaterx.fetchUpdateData).toHaveBeenCalledWith(client, ["BTCUSD", "ETHUSD"]);
    // One collector per UNIQUE ticker: waterx's verify+feed is one
    // collect_batch_latest per collector, so counting those commands counts
    // aggregations.
    const collectCalls = tx
      .getData()
      .commands.filter(
        (command) =>
          command.$kind === "MoveCall" && command.MoveCall.function === "collect_batch_latest",
      );
    expect(collectCalls).toHaveLength(2);
  });

  it("feeds EVERY listed source's group in one build (per-source fetch + per-source tickers)", async () => {
    const client = createUnitTestClient({
      oracleSource: ["pyth_lazer_rule", "waterx_rule"],
    });
    attachPythGrpcMocks(client);
    mockHermesFetch();

    // Lazer serves BTC+ETH, waterx serves ETH only — ETH is deliberately in
    // BOTH groups (double-feeding one ticker is valid; the chain's weight
    // table arbitrates).
    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD", "ETHUSD"]);
    const fakeWaterx = createFakeWaterxRule(["ETHUSD"]);

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "ETHUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer, waterx_rule: fakeWaterx },
    });

    expect(fakeLazer.fetchUpdateData).toHaveBeenCalledWith(client, ["BTCUSD", "ETHUSD"]);
    expect(fakeWaterx.fetchUpdateData).toHaveBeenCalledWith(client, ["ETHUSD"]);
    expect(fakeLazer.buildUpdateCalls).toHaveBeenCalledTimes(1);
    expect(fakeWaterx.buildUpdateCalls).toHaveBeenCalledTimes(1);

    const targets = moveTargets(tx);
    expect(targets.filter((t) => t === "oracle::new_collector")).toHaveLength(2);
    expect(targets).toContain("oracle::aggregate");
  });

  it("a ticker is servable when ANY listed source has its feed — and unservable only when none does", async () => {
    const client = createUnitTestClient({
      oracleSource: ["pyth_lazer_rule", "waterx_rule"],
    });
    attachPythGrpcMocks(client);
    mockHermesFetch();

    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);
    const fakeWaterx = createFakeWaterxRule(["ETHUSD"]);

    // Union covers both tickers — succeeds even though EACH source alone
    // would have thrown for the other's ticker.
    const okTx = new Transaction();
    await refreshOraclePrices(okTx, client, ["BTCUSD", "ETHUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer, waterx_rule: fakeWaterx },
    });
    expect(moveTargets(okTx)).toContain("oracle::aggregate");

    // SUIUSD is outside both groups → the whole build fails, naming the list.
    await expect(
      refreshOraclePrices(new Transaction(), client, ["BTCUSD", "SUIUSD"], {
        ruleOverrides: { pyth_lazer_rule: fakeLazer, waterx_rule: fakeWaterx },
      }),
    ).rejects.toThrow(
      /oracleSource \[pyth_lazer_rule, waterx_rule\] has no feed configured.*SUIUSD/,
    );
  });

  it("the fee pre-check fires iff a fee-charging source is in the fed set with tickers to serve", async () => {
    // Core in the list + no feeSource → throws before ANY fetch.
    const client = createUnitTestClient({ oracleSource: ["pyth_rule", "pyth_lazer_rule"] });
    attachPythGrpcMocks(client);
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD", "ETHUSD"]);
    await expect(
      refreshOraclePrices(new Transaction(), client, ["BTCUSD"], {
        ruleOverrides: { pyth_lazer_rule: fakeLazer },
      }),
    ).rejects.toThrow(OracleFeeSourceUnavailableError);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Fee-free-only list → no feeSource needed.
    const feeFree = createUnitTestClient({ oracleSource: ["pyth_lazer_rule"] });
    attachPythGrpcMocks(feeFree);
    mockHermesFetch();
    const tx = new Transaction();
    await refreshOraclePrices(tx, feeFree, ["BTCUSD"], {
      ruleOverrides: { pyth_lazer_rule: createFakeRule("pyth_lazer_rule", ["BTCUSD"]) },
    });
    expect(moveTargets(tx)).toContain("oracle::aggregate");
  });

  it("client normalizes a single source to a one-element list and dedupes a repeated one", () => {
    expect(createUnitTestClient({ oracleSource: "waterx_rule" }).oracleSources).toEqual([
      "waterx_rule",
    ]);
    expect(
      createUnitTestClient({
        oracleSource: ["pyth_rule", "waterx_rule", "pyth_rule"],
      }).oracleSources,
    ).toEqual(["pyth_rule", "waterx_rule"]);
  });
});

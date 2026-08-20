/**
 * Env-selected oracle rule routing — `oracleSource` client option threading
 * (unified-client → PerpClient → OracleHost) and `refreshOraclePrices`'s
 * per-rule grouping via `rule-registry.ts`. No real network: every source's
 * off-chain fetch is either injected as a fake rule or stubbed on
 * `globalThis.fetch`.
 */
import { toHex } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OracleHost } from "../../../src/oracle/host.ts";
import {
  aggregateTicker,
  parseSignedLeaves,
  refreshOraclePrices,
} from "../../../src/oracle/index.ts";
import type {
  BuildUpdateOpts,
  OracleSource,
  PriceUpdateRule,
  RuleUpdateData,
  RuleUpdateHandle,
  UpdateDataProvider,
} from "../../../src/oracle/price-update-rule.ts";
import {
  OracleSourceNotImplementedError,
  resolveOracleRule,
} from "../../../src/oracle/rule-registry.ts";
import {
  LazerApiKeyMissingError,
  PythLazerRule,
} from "../../../src/oracle/rules/pyth-lazer-rule.ts";
import { WaterxRule } from "../../../src/oracle/rules/waterx-rule.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import * as configModule from "../../../src/perp/config.ts";
import { PredictClient } from "../../../src/prediction/client.ts";
import { WaterXClient } from "../../../src/unified-client.ts";
import { createMockPredictClient } from "../../prediction/helpers/mock-client.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";
import { moveTargets } from "../helpers/fixtures/ptb-inspect.ts";
import { quoteCenterLeavesBody } from "../helpers/fixtures/waterx-quote-center-mock.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

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
    // A lazer fake must hand back a `RuleUpdateHandle`, exactly as the real
    // rule does: `aggregateTicker` has no other way to reach a feed leg for a
    // lazer-served ticker, so a `void`-returning fake would make every routed
    // ticker look unservable and throw. `tx.pure.u64(0)` stands in for the
    // verified `Update` — the orchestrator only carries it, never reads it.
    buildUpdateCalls: vi.fn(
      async (
        tx: Transaction,
        _host: OracleHost,
        _data: RuleUpdateData,
        _opts?: BuildUpdateOpts,
      ): Promise<RuleUpdateHandle | void> =>
        kind === "pyth_lazer_rule"
          ? { kind: "pyth_lazer_rule", update: tx.pure.u64(0) }
          : undefined,
    ),
  };
}

/**
 * A fake waterx rule must honor the port's payload contract — the routing in
 * refreshOraclePrices hands a waterx group's data to `waterxEnvelopeOf`, which
 * (correctly) THROWS on a non-envelope payload rather than missing.
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

describe("refreshOraclePrices — 'pyth_lazer_rule' with a fake rule injected", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("routes served tickers to the selected source and NEVER touches another source (no fallback)", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });

    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD", "ETHUSD"]);
    const otherSourceSpy = vi.spyOn(WaterxRule, "fetchUpdateData");

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "ETHUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });

    // The selected source serves its whole group in one call; PythCoreRule is
    // never consulted — there is no fallback group.
    expect(fakeLazer.fetchUpdateData).toHaveBeenCalledTimes(1);
    expect(fakeLazer.fetchUpdateData).toHaveBeenCalledWith(client, ["BTCUSD", "ETHUSD"]);
    expect(otherSourceSpy).not.toHaveBeenCalled();

    const targets = moveTargets(tx);
    expect(targets).toContain("oracle::aggregate");
    expect(targets.filter((t) => t === "oracle::new_collector")).toHaveLength(2);
  });

  it("skips (does not reroute, does not throw) a ticker the selected source has no feed for", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });

    // Fake lazer serves only ETHUSD; BTCUSD is a normal (non-constant) ticker
    // with no lazer feed → it is dropped from the build, NOT rerouted to
    // the other listed source and NOT fatal.
    const fakeLazer = createFakeRule("pyth_lazer_rule", ["ETHUSD"]);
    const otherSourceSpy = vi.spyOn(WaterxRule, "fetchUpdateData");

    const tx = new Transaction();
    const summary = await refreshOraclePrices(tx, client, ["BTCUSD", "ETHUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });

    expect(summary).toEqual({ refreshed: ["ETHUSD"], skipped: ["BTCUSD"] });
    // No fallback rule ran, and the served source fetched only its own ticker.
    expect(otherSourceSpy).not.toHaveBeenCalled();
    expect(fakeLazer.fetchUpdateData).toHaveBeenCalledWith(client, ["ETHUSD"]);
    // Exactly one collector — BTCUSD contributed no PTB commands at all.
    expect(moveTargets(tx).filter((t) => t === "oracle::new_collector")).toHaveLength(1);
  });

  it("forwards the same tx and opts.cache/opts.feeSource into buildUpdateCalls, alongside the exact payload fetchUpdateData resolved", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });

    expect(fakeLazer.buildUpdateCalls).toHaveBeenCalledTimes(1);
    expect(fakeLazer.buildUpdateCalls).toHaveBeenCalledWith(
      tx,
      client,
      { kind: "pyth_lazer_rule", payload: { tickers: ["BTCUSD"] } }, // == fetchUpdateData's resolved value
      // `BuildUpdateOpts` is empty now that Pyth Core's `cache`/`feeSource`
      // mechanics are gone — the orchestrator still passes the object through.
      {},
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

    // USDCUSD: constant-ONLY — priced by constant_rule and wired by no price
    // source (its lazer/waterx feeds are removed below), so it needs no update
    // leg and must NOT be skipped.
    client.config.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    delete client.config.packages.pyth_lazer_rule!.feeds.USDCUSD;
    delete client.config.packages.waterx_rule!.feeds.USDCUSD;

    const fakeLazer = createFakeRule("pyth_lazer_rule", []); // supports nothing

    const tx = new Transaction();
    const summary = await refreshOraclePrices(tx, client, ["USDCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });

    // No update-leg fetch of any kind …
    expect(summary).toEqual({ refreshed: ["USDCUSD"], skipped: [] });
    expect(fakeLazer.fetchUpdateData).not.toHaveBeenCalled();
    // … yet it is still fed via constant_rule at the (unchanged) aggregate step.
    expect(moveTargets(tx)).toContain("constant_rule::feed");
  });

  it("a non-constant ticker with no feed for the selected source is skipped (no reroute to another rule)", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });

    // BTCUSD is in waterx_rule.feeds, but waterx is NOT in this client's fed
    // set and the fake lazer rule doesn't serve it. A feeds entry under an
    // unlisted source must NOT make it servable — nothing pushes a price, so
    // nothing is emitted for it.
    const fakeLazer = createFakeRule("pyth_lazer_rule", []);
    const otherSourceSpy = vi.spyOn(WaterxRule, "fetchUpdateData");

    const tx = new Transaction();
    const summary = await refreshOraclePrices(tx, client, ["BTCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });
    expect(summary).toEqual({ refreshed: [], skipped: ["BTCUSD"] });
    expect(otherSourceSpy).not.toHaveBeenCalled();
    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });

  it("a DUAL-FEED ticker (constant + pyth) missing the selected feed is skipped — not exempted as constant", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });

    // BTCUSD keeps its waterx_rule.feeds entry AND is pinned in constant_rule
    // → dual-feed. It still NEEDS waterx's signed price, so `isConstantTicker`
    // must NOT exempt it: under lazer alone (fake serves nothing) it must be
    // left out rather than aggregated off the constant leg only, which would
    // starve the still-weighted waterx rule (`EMissingPriceSource`). Only a
    // constant-ONLY ticker is exempt, and it is the skip — not a throw — that
    // keeps the rest of a build alive.
    client.config.packages.constant_rule!.feeds = { BTCUSD: { price: "1000000000" } };
    expect(client.config.packages.waterx_rule!.feeds.BTCUSD).toBeDefined(); // still dual-feed
    expect(client.isConstantTicker("BTCUSD")).toBe(true); // would have been wrongly exempted

    const fakeLazer = createFakeRule("pyth_lazer_rule", []);
    const otherSourceSpy = vi.spyOn(WaterxRule, "fetchUpdateData");

    const tx = new Transaction();
    const summary = await refreshOraclePrices(tx, client, ["BTCUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer },
    });
    expect(summary).toEqual({ refreshed: [], skipped: ["BTCUSD"] });
    expect(otherSourceSpy).not.toHaveBeenCalled();
    // No collector at all — in particular no constant_rule::feed standing in
    // for the missing Pyth refresh.
    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });
});

describe("refreshOraclePrices — a RETIRED rule (config block dropped) in the fed set", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * The shape of the testnet break that retired Pyth Core: a deployment drops
   * a rule's package block (or empties its `feeds`) while consumers still name
   * it in `ORACLE_SOURCE`. Nothing about that combination may fail — the fed
   * set names what the client is willing to push, the config decides what it
   * can. Exercised here with `pyth_lazer_rule`, which is what a deployment can
   * still retire now that Core is gone from the SDK entirely.
   */
  it("contributes nothing and does not throw when the listed source has no config block", async () => {
    const client = createUnitTestClient({ oracleSource: ["waterx_rule", "pyth_lazer_rule"] });
    delete client.config.packages.pyth_lazer_rule;
    const lazerSpy = vi.spyOn(PythLazerRule, "fetchUpdateData");

    // waterx serves both tickers; lazer is listed but unconfigured.
    const fakeWaterx = createFakeWaterxRule(["BTCUSD", "ETHUSD"]);
    const tx = new Transaction();
    const summary = await refreshOraclePrices(tx, client, ["BTCUSD", "ETHUSD"], {
      ruleOverrides: { waterx_rule: fakeWaterx },
    });

    expect(summary).toEqual({ refreshed: ["BTCUSD", "ETHUSD"], skipped: [] });
    expect(lazerSpy).not.toHaveBeenCalled();
    const targets = moveTargets(tx);
    // No lazer leg at all — but both tickers aggregated.
    expect(targets).not.toContain("pyth_lazer_rule::feed");
    expect(targets.filter((t) => t === "oracle::new_collector")).toHaveLength(2);
    expect(targets).toContain("oracle::aggregate");
  });

  it("an EMPTIED feeds map is the same as an absent block — the source serves nothing", async () => {
    // The intermediate state a deployment ships first: the package is still
    // published, its feeds map is empty. `supportedTickers` returns nothing, so
    // the group is dropped before any fetch.
    const client = createUnitTestClient({ oracleSource: ["waterx_rule", "pyth_lazer_rule"] });
    client.config.packages.pyth_lazer_rule!.feeds = {};
    const lazerSpy = vi.spyOn(PythLazerRule, "fetchUpdateData");

    const fakeWaterx = createFakeWaterxRule(["BTCUSD"]);
    const tx = new Transaction();
    await expect(
      refreshOraclePrices(tx, client, ["BTCUSD"], {
        ruleOverrides: { waterx_rule: fakeWaterx },
      }),
    ).resolves.toEqual({ refreshed: ["BTCUSD"], skipped: [] });
    expect(lazerSpy).not.toHaveBeenCalled();
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

describe("PerpClient.oracleSource — resolution", () => {
  // The SDK itself has NO default — `oracleSource` is a required create
  // option. `createUnitTestClient` picks `waterx_rule` when a test does not
  // care which source is selected; this pins that helper default so a test
  // reading `client.oracleSources` knows what it got.
  it("createUnitTestClient falls back to 'waterx_rule' when the test omits it", () => {
    const client = createUnitTestClient();
    expect(client.oracleSources).toEqual(["waterx_rule"]);
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

    await WaterXClient.create({ oracleSource: "waterx_rule" });

    expect(perpCreate).toHaveBeenCalledWith(
      "TESTNET",
      expect.objectContaining({ oracleSource: "waterx_rule" }),
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

  it("narrows a whole-universe cached hit down to the group's tickers before building (divisible waterx payload)", async () => {
    // Regression: without narrowing, a whole-universe hit would push signed
    // data for every cached symbol instead of just this group's requested
    // ticker.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const wholeUniverse: RuleUpdateData = {
      kind: "waterx_rule",
      payload: { leaves: parseSignedLeaves(quoteCenterLeavesBody(["BTCUSD", "ETHUSD"])) },
    };
    const narrowedToBtc: RuleUpdateData = {
      kind: "waterx_rule",
      payload: { leaves: parseSignedLeaves(quoteCenterLeavesBody(["BTCUSD"])) },
    };
    const fakeWaterx: PriceUpdateRule = {
      ...createFakeRule("waterx_rule", ["BTCUSD", "ETHUSD"]),
      // Divisible payload: subsets to exactly the requested tickers.
      narrowUpdateData: vi.fn((_host: OracleHost, _data: RuleUpdateData, tickers: string[]) =>
        tickers.length === 1 && tickers[0] === "BTCUSD" ? narrowedToBtc : null,
      ),
    };
    const provider: UpdateDataProvider = { get: vi.fn(async () => wholeUniverse) };

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD"], {
      ruleOverrides: { waterx_rule: fakeWaterx },
      updateDataProvider: provider,
    });

    // Provider returned the whole universe; the rule narrowed it; the build
    // sees ONLY the BTC subset.
    expect(fakeWaterx.narrowUpdateData).toHaveBeenCalledWith(client, wholeUniverse, ["BTCUSD"]);
    expect(fakeWaterx.buildUpdateCalls).toHaveBeenCalledWith(tx, client, narrowedToBtc, {});
    expect(fakeWaterx.fetchUpdateData).not.toHaveBeenCalled();
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
      kind: "waterx_rule",
      payload: { leaves: [] },
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
      /narrowUpdateData: received a payload of kind 'waterx_rule'.*expected 'pyth_lazer_rule'/,
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
  it("resolves 'waterx_rule' to WaterxRule by default", () => {
    expect(resolveOracleRule("waterx_rule")).toBe(WaterxRule);
  });

  it("resolves 'pyth_lazer_rule' to PythLazerRule", () => {
    expect(resolveOracleRule("pyth_lazer_rule")).toBe(PythLazerRule);
  });

  it("a lazer rule that returns no Update handle fails the build, naming the rule", () => {
    // Regression guard for the removal of Pyth Core: a lazer-served ticker used
    // to also carry a `pyth_rule::feed` leg, so a missing Update handle still
    // produced a (wrong but valid) collector. Now the handle is the ONLY route
    // to a feed leg, and a rule that skips it must say so instead of surfacing
    // as aggregateTicker's generic "no oracle rule configured".
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    const handleless = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);
    vi.mocked(handleless.buildUpdateCalls).mockResolvedValue(undefined);

    return expect(
      refreshOraclePrices(new Transaction(), client, ["BTCUSD"], {
        ruleOverrides: { pyth_lazer_rule: handleless },
      }),
    ).rejects.toThrow(
      /pyth_lazer_rule\.buildUpdateCalls returned no verified Update handle.*BTCUSD/s,
    );
  });

  it("throws OracleSourceNotImplemented for a genuinely unregistered source", () => {
    // Deliberately-invalid input: only a cast can reach the unregistered path
    // now that both real sources (lazer / waterx) resolve.
    // `supra_rule` is a PriceUpdateRuleKind but NOT a selectable OracleSource,
    // so it stays unregistered — the clean stand-in for the unregistered path.
    let caught: unknown;
    try {
      resolveOracleRule("supra_rule" as OracleSource);
    } catch (e) {
      caught = e;
    }
    expect((caught as Error).message).toBe("OracleSourceNotImplemented: supra_rule");
    // instanceof-able (mirrors LazerApiKeyMissingError) — a consumer can
    // branch on the error type directly instead of string-matching `.message`.
    expect(caught).toBeInstanceOf(OracleSourceNotImplementedError);
  });

  it("lets an override map replace the registered lazer rule", () => {
    const fake = createFakeRule("pyth_lazer_rule", []);
    expect(resolveOracleRule("pyth_lazer_rule", { pyth_lazer_rule: fake })).toBe(fake);
  });

  it("overrides take precedence over the production registry for a registered source", () => {
    const fake = createFakeRule("waterx_rule", []);
    expect(resolveOracleRule("waterx_rule", { waterx_rule: fake })).toBe(fake);
  });
});

describe("refreshOraclePrices — multi-source fed set", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("dedupes the caller's ticker list — a repeated ticker must not double-aggregate in one PTB", async () => {
    // Pre-existing base hazard: a duplicated ticker aggregated TWICE in one
    // tx — wasted gas everywhere, and under waterx the repeat is pure waste:
    // the second collect replays the same signed timestamp, so the per-symbol
    // high-water mark (F-014) makes it abstain after paying full verification.
    const client = createUnitTestClient({ oracleSource: ["waterx_rule"] });
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

  it("a ticker is servable when ANY listed source has its feed — and skipped only when none does", async () => {
    const client = createUnitTestClient({
      oracleSource: ["pyth_lazer_rule", "waterx_rule"],
    });

    const fakeLazer = createFakeRule("pyth_lazer_rule", ["BTCUSD"]);
    const fakeWaterx = createFakeWaterxRule(["ETHUSD"]);

    // Union covers both tickers — succeeds even though EACH source alone
    // would have thrown for the other's ticker.
    const okTx = new Transaction();
    await refreshOraclePrices(okTx, client, ["BTCUSD", "ETHUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer, waterx_rule: fakeWaterx },
    });
    expect(moveTargets(okTx)).toContain("oracle::aggregate");

    // SUIUSD is outside both groups → it drops out and BTCUSD still builds.
    const partialTx = new Transaction();
    const summary = await refreshOraclePrices(partialTx, client, ["BTCUSD", "SUIUSD"], {
      ruleOverrides: { pyth_lazer_rule: fakeLazer, waterx_rule: fakeWaterx },
    });
    expect(summary).toEqual({ refreshed: ["BTCUSD"], skipped: ["SUIUSD"] });
    expect(moveTargets(partialTx).filter((t) => t === "oracle::new_collector")).toHaveLength(1);
  });

  it("client normalizes a single source to a one-element list and dedupes a repeated one", () => {
    expect(createUnitTestClient({ oracleSource: "waterx_rule" }).oracleSources).toEqual([
      "waterx_rule",
    ]);
    expect(
      createUnitTestClient({
        oracleSource: ["pyth_lazer_rule", "waterx_rule", "pyth_lazer_rule"],
      }).oracleSources,
    ).toEqual(["pyth_lazer_rule", "waterx_rule"]);
  });
});

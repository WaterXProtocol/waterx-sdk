/**
 * Pyth oracle unit tests — Hermes fetch is mocked; no real network.
 */
import { toHex } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPriceFeedsUpdateData, PythCache } from "../../../src/oracle/index.ts";
import { moveTargets } from "../helpers/fixtures/ptb-inspect.ts";
import { MOCK_HERMES_URL } from "../helpers/fixtures/sui-mock-fixtures.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

describe("fetchPriceFeedsUpdateData", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns empty array when priceIds is empty", async () => {
    globalThis.fetch = vi.fn() as typeof fetch;
    const out = await fetchPriceFeedsUpdateData(MOCK_HERMES_URL, []);
    expect(out).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("parses Hermes binary hex data into Uint8Array", async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const hex = toHex(payload);
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [hex] } }),
    })) as unknown as typeof fetch;

    const out = await fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0xabc"]);
    expect(out.length).toBe(1);
    expect(Array.from(out[0]!)).toEqual([1, 2, 3, 4]);
  });

  it("throws on non-ok HTTP response", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "server error",
    })) as unknown as typeof fetch;

    await expect(fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"])).rejects.toThrow(
      /Hermes price fetch failed: 500/,
    );
  });
});

describe("PythCache", () => {
  it("stores and reuses entries", () => {
    const cache = new PythCache();
    cache.pythStateInfo = { packageId: "0xpkg", baseUpdateFee: 1n };
    cache.priceFeedObjectIdCache.set("0xfeed", "0xobj");
    expect(cache.pythStateInfo.packageId).toBe("0xpkg");
    expect(cache.priceFeedObjectIdCache.get("0xfeed")).toBe("0xobj");
  });
});

describe("on-chain pyth PTB helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aggregateTickerWithPyth appends collector → feed → aggregate", async () => {
    const { aggregateTickerWithPyth } = await import("../../../src/oracle/index.ts");
    const client = createUnitTestClient();
    const tx = new Transaction();
    aggregateTickerWithPyth(tx, client, {
      ticker: "BTCUSD",
      priceInfoObjectId: client.getPythFeed("BTCUSD").price_info_object,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(3);
  });

  it("buildPythPriceUpdateCalls appends wormhole + pyth update block", async () => {
    const { buildPythPriceUpdateCalls } = await import("../../../src/oracle/index.ts");
    const { attachPythGrpcMocks, mockAccumulatorUpdate } =
      await import("../helpers/fixtures/pyth-mock-grpc.ts");
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const tx = new Transaction();
    const ids = await buildPythPriceUpdateCalls(
      tx,
      client,
      [mockAccumulatorUpdate()],
      [feedId],
      new PythCache(),
      undefined,
      true,
    );
    expect(ids[0]).toMatch(/^0x/);
    expect(tx.getData().commands!.length).toBeGreaterThanOrEqual(4);
  });

  it("updatePythPrices fetches Hermes then builds on-chain calls", async () => {
    const { updatePythPrices } = await import("../../../src/oracle/index.ts");
    const { attachPythGrpcMocks } = await import("../helpers/fixtures/pyth-mock-grpc.ts");
    const { mockAccumulatorUpdate } = await import("../helpers/fixtures/pyth-mock-grpc.ts");
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [toHex(mockAccumulatorUpdate())] } }),
    })) as unknown as typeof fetch;

    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const tx = new Transaction();
    const ids = await updatePythPrices(tx, client, [feedId], undefined, undefined, true);
    expect(ids.length).toBe(1);
  });

  it("refreshOraclePrices runs update + per-ticker aggregate", async () => {
    const { refreshOraclePrices } = await import("../../../src/oracle/index.ts");
    const { attachPythGrpcMocks } = await import("../helpers/fixtures/pyth-mock-grpc.ts");
    const { mockAccumulatorUpdate } = await import("../helpers/fixtures/pyth-mock-grpc.ts");
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [toHex(mockAccumulatorUpdate())] } }),
    })) as unknown as typeof fetch;

    const client = createUnitTestClient();
    attachPythGrpcMocks(client);
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "USDCUSD"], { allowGasFee: true });
    expect(tx.getData().commands!.length).toBeGreaterThan(5);
  });

  it("buildPythPriceUpdateCalls throws on empty updates", async () => {
    const { buildPythPriceUpdateCalls } = await import("../../../src/oracle/index.ts");
    const client = createUnitTestClient();
    const tx = new Transaction();
    await expect(buildPythPriceUpdateCalls(tx, client, [], ["0x1"])).rejects.toThrow(
      /No price update data/,
    );
  });

  it("openPythSponsorFund throws when sponsor config missing", async () => {
    const { openPythSponsorFund } = await import("../../../src/oracle/index.ts");
    const bare = createUnitTestClient();
    delete (bare.config.packages as { pyth_sponsor_rule?: unknown }).pyth_sponsor_rule;
    const tx = new Transaction();
    expect(() => openPythSponsorFund(tx, bare)).toThrow(/sponsor flow unavailable/);
  });
});

describe("constant rule oracle routing", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("aggregateTickerWithConstant appends collector → constant_rule::feed → aggregate", async () => {
    const { aggregateTickerWithConstant } = await import("../../../src/oracle/index.ts");
    const client = createUnitTestClient();
    client.config.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    // Constant-ONLY: drop the Pyth feed so USDCUSD isn't dual.
    delete client.config.packages.pyth_rule!.feeds.USDCUSD;
    const tx = new Transaction();
    aggregateTickerWithConstant(tx, client, { ticker: "USDCUSD" });
    const targets = moveTargets(tx);
    expect(targets).toContain("oracle::new_collector");
    expect(targets).toContain("constant_rule::feed");
    expect(targets).toContain("oracle::aggregate");
    expect(targets).not.toContain("pyth_rule::feed");
  });

  it("aggregateTickerWithConstant throws for a dual-feed ticker (still in pyth_rule.feeds)", async () => {
    const { aggregateTickerWithConstant } = await import("../../../src/oracle/index.ts");
    const client = createUnitTestClient();
    // USDCUSD is in the fixture's pyth_rule.feeds → constant + Pyth = dual. The
    // constant-only wrapper must refuse it (feeding only Constant would abort
    // aggregate with EMissingPriceSource on the still-weighted Pyth rule).
    client.config.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    const tx = new Transaction();
    expect(() => aggregateTickerWithConstant(tx, client, { ticker: "USDCUSD" })).toThrow(
      /dual-feed/,
    );
  });

  it("aggregateTickerWithConstant throws when the ticker has no rule (constant rule absent)", async () => {
    const { aggregateTickerWithConstant } = await import("../../../src/oracle/index.ts");
    const client = createUnitTestClient();
    delete client.config.packages.constant_rule;
    // Also constant-only (no Pyth feed) so the dual guard doesn't fire first.
    delete client.config.packages.pyth_rule!.feeds.USDCUSD;
    const tx = new Transaction();
    expect(() => aggregateTickerWithConstant(tx, client, { ticker: "USDCUSD" })).toThrow(
      /no oracle rule/,
    );
  });

  it("refreshOraclePrices feeds a constant ticker without hitting Hermes or Pyth", async () => {
    const { refreshOraclePrices } = await import("../../../src/oracle/index.ts");
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const client = createUnitTestClient();
    client.config.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    // Constant-ONLY (steady state): not in pyth_rule.feeds → no Pyth update / Hermes.
    delete client.config.packages.pyth_rule!.feeds.USDCUSD;
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["USDCUSD"]);

    const targets = moveTargets(tx);
    expect(targets).toContain("constant_rule::feed");
    expect(targets).not.toContain("pyth_rule::feed");
    // No Pyth update means no SUI split for the update fee, and no Hermes call.
    expect(tx.getData().commands?.some((c) => c.$kind === "SplitCoins")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refreshOraclePrices splits a mixed batch: Pyth for BTC, constant for USDC", async () => {
    const { refreshOraclePrices } = await import("../../../src/oracle/index.ts");
    const { attachPythGrpcMocks, mockAccumulatorUpdate } =
      await import("../helpers/fixtures/pyth-mock-grpc.ts");
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [toHex(mockAccumulatorUpdate())] } }),
    }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const client = createUnitTestClient();
    attachPythGrpcMocks(client);
    client.config.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    // USDC constant-ONLY (removed from pyth.feeds); BTC stays a Pyth ticker.
    delete client.config.packages.pyth_rule!.feeds.USDCUSD;
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "USDCUSD"], { allowGasFee: true });

    const targets = moveTargets(tx);
    expect(targets).toContain("pyth_rule::feed");
    expect(targets).toContain("constant_rule::feed");
    // Hermes is queried for the Pyth leg only (BTC), not the constant USDC leg.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("aggregateTicker feeds both pyth + constant for a dual ticker", async () => {
    const { aggregateTicker } = await import("../../../src/oracle/index.ts");
    const client = createUnitTestClient();
    // USDCUSD has a pyth feed (fixture) AND a constant entry → fed by both.
    client.config.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    const tx = new Transaction();
    aggregateTicker(tx, client, {
      ticker: "USDCUSD",
      priceInfoObjectId: client.getPythFeed("USDCUSD").price_info_object,
    });
    const targets = moveTargets(tx);
    expect(targets).toContain("oracle::new_collector");
    expect(targets).toContain("pyth_rule::feed");
    expect(targets).toContain("constant_rule::feed");
    expect(targets).toContain("oracle::aggregate");
  });

  it("aggregateTicker throws when no rule applies to the ticker", async () => {
    const { aggregateTicker } = await import("../../../src/oracle/index.ts");
    const client = createUnitTestClient();
    // No priceInfoObjectId (not Pyth-fed here) and not a constant ticker → nothing to feed.
    const tx = new Transaction();
    expect(() => aggregateTicker(tx, client, { ticker: "BTCUSD" })).toThrow(/no oracle rule/);
  });

  it("refreshOraclePrices dual-feed ticker runs the Pyth update AND feeds both rules", async () => {
    const { refreshOraclePrices } = await import("../../../src/oracle/index.ts");
    const { attachPythGrpcMocks, mockAccumulatorUpdate } =
      await import("../helpers/fixtures/pyth-mock-grpc.ts");
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [toHex(mockAccumulatorUpdate())] } }),
    }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const client = createUnitTestClient();
    attachPythGrpcMocks(client); // keyed to the BTCUSD feed id
    // BTCUSD is in the fixture's pyth_rule.feeds; adding a constant entry while it
    // still has a Pyth feed makes it a transition (dual-feed) ticker — no flag.
    client.config.packages.constant_rule!.feeds = {
      BTCUSD: { price: "65000000000000" },
    };
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD"], { allowGasFee: true });

    const targets = moveTargets(tx);
    // Both rules feed into the one collector for the dual ticker …
    expect(targets).toContain("pyth_rule::feed");
    expect(targets).toContain("constant_rule::feed");
    // … and the Pyth update still runs (Hermes queried), unlike constant-only.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

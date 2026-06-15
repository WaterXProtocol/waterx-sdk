/**
 * Pyth oracle unit tests — Hermes fetch is mocked; no real network.
 */
import { toHex } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPriceFeedsUpdateData, PythCache } from "../../src/utils/pyth.ts";
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
    const { aggregateTickerWithPyth } = await import("../../src/utils/pyth.ts");
    const client = createUnitTestClient();
    const tx = new Transaction();
    aggregateTickerWithPyth(tx, client, {
      ticker: "BTCUSD",
      priceInfoObjectId: client.getPythFeed("BTCUSD").price_info_object,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(3);
  });

  it("buildPythPriceUpdateCalls appends wormhole + pyth update block", async () => {
    const { buildPythPriceUpdateCalls } = await import("../../src/utils/pyth.ts");
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
    );
    expect(ids[0]).toMatch(/^0x/);
    expect(tx.getData().commands!.length).toBeGreaterThanOrEqual(4);
  });

  it("updatePythPrices fetches Hermes then builds on-chain calls", async () => {
    const { updatePythPrices } = await import("../../src/utils/pyth.ts");
    const { attachPythGrpcMocks } = await import("../helpers/fixtures/pyth-mock-grpc.ts");
    const { mockAccumulatorUpdate } = await import("../helpers/fixtures/pyth-mock-grpc.ts");
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [toHex(mockAccumulatorUpdate())] } }),
    })) as unknown as typeof fetch;

    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const tx = new Transaction();
    const ids = await updatePythPrices(tx, client, [feedId]);
    expect(ids.length).toBe(1);
  });

  it("refreshOraclePrices runs update + per-ticker aggregate", async () => {
    const { refreshOraclePrices } = await import("../../src/utils/pyth.ts");
    const { attachPythGrpcMocks } = await import("../helpers/fixtures/pyth-mock-grpc.ts");
    const { mockAccumulatorUpdate } = await import("../helpers/fixtures/pyth-mock-grpc.ts");
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [toHex(mockAccumulatorUpdate())] } }),
    })) as unknown as typeof fetch;

    const client = createUnitTestClient();
    attachPythGrpcMocks(client);
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "USDCUSD"]);
    expect(tx.getData().commands!.length).toBeGreaterThan(5);
  });

  it("buildPythPriceUpdateCalls throws on empty updates", async () => {
    const { buildPythPriceUpdateCalls } = await import("../../src/utils/pyth.ts");
    const client = createUnitTestClient();
    const tx = new Transaction();
    await expect(buildPythPriceUpdateCalls(tx, client, [], ["0x1"])).rejects.toThrow(
      /No price update data/,
    );
  });

  it("openPythSponsorFund throws when sponsor config missing", async () => {
    const { openPythSponsorFund } = await import("../../src/utils/pyth.ts");
    const bare = createUnitTestClient();
    delete (bare.config.packages as { pyth_sponsor_rule?: unknown }).pyth_sponsor_rule;
    const tx = new Transaction();
    expect(() => openPythSponsorFund(tx, bare)).toThrow(/sponsor flow unavailable/);
  });
});

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

describe("constant rule oracle routing", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("aggregateTickerWithConstant appends collector → constant_rule::feed → aggregate", async () => {
    const { aggregateTickerWithConstant } = await import("../../src/utils/pyth.ts");
    const client = createUnitTestClient();
    client.config.packages.waterx_constant_rule!.prices = { USDCUSD: "1000000000" };
    const tx = new Transaction();
    aggregateTickerWithConstant(tx, client, { ticker: "USDCUSD" });
    const targets = moveTargets(tx);
    expect(targets).toContain("oracle::new_collector");
    expect(targets).toContain("constant_rule::feed");
    expect(targets).toContain("oracle::aggregate");
    expect(targets).not.toContain("pyth_rule::feed");
  });

  it("aggregateTickerWithConstant throws when constant rule is not configured", async () => {
    const { aggregateTickerWithConstant } = await import("../../src/utils/pyth.ts");
    const client = createUnitTestClient();
    delete client.config.packages.waterx_constant_rule;
    const tx = new Transaction();
    expect(() => aggregateTickerWithConstant(tx, client, { ticker: "USDCUSD" })).toThrow(
      /waterx_constant_rule/,
    );
  });

  it("refreshOraclePrices feeds a constant ticker without hitting Hermes or Pyth", async () => {
    const { refreshOraclePrices } = await import("../../src/utils/pyth.ts");
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const client = createUnitTestClient();
    client.config.packages.waterx_constant_rule!.prices = { USDCUSD: "1000000000" };
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
    const { refreshOraclePrices } = await import("../../src/utils/pyth.ts");
    const { attachPythGrpcMocks, mockAccumulatorUpdate } =
      await import("../helpers/fixtures/pyth-mock-grpc.ts");
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [toHex(mockAccumulatorUpdate())] } }),
    }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const client = createUnitTestClient();
    attachPythGrpcMocks(client);
    client.config.packages.waterx_constant_rule!.prices = { USDCUSD: "1000000000" };
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "USDCUSD"]);

    const targets = moveTargets(tx);
    expect(targets).toContain("pyth_rule::feed");
    expect(targets).toContain("constant_rule::feed");
    // Hermes is queried for the Pyth leg only (BTC), not the constant USDC leg.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

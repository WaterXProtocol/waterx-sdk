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

  it("retries TypeError fetch failed when cause.code is ENOTFOUND", async () => {
    const payload = new Uint8Array([7]);
    const hex = toHex(payload);
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        const err = new TypeError("fetch failed");
        const cause = Object.assign(new Error("getaddrinfo ENOTFOUND hermes.example"), {
          code: "ENOTFOUND",
        });
        (err as Error & { cause: Error }).cause = cause;
        throw err;
      }
      return {
        ok: true,
        json: async () => ({ binary: { data: [hex] } }),
      };
    }) as unknown as typeof fetch;

    const out = await fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"]);
    expect(calls).toBe(2);
    expect(Array.from(out[0]!)).toEqual([7]);
  });

  it("retries TypeError fetch failed when cause.code is ECONNRESET", async () => {
    const payload = new Uint8Array([8]);
    const hex = toHex(payload);
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        const err = new TypeError("fetch failed");
        const cause = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
        (err as Error & { cause: Error }).cause = cause;
        throw err;
      }
      return {
        ok: true,
        json: async () => ({ binary: { data: [hex] } }),
      };
    }) as unknown as typeof fetch;

    const out = await fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"]);
    expect(calls).toBe(2);
    expect(Array.from(out[0]!)).toEqual([8]);
  });

  it("does not retry TypeError fetch failed without a transient cause", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    await expect(fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"])).rejects.toThrow(
      /fetch failed/,
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries transient 503 then succeeds", async () => {
    const payload = new Uint8Array([9]);
    const hex = toHex(payload);
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 503,
          text: async () => "Service Temporarily Unavailable",
        };
      }
      return {
        ok: true,
        json: async () => ({ binary: { data: [hex] } }),
      };
    }) as unknown as typeof fetch;

    const out = await fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"]);
    expect(calls).toBe(2);
    expect(Array.from(out[0]!)).toEqual([9]);
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

/**
 * Pyth oracle unit tests — Hermes fetch is mocked; no real network.
 */
import { toHex } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPriceFeedsUpdateData, PythCache } from "../../src/utils/pyth.ts";
import { MOCK_HERMES_URL } from "../helpers/fixtures/sui-mock-fixtures.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

describe("fetchPriceFeedsUpdateData", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv("WATERX_PYTH_HERMES_MAX_RETRIES", "8");
    vi.stubEnv("WATERX_PYTH_HERMES_FALLBACK_URL", "");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
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
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ binary: { data: [hex] } }), { status: 200 }),
    ) as unknown as typeof fetch;

    const out = await fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0xabc"]);
    expect(out.length).toBe(1);
    expect(Array.from(out[0]!)).toEqual([1, 2, 3, 4]);
  });

  it("throws on non-ok HTTP response", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("server error", { status: 500 }),
    ) as unknown as typeof fetch;

    await expect(fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"])).rejects.toThrow(
      /Hermes price fetch failed: 500/,
    );
  });

  it("retries transient 503 then succeeds", async () => {
    const payload = new Uint8Array([9]);
    const hex = toHex(payload);
    let transientLeft = 2;
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      if (transientLeft > 0) {
        transientLeft -= 1;
        return new Response("unavailable", { status: 503 });
      }
      return new Response(JSON.stringify({ binary: { data: [hex] } }), { status: 200 });
    }) as unknown as typeof fetch;

    const out = await fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"]);
    expect(out.length).toBe(1);
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it("throws when Hermes returns non-JSON on HTTP 200", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("not json", { status: 200 }),
    ) as unknown as typeof fetch;
    await expect(fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"])).rejects.toThrow(
      /non-JSON success body/,
    );
  });

  it("failovers beta → prod Hermes URL after exhausting per-host retries", async () => {
    vi.stubEnv("WATERX_PYTH_HERMES_MAX_RETRIES", "2");
    vi.stubEnv("WATERX_PYTH_HERMES_FALLBACK_URL", "");
    const hex = toHex(new Uint8Array([3]));
    const urls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      urls.push(u);
      if (u.includes("hermes-beta.pyth.network")) return new Response("busy", { status: 503 });
      if (u.includes("hermes.pyth.network") && !u.includes("hermes-beta")) {
        return new Response(JSON.stringify({ binary: { data: [hex] } }), { status: 200 });
      }
      return new Response("no", { status: 404 });
    }) as unknown as typeof fetch;

    const out = await fetchPriceFeedsUpdateData("https://hermes-beta.pyth.network/", ["0xaa"]);
    expect(out.length).toBe(1);
    expect(urls.some((x) => x.includes("hermes-beta.pyth.network"))).toBe(true);
    expect(urls.some((x) => x.includes("hermes.pyth.network") && !x.includes("hermes-beta"))).toBe(
      true,
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
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ binary: { data: [toHex(mockAccumulatorUpdate())] } }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;

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
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ binary: { data: [toHex(mockAccumulatorUpdate())] } }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;

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

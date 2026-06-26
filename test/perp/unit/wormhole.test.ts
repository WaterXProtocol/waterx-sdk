/**
 * Unit tests for Wormholescan / VAA helpers (`src/account/funding/wormhole.ts`).
 */
import { toBase64 } from "@mysten/bcs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchDepositVaa,
  fetchVaa,
  listBridgeWithdrawalVaas,
  listVaasByEmitter,
  padEvmEmitter,
  toWormholescanEmitter,
  vaaBase64ToBytes,
  vaaBase64ToHex,
  vaaBytesToBase64,
  waitForVaa,
} from "../../../src/account/funding/wormhole.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const client = createUnitTestClient();
const API = client.wormhole.wormholescan_api;
const EVM_EMITTER = "0x1111111111111111111111111111111111111111";
const EMITTER = toWormholescanEmitter(MOCK_TESTNET_CONFIG.packages.wormhole_bridge!.emitter_cap!);

describe("wormhole — emitter formatting", () => {
  it("toWormholescanEmitter left-pads EVM addresses to 32 bytes", () => {
    expect(toWormholescanEmitter("0x1111111111111111111111111111111111111111")).toHaveLength(64);
    expect(padEvmEmitter("1111111111111111111111111111111111111111")).toBe(
      toWormholescanEmitter("0x1111111111111111111111111111111111111111"),
    );
  });
});

describe("wormhole — VAA (de)serialization", () => {
  const raw = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
  const b64 = toBase64(raw);

  it("round-trips base64 ↔ bytes ↔ hex", () => {
    expect(vaaBase64ToBytes(b64)).toEqual(raw);
    expect(vaaBytesToBase64(raw)).toBe(b64);
    expect(vaaBase64ToHex(b64)).toBe("0xdeadbeef");
  });
});

describe("wormhole — REST (mocked fetch)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetchVaa returns null on HTTP 404 (unsigned VAA)", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    const out = await fetchVaa(API, 2, EMITTER, 1, { fetchImpl });
    expect(out).toBeNull();
  });

  it("fetchVaa throws on non-404 HTTP errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 503 }));
    await expect(fetchVaa(API, 2, EMITTER, 1, { fetchImpl })).rejects.toThrow(/Wormholescan 503/);
  });

  it("fetchVaa returns null when response has no vaa field", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ data: { sequence: 1 } }), { status: 200 }),
    );
    expect(await fetchVaa(API, 2, EMITTER, 1, { fetchImpl })).toBeNull();
  });

  it("fetchVaa parses a signed VAA payload", async () => {
    const vaa = toBase64(new Uint8Array([1, 2, 3]));
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: { vaa, sequence: 42, emitterAddr: EMITTER, guardianSetIndex: 0 },
          }),
          { status: 200 },
        ),
    );
    const out = await fetchVaa(API, 2, EMITTER, 42, { fetchImpl });
    expect(out?.vaa).toBe(vaa);
    expect(out?.sequence).toBe(42);
  });

  it("listVaasByEmitter returns items or empty array", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: [{ sequence: "99", vaa: toBase64(new Uint8Array([9])) }] }),
          {
            status: 200,
          },
        ),
    );
    const rows = await listVaasByEmitter(API, client.wormhole.sui_chain_id, EMITTER, {
      fetchImpl,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sequence).toBe("99");

    const emptyFetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    expect(await listVaasByEmitter(API, 2, EMITTER, { fetchImpl: emptyFetch })).toEqual([]);
  });

  it("listVaasByEmitter throws on HTTP error", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad", { status: 500 }));
    await expect(listVaasByEmitter(API, 2, EMITTER, { fetchImpl })).rejects.toThrow(
      /Wormholescan list 500/,
    );
  });

  it("doFetch throws when no global fetch and no fetchImpl", async () => {
    vi.stubGlobal("fetch", undefined);
    await expect(fetchVaa(API, 2, EMITTER, 1)).rejects.toThrow(/no global `fetch`/);
  });

  it("fetchDepositVaa delegates to client wormholescan endpoint", async () => {
    const vaa = toBase64(new Uint8Array([0xaa]));
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain(client.wormhole.wormholescan_api);
      return new Response(JSON.stringify({ data: { vaa, sequence: 1 } }), { status: 200 });
    }) as typeof fetch;
    const out = await fetchDepositVaa(client, 10002, EVM_EMITTER, 7, { fetchImpl });
    expect(out?.vaa).toBe(vaa);
  });

  it("listBridgeWithdrawalVaas requires emitter_cap in config", () => {
    const bare = createUnitTestClient();
    delete bare.config.packages.wormhole_bridge!.emitter_cap;
    expect(() => listBridgeWithdrawalVaas(bare)).toThrow(/emitter_cap missing/);
  });

  it("listBridgeWithdrawalVaas lists via configured emitter cap", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    await listBridgeWithdrawalVaas(client, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalled();
  });
});

describe("wormhole — waitForVaa polling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("invokes onTick for each poll attempt", async () => {
    const vaa = toBase64(new Uint8Array([1]));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { vaa, sequence: 1 } }), { status: 200 }),
      );
    const ticks: number[] = [];
    await waitForVaa(API, 2, EMITTER, 1, {
      fetchImpl,
      intervalMs: 1,
      timeoutMs: 500,
      onTick: (attempt) => ticks.push(attempt),
    });
    expect(ticks).toEqual([1, 2]);
  });

  it("uses default interval and timeout when opts omit them", async () => {
    vi.useFakeTimers();
    try {
      const vaa = toBase64(new Uint8Array([1]));
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: { vaa, sequence: 1 } }), { status: 200 }),
        );
      const pending = waitForVaa(API, 2, EMITTER, 1, { fetchImpl });
      await vi.advanceTimersByTimeAsync(30_000);
      await expect(pending).resolves.toMatchObject({ vaa });
    } finally {
      vi.useRealTimers();
    }
  });

  it("polls through sleep intervals before timing out with an active signal", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    const ac = new AbortController();
    await expect(
      waitForVaa(API, 2, EMITTER, 1, {
        fetchImpl,
        intervalMs: 1,
        timeoutMs: 50,
        signal: ac.signal,
      }),
    ).rejects.toThrow(/timeout/);
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(1);
  });

  it("returns when fetchVaa succeeds on first tick", async () => {
    const vaa = toBase64(new Uint8Array([1]));
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ data: { vaa, sequence: 1 } }), { status: 200 }),
    );
    const out = await waitForVaa(API, 2, EMITTER, 1, {
      fetchImpl,
      intervalMs: 1,
      timeoutMs: 500,
    });
    expect(out.vaa).toBe(vaa);
  });

  it("times out when VAA never appears", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    await expect(
      waitForVaa(API, 2, EMITTER, 1, { fetchImpl, intervalMs: 1, timeoutMs: 50 }),
    ).rejects.toThrow(/timeout/);
  });

  it("aborts when signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      waitForVaa(API, 2, EMITTER, 1, { signal: ac.signal, intervalMs: 1, timeoutMs: 500 }),
    ).rejects.toThrow(/aborted/);
  });

  it("aborts at sleep entry when signal was aborted after a 404 fetch", async () => {
    const ac = new AbortController();
    const fetchImpl = vi.fn(async () => {
      ac.abort();
      return new Response("", { status: 404 });
    });
    await expect(
      waitForVaa(API, 2, EMITTER, 1, {
        fetchImpl,
        intervalMs: 5000,
        timeoutMs: 10_000,
        signal: ac.signal,
      }),
    ).rejects.toThrow(/aborted/);
  });

  it("aborts while sleeping between poll attempts", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    const ac = new AbortController();
    const pending = waitForVaa(API, 2, EMITTER, 1, {
      fetchImpl,
      intervalMs: 200,
      timeoutMs: 10_000,
      signal: ac.signal,
    });
    setTimeout(() => ac.abort(), 30);
    await expect(pending).rejects.toThrow(/aborted/);
  });
});

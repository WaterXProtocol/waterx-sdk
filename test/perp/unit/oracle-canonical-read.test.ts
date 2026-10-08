/**
 * `readCanonicalPrices` — the REST seed of the canonical price plane: the
 * batch route, the per-symbol fallback when a gateway does not expose it, the
 * 404 classification it shares with the leaf path, and the "every requested
 * ticker is a key, never a hole" contract. Fetch is mocked per route (the repo's
 * convention for quote-center suites); the stream suite is the one that runs a
 * real server.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { CANONICAL_MAX_SYMBOLS_PER_REQUEST } from "../../../src/oracle/canonical/frame.ts";
import { readCanonicalPrices } from "../../../src/oracle/canonical/read.ts";
import { FetchPolicyError } from "../../../src/oracle/update-fetch.ts";
import {
  mockCanonicalRoutes,
  rawCanonicalQuote,
  rawCanonicalQuoteText,
  rawUnavailableQuote,
} from "../helpers/fixtures/canonical.ts";
import { requestedPaths } from "../helpers/fixtures/quote-center.ts";

const ENDPOINT = "https://qc.example";
const read = (tickers: string[], fetch?: Parameters<typeof readCanonicalPrices>[0]["fetch"]) =>
  readCanonicalPrices({ endpoint: ENDPOINT, tickers, fetch });

/** `{ items: [...] }` as raw text so the `*_scaled` literals reach the reviver as tokens. */
const batchText = (items: string[]) => `{"items":[${items.join(",")}]}`;

afterEach(() => vi.restoreAllMocks());

describe("readCanonicalPrices — the batch route", () => {
  it("issues ONE GET /v1/canonical?symbols=… with an accept header and decodes every item", async () => {
    const spy = mockCanonicalRoutes({
      batch: {
        text: batchText([rawCanonicalQuoteText("BTCUSD"), rawCanonicalQuoteText("ETHUSD")]),
      },
    });

    const out = await read(["BTCUSD", "ETHUSD"]);

    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0]! as unknown as [string, RequestInit];
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/v1/canonical");
    expect(parsed.searchParams.get("symbols")).toBe("BTCUSD,ETHUSD");
    expect((init.headers as Record<string, string>).accept).toBe("application/json");
    expect([...out.keys()]).toEqual(["BTCUSD", "ETHUSD"]);
    expect(out.get("BTCUSD")).toMatchObject({
      status: "ok",
      price: 82996.7079006,
      price_scaled: "82996707900600",
      timestamp_ms: 1_791_425_996_375,
    });
  });

  it("a status != ok item passes through with its reason — the server's unknown_symbol is data", async () => {
    mockCanonicalRoutes({
      batch: {
        body: {
          items: [rawCanonicalQuote("BTCUSD"), rawUnavailableQuote("XAUTUSD", "unknown_symbol")],
        },
      },
    });

    const out = await read(["BTCUSD", "XAUTUSD"]);

    expect(out.get("XAUTUSD")).toMatchObject({ status: "unavailable", reason: "unknown_symbol" });
  });

  it("a requested ticker the items omit is an unavailable entry (not_in_response); an unsolicited one is ignored; a repeat keeps the first", async () => {
    mockCanonicalRoutes({
      batch: {
        body: {
          items: [
            rawCanonicalQuote("BTCUSD", { price: 1 }),
            rawCanonicalQuote("DOGEUSD"),
            rawCanonicalQuote("BTCUSD", { price: 2 }),
          ],
        },
      },
    });

    const out = await read(["BTCUSD", "ETHUSD"]);

    expect([...out.keys()].sort()).toEqual(["BTCUSD", "ETHUSD"]);
    expect(out.get("BTCUSD")?.price).toBe(1);
    expect(out.get("ETHUSD")).toMatchObject({
      status: "unavailable",
      reason: "not_in_response",
      price: 0,
    });
  });

  it("an item that fails validation becomes an unavailable entry naming the defect, never a throw and never a hole", async () => {
    mockCanonicalRoutes({
      batch: {
        body: {
          items: [
            rawCanonicalQuote("BTCUSD", { price: 0 }),
            rawCanonicalQuote("ETHUSD", { timestamp_ms: "1791425996375" }),
            rawCanonicalQuote("SOLUSD", { status: "stale" }),
            rawCanonicalQuote("SUIUSD", { symbol: undefined }),
          ],
        },
      },
    });

    const out = await read(["BTCUSD", "ETHUSD", "SOLUSD", "SUIUSD"]);

    expect(out.get("BTCUSD")?.reason).toBe("invalid_non_positive_price");
    expect(out.get("ETHUSD")?.reason).toBe("invalid_bad_timestamp");
    expect(out.get("SOLUSD")?.reason).toBe("invalid_malformed");
    // No usable symbol ⇒ nothing to key the defect on; the requested ticker is simply unanswered.
    expect(out.get("SUIUSD")?.reason).toBe("not_in_response");
  });

  it("a 200 whose body is not { items: [...] } throws", async () => {
    mockCanonicalRoutes({ batch: { body: rawCanonicalQuote("BTCUSD") } });
    await expect(read(["BTCUSD"])).rejects.toThrow(
      /Canonical price read returned an unexpected body/,
    );
  });

  it("a 200 whose body is not JSON at all (a proxy's HTML page) is the same bounded error, not a raw SyntaxError", async () => {
    mockCanonicalRoutes({ batch: { text: "<html><body>Maintenance</body></html>" } });
    await expect(read(["BTCUSD"])).rejects.toThrow(
      /Canonical price read returned an unexpected body: <html><body>Maintenance/,
    );
  });

  it("a batch 404 WITH a coded body is a refusal — thrown, no per-symbol fallback", async () => {
    const spy = mockCanonicalRoutes({
      batch: { status: 404, body: { code: 10042, error: "weights unreadable" } },
      single: () => ({ body: rawCanonicalQuote("BTCUSD") }),
    });

    await expect(read(["BTCUSD"])).rejects.toThrow(
      /Canonical price read refused: 404 code 10042 weights unreadable/,
    );
    expect(requestedPaths(spy)).toEqual(["/v1/canonical"]);
  });

  it("a non-404 failure throws with the status and the body snippet", async () => {
    mockCanonicalRoutes({ batch: { status: 400, text: "symbols: too many" } });
    await expect(read(["BTCUSD"])).rejects.toThrow(
      /Canonical price read failed: 400 symbols: too many/,
    );
  });

  it("a 5xx exhausts fetchWithPolicy's retries and surfaces as FetchPolicyError", async () => {
    mockCanonicalRoutes({ batch: { status: 503, text: "upstream down" } });
    await expect(read(["BTCUSD"], { retries: 0 })).rejects.toBeInstanceOf(FetchPolicyError);
  });

  it("returns an empty map without fetching for an empty ticker list", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect((await read([])).size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("preserves a proxy endpoint's base path (joinEndpointPath, not new URL)", async () => {
    const spy = mockCanonicalRoutes({ batch: { body: { items: [rawCanonicalQuote("BTCUSD")] } } });

    await readCanonicalPrices({
      endpoint: "https://app.example/api/quote-center",
      tickers: ["BTCUSD"],
    });

    expect(new URL(String(spy.mock.calls[0]![0])).pathname).toBe("/api/quote-center/v1/canonical");
  });

  it("the fetch policy rides along: fetchImpl is used and apiKey becomes a Bearer", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ items: [rawCanonicalQuote("BTCUSD")] }),
      headers: new Headers(),
    } as unknown as Response);

    await read(["BTCUSD"], { fetchImpl, apiKey: "k" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
  });
});

describe("readCanonicalPrices — timestamps are judged when each response ARRIVES", () => {
  // A quote stamped by the server at arrival time T is legitimate even when the
  // call started more than CANONICAL_MAX_FUTURE_DRIFT_MS before T (long custom
  // timeouts, retries, several fallback waves). Judging it against the call's
  // start clock would turn a current price into `invalid_bad_timestamp`.
  const START = 1_791_425_000_000;
  const LATER = START + 61_000;

  /** The mocked clock is START until the response is produced, LATER from then on. */
  function clockAdvancesDuringFetch(answer: (pathname: string) => Response): void {
    let now = START;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: unknown) => {
      now = LATER;
      return answer(new URL(String(input)).pathname);
    });
  }
  const okResponse = (text: string): Response =>
    ({
      ok: true,
      status: 200,
      text: async () => text,
      headers: new Headers(),
    }) as unknown as Response;

  it("batch: a quote stamped at arrival time is ok, not invalid_bad_timestamp", async () => {
    clockAdvancesDuringFetch(() =>
      okResponse(batchText([rawCanonicalQuoteText("BTCUSD", { timestamp_ms: LATER })])),
    );

    const out = await read(["BTCUSD"]);

    expect(out.get("BTCUSD")).toMatchObject({ status: "ok", timestamp_ms: LATER });
  });

  it("per-symbol fallback: each response is judged on its own arrival clock", async () => {
    clockAdvancesDuringFetch((pathname) =>
      pathname.endsWith("/v1/canonical")
        ? ({
            ok: false,
            status: 404,
            text: async () => "Not Found",
            headers: new Headers(),
          } as unknown as Response)
        : okResponse(rawCanonicalQuoteText("BTCUSD", { timestamp_ms: LATER })),
    );

    const out = await read(["BTCUSD"]);

    expect(out.get("BTCUSD")).toMatchObject({ status: "ok", timestamp_ms: LATER });
  });
});

describe("readCanonicalPrices — per-symbol fallback when the batch route is absent", () => {
  const singles = (bodies: Record<string, Record<string, unknown>>) => (symbol: string) =>
    bodies[symbol] ? { body: bodies[symbol] } : undefined;

  it.each([
    ["an anonymous text 404", { status: 404, text: "Not Found" }],
    [
      "a framework-default JSON 404 (no code, no symbol)",
      { status: 404, body: { error: "not found" } },
    ],
  ])(
    "%s on the batch route → one GET /v1/canonical/{symbol} per ticker, merged",
    async (_label, batch) => {
      const spy = mockCanonicalRoutes({
        batch,
        single: singles({
          BTCUSD: rawCanonicalQuote("BTCUSD"),
          "ETH/USD": rawCanonicalQuote("ETH/USD"),
        }),
      });

      const out = await read(["BTCUSD", "ETH/USD"]);

      expect(requestedPaths(spy)).toEqual([
        "/v1/canonical",
        "/v1/canonical/BTCUSD",
        "/v1/canonical/ETH%2FUSD", // encodeURIComponent — a symbol can never escape its path segment
      ]);
      expect(out.get("BTCUSD")?.status).toBe("ok");
      expect(out.get("ETH/USD")?.status).toBe("ok");
    },
  );

  it("a per-symbol 404 WITH a coded body is an unavailable entry: the code's meaning, else the error text, else http_404", async () => {
    mockCanonicalRoutes({
      batch: { status: 404, text: "" },
      single: (symbol) =>
        ({
          XAUTUSD: { status: 404, body: { code: 10009, error: "no canonical evaluation" } },
          FOOUSD: { status: 404, body: { code: 10001, error: "unknown symbol" } },
          BARUSD: { status: 404, body: { code: 10042, error: "weights unreadable" } },
          BAZUSD: { status: 404, body: { code: 10043 } },
          QUXUSD: { status: 404, body: { symbol: "QUXUSD" } },
        })[symbol],
    });

    const out = await read(["XAUTUSD", "FOOUSD", "BARUSD", "BAZUSD", "QUXUSD"]);

    expect(out.get("XAUTUSD")?.reason).toBe("no_canonical_evaluation");
    expect(out.get("FOOUSD")?.reason).toBe("unknown_symbol");
    expect(out.get("BARUSD")?.reason).toBe("weights unreadable");
    expect(out.get("BAZUSD")?.reason).toBe("http_404");
    expect(out.get("QUXUSD")?.reason).toBe("http_404");
    for (const q of out.values()) expect(q.status).toBe("unavailable");
  });

  it("a per-symbol ANONYMOUS 404 means neither route exists — throws naming both attempts", async () => {
    mockCanonicalRoutes({ batch: { status: 404, text: "Not Found" } });

    await expect(read(["BTCUSD"])).rejects.toThrow(
      /Canonical price routes unavailable: GET \/v1\/canonical → 404 Not Found; GET \/v1\/canonical\/BTCUSD → 404 Not Found/,
    );
  });

  it("a per-symbol body for a different symbol is invalid_symbol_mismatch; a defective one names the defect", async () => {
    mockCanonicalRoutes({
      batch: { status: 404, text: "" },
      single: singles({
        BTCUSD: rawCanonicalQuote("ETHUSD"),
        SOLUSD: rawCanonicalQuote("SOLUSD", { price: -1 }),
      }),
    });

    const out = await read(["BTCUSD", "SOLUSD"]);

    expect(out.get("BTCUSD")?.reason).toBe("invalid_symbol_mismatch");
    expect(out.get("SOLUSD")?.reason).toBe("invalid_non_positive_price");
  });

  it("fans out at most 8 per-symbol requests at a time", async () => {
    const tickers = Array.from({ length: 20 }, (_, i) => `T${String(i)}USD`);
    let inFlight = 0;
    let peak = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: unknown) => {
      const { pathname } = new URL(String(input));
      if (pathname.endsWith("/v1/canonical")) {
        return {
          ok: false,
          status: 404,
          text: async () => "Not Found",
          headers: new Headers(),
        } as unknown as Response;
      }
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight--;
      const symbol = decodeURIComponent(pathname.split("/").pop()!);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(rawCanonicalQuote(symbol)),
        headers: new Headers(),
      } as unknown as Response;
    });

    const out = await read(tickers);

    expect(out.size).toBe(20);
    expect([...out.values()].every((q) => q.status === "ok")).toBe(true);
    expect(peak).toBeLessThanOrEqual(8);
    expect(peak).toBeGreaterThan(1);
  });

  it("a per-symbol non-404 failure throws", async () => {
    mockCanonicalRoutes({
      batch: { status: 404, text: "" },
      single: () => ({ status: 400, text: "bad symbol" }),
    });
    await expect(read(["BTCUSD"])).rejects.toThrow(/Canonical price read failed: 400 bad symbol/);
  });
});

describe("readCanonicalPrices — more than CANONICAL_MAX_SYMBOLS_PER_REQUEST tickers are chunked", () => {
  /** A batch route that answers exactly the symbols its query names — what the server does. */
  const echoBatch = (opts: { failChunkWith?: string; missing?: boolean } = {}) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/v1/canonical")) {
        const symbols = url.searchParams.get("symbols")!.split(",");
        if (opts.missing) {
          return {
            ok: false,
            status: 404,
            text: async () => "Not Found",
            headers: new Headers(),
          } as unknown as Response;
        }
        if (opts.failChunkWith !== undefined && symbols.includes(opts.failChunkWith)) {
          return {
            ok: false,
            status: 400,
            text: async () => '{"code":10003,"error":"too many symbols"}',
            headers: new Headers(),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ items: symbols.map((s) => rawCanonicalQuote(s)) }),
          headers: new Headers(),
        } as unknown as Response;
      }
      const symbol = decodeURIComponent(url.pathname.split("/").pop()!);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(rawCanonicalQuote(symbol)),
        headers: new Headers(),
      } as unknown as Response;
    });
  const MANY = Array.from(
    { length: CANONICAL_MAX_SYMBOLS_PER_REQUEST + 1 },
    (_, i) => `T${String(i).padStart(2, "0")}USD`,
  );
  const batchSymbols = (spy: ReturnType<typeof vi.spyOn>) =>
    spy.mock.calls
      .map((call) => new URL(String(call[0])))
      .filter((u) => u.pathname.endsWith("/v1/canonical"))
      .map((u) => u.searchParams.get("symbols")!.split(","));

  it("the server's cap is 32 symbols per request", () => {
    expect(CANONICAL_MAX_SYMBOLS_PER_REQUEST).toBe(32);
  });

  it("33 tickers → TWO batch requests of ≤32, merged into one map with every ticker a key", async () => {
    const spy = echoBatch();

    const out = await read(MANY);

    const chunks = batchSymbols(spy);
    expect(chunks.map((c) => c.length)).toEqual([32, 1]);
    expect(chunks.flat()).toEqual(MANY);
    expect([...out.keys()]).toEqual(MANY);
    expect([...out.values()].every((q) => q.status === "ok")).toBe(true);
  });

  it("duplicates are collapsed before chunking (32 distinct + repeats is ONE request) and still map to the one quote", async () => {
    const spy = echoBatch();
    const distinct = MANY.slice(0, 32);

    const out = await read([...distinct, distinct[0]!, distinct[5]!]);

    expect(batchSymbols(spy)).toEqual([distinct]);
    expect(out.size).toBe(32);
    expect(out.get(distinct[0]!)?.status).toBe("ok");
  });

  it("one failing chunk fails the whole read — no half-populated map", async () => {
    echoBatch({ failChunkWith: MANY[32]! });
    await expect(read(MANY)).rejects.toThrow(/Canonical price read failed: 400/);
  });

  it("concurrent chunks SHARE the fallback's bound: still at most 8 per-symbol requests in flight", async () => {
    const tickers = Array.from({ length: 70 }, (_, i) => `T${String(i)}USD`);
    let inFlight = 0;
    let peak = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: unknown) => {
      const { pathname } = new URL(String(input));
      if (pathname.endsWith("/v1/canonical")) {
        return {
          ok: false,
          status: 404,
          text: async () => "Not Found",
          headers: new Headers(),
        } as unknown as Response;
      }
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight--;
      const symbol = decodeURIComponent(pathname.split("/").pop()!);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(rawCanonicalQuote(symbol)),
        headers: new Headers(),
      } as unknown as Response;
    });

    const out = await read(tickers);

    expect(out.size).toBe(70);
    expect(peak).toBeLessThanOrEqual(8);
  });

  it("the per-symbol fallback still works per chunk when the batch route is absent", async () => {
    const spy = echoBatch({ missing: true });

    const out = await read(MANY);

    expect(out.size).toBe(MANY.length);
    expect([...out.values()].every((q) => q.status === "ok")).toBe(true);
    const singles = spy.mock.calls.filter(
      (call) => !new URL(String(call[0])).pathname.endsWith("/v1/canonical"),
    );
    expect(singles).toHaveLength(MANY.length);
  });
});

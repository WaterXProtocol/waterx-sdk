/**
 * THE WaterX quote-center wire fixtures + route-aware fetch mock, shared by
 * every suite that exercises the source (`waterx-rule`, `waterx-seams`,
 * `oracle-read-prices`, `tx-builders`).
 *
 * One copy on purpose: these bodies pin the SERVICE's exact wire shape, so a
 * per-suite copy is how the shapes silently diverge — the leaf builder below
 * carries the `0.0` float tokens that a `JSON.stringify` fixture physically
 * cannot produce (see {@link rawLeavesText}), and a suite that hand-rolled its
 * own would quietly stop covering that regression.
 */
import { vi } from "vitest";

/** Arbitrary 64-byte ed25519 signature (hex), standing in for a real one. */
export const SIG_HEX = "ab".repeat(64);
/** A 32-byte keccak256 hash (hex) — the only shape a proof element may take. */
export const HASH_HEX = "cd".repeat(32);

/**
 * The price fields shared by both wire shapes (u64s as plain JSON numbers, as
 * the quote-center emits them). `overrides` lets a case pin one field — e.g.
 * `{ confidence_scale: 0 }` for the zero-divisor decode guard — without
 * hand-rolling a rival body.
 */
export function rawItem(
  symbol: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    symbol,
    ticker: `${symbol}T`,
    sources: [2, 3, 4],
    method: "median",
    price_timestamp_ms: 1_784_799_999_000,
    price_n: 63_700_000_000_000,
    price_scale: 1_000_000_000,
    confidence_n: 10_000_000_000,
    confidence_scale: 1_000_000_000,
    max_source_deviation_bps: 0,
    num_sources: 3,
    ...overrides,
  };
}

/**
 * Server-shape `/v1/quotes/update` body. `overridesBySymbol` reaches a single
 * item's fields (see {@link rawItem}).
 */
export function rawEnvelope(
  symbols: string[] = ["BTCUSD"],
  overridesBySymbol: Record<string, Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    intent: 1,
    timestamp_ms: 1_784_800_000_000,
    payload: { items: symbols.map((s) => rawItem(s, overridesBySymbol[s] ?? {})) },
    signature: SIG_HEX,
  };
}

/** Server-shape `/v1/quotes/update` body as raw text (exact numeric tokens preserved). */
export function rawEnvelopeText(
  symbols: string[] = ["BTCUSD"],
  overridesBySymbol: Record<string, Record<string, unknown>> = {},
): string {
  return JSON.stringify(rawEnvelope(symbols, overridesBySymbol));
}

/**
 * Server-shape `/v1/quotes/leaves` body as RAW TEXT — deliberately not an object
 * run through `JSON.stringify`.
 *
 * The display-only `price` / `confidence` are Rust `f64`s, and serde emits a
 * whole-numbered one as `0.0`. `JSON.stringify({ confidence: 0.0 })` emits `0`,
 * so an OBJECT fixture cannot produce that token at all — which is precisely how
 * a `BigInt("0.0")` crash in the reviver reached a deployed endpoint with a green
 * test suite. Every leaf test runs against text the service could actually
 * have sent, including the `0.0` and exponent forms.
 */
export function rawLeavesText(
  symbols: string[] = ["BTCUSD"],
  proof: string[] = [HASH_HEX],
): string {
  const proofJson = JSON.stringify(proof);
  const leaves = symbols.map(
    (symbol) => `{
      "symbol": "${symbol}", "ticker": "${symbol}T",
      "price": 63700.0, "confidence": 0.0,
      "price_n": 63700000000000, "price_scale": 1000000000,
      "confidence_n": 10000000000, "confidence_scale": 1000000000,
      "sources": [2, 3, 4], "method": "median",
      "num_sources": 3, "max_source_deviation_bps": 0,
      "price_timestamp_ms": 1784799999000,
      "signed_timestamp_ms": 1784800000000,
      "root": "${HASH_HEX}", "proof": ${proofJson},
      "signature": "${SIG_HEX}",
      "enclave_pubkey": "${"cd".repeat(32)}", "enclave_version": 1
    }`,
  );
  return `{"leaves":[${leaves.join(",")}]}`;
}

/** The same body as a mutable object, for tests that tamper with a field. */
export function rawLeaves(
  symbols: string[] = ["BTCUSD"],
  proof: string[] = [HASH_HEX],
): Record<string, unknown> {
  return JSON.parse(rawLeavesText(symbols, proof)) as Record<string, unknown>;
}

export interface MockRoute {
  status?: number;
  /** Object body — stringified. Use `text` when the exact token matters. */
  body?: unknown;
  /** Verbatim response text (wire-faithful float tokens, malformed JSON, …). */
  text?: string;
}

/**
 * Route-aware quote-center mock: `/v1/quotes/leaves` and `/v1/quotes/update` get
 * their own response, and an unconfigured route 404s the way a quote-center
 * that never had it would. A single blanket mock cannot express the central
 * case — the rule tries the leaf route FIRST and only falls back on a 404 — so
 * every fetch is routed by pathname.
 */
export function mockQuoteCenter(routes: {
  leaves?: MockRoute;
  update?: MockRoute;
}): ReturnType<typeof vi.spyOn> {
  const respond = (route: MockRoute | undefined): Response => {
    const status = route?.status ?? (route ? 200 : 404);
    const text =
      route?.text ?? (route?.body === undefined ? "Not Found" : JSON.stringify(route.body));
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as unknown as Response;
  };
  return vi.spyOn(globalThis, "fetch").mockImplementation((input: unknown) => {
    const { pathname } = new URL(String(input));
    if (pathname.endsWith("/v1/quotes/leaves")) return Promise.resolve(respond(routes.leaves));
    if (pathname.endsWith("/v1/quotes/update")) return Promise.resolve(respond(routes.update));
    return Promise.resolve(respond(undefined));
  }) as ReturnType<typeof vi.spyOn>;
}

/** Pathnames a routed mock actually received, in order. */
export function requestedPaths(spy: ReturnType<typeof vi.spyOn>): string[] {
  return spy.mock.calls.map((call) => new URL(String(call[0])).pathname);
}

/** The happy default: the quote-center serves leaves, as wire-faithful text. */
export function mockLeafRoute(symbols: string[] = ["BTCUSD"]): ReturnType<typeof vi.spyOn> {
  return mockQuoteCenter({ leaves: { text: rawLeavesText(symbols) } });
}

/** An older quote-center: no leaf route, envelope only. */
export function mockEnvelopeOnly(
  symbols: string[] = ["BTCUSD"],
  envelope: Record<string, unknown> = rawEnvelope(symbols),
): ReturnType<typeof vi.spyOn> {
  return mockQuoteCenter({ leaves: { status: 404 }, update: { body: envelope } });
}

/**
 * Leaf route that ECHOES whatever `?symbols=` asked for — for builder tests
 * whose refresh derives its own ticker set (market + collateral + pool
 * tokens), so the mock cannot know the list up front.
 */
export function mockLeafRouteEchoingSymbols(): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input: unknown) => {
    const url = new URL(String(input));
    if (!url.pathname.endsWith("/v1/quotes/leaves")) {
      return Promise.resolve({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      } as Response);
    }
    const symbols = (url.searchParams.get("symbols") ?? "").split(",").filter(Boolean);
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => rawLeavesText(symbols),
    } as unknown as Response);
  }) as ReturnType<typeof vi.spyOn>;
}

/**
 * One stubbed `Response` for a plain (non-routed) fetch — the shared shape the
 * Lazer / Pyth Pro read suites assert against.
 */
export function mockFetchResponse(response: {
  status?: number;
  json?: unknown;
  text?: string;
}): ReturnType<typeof vi.spyOn> {
  const status = response.status ?? 200;
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response.json,
    text: async () => response.text ?? JSON.stringify(response.json ?? ""),
  } as unknown as Response);
}

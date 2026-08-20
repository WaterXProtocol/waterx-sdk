/**
 * Minimal `/v1/quotes/leaves` quote-center stub for tests that only need
 * `refreshOraclePrices` to produce a waterx leg — the composer tests in
 * `tx-builders.test.ts`, not the wire-format suite.
 *
 * `waterx-rule.test.ts` keeps its own richer, route-aware fixtures: that suite
 * asserts parsing and abort semantics against wire-faithful RAW TEXT (the
 * `0.0` float token a `JSON.stringify` fixture cannot emit). Anything testing
 * the wire shape belongs there, not here.
 */

/** Arbitrary 64-byte ed25519 signature (hex), standing in for a real one. */
const SIG_HEX = "ab".repeat(64);
/** A 32-byte keccak256 hash (hex) — the only shape a proof element may take. */
const HASH_HEX = "cd".repeat(32);

/** Server-shape `/v1/quotes/leaves` body covering exactly `symbols`. */
export function quoteCenterLeavesBody(symbols: string[]): string {
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
      "root": "${HASH_HEX}", "proof": ["${HASH_HEX}"],
      "signature": "${SIG_HEX}",
      "enclave_pubkey": "${"cd".repeat(32)}", "enclave_version": 1
    }`,
  );
  return `{"leaves":[${leaves.join(",")}]}`;
}

/**
 * Install a `globalThis.fetch` stub that answers the leaves route for
 * `symbols` — the rule rejects a response that doesn't cover every requested
 * ticker, so pass every ticker the build will ask for. Returns the spy.
 */
export function mockQuoteCenterLeaves(symbols: string[]): ReturnType<typeof makeFetch> {
  const fetchImpl = makeFetch(symbols);
  globalThis.fetch = fetchImpl as unknown as typeof fetch;
  return fetchImpl;
}

function makeFetch(symbols: string[]) {
  return async (): Promise<Response> =>
    new Response(quoteCenterLeavesBody(symbols), { status: 200 });
}

/**
 * `JSON.parse` with access to each number's SOURCE TOKEN — the one mechanism
 * behind every "u64 must survive exactly" decode in the SDK (the signed
 * quote-center payloads, where a lost digit is an on-chain signature abort;
 * the canonical `*_scaled` strings). A plain `JSON.parse` yields IEEE-754
 * doubles that lose precision above 2^53; the ES2023 reviver `context.source`
 * (Node ≥ 21 / modern browsers) hands back the literal, so a caller can keep
 * it as a `bigint` or a string.
 *
 * Integrality is decided from the TOKEN, never from the parsed value: a
 * display float can be lexically `0.0` while `JSON.parse` hands back the
 * number `0`, which `Number.isInteger` accepts — and `BigInt("0.0")` throws
 * `SyntaxError`. The quote-center really does emit that (Rust `f64` serialises
 * a whole number as `0.0`), so keying off the value crashed every leaf fetch
 * that included a `confidence: 0.0`. Test the token against
 * {@link INTEGER_TOKEN}; exponent tokens (`1e3`) are not integers either.
 */

/** A JSON number token that is lexically an integer: no `.`, no `e`/`E`. */
export const INTEGER_TOKEN = /^-?\d+$/;

/**
 * Parse `text`, calling `revive` for every NUMBER with its source token (or
 * `undefined` on a runtime without reviver source access) and the key it sits
 * under. Non-number values pass through untouched.
 */
export function parseJsonWithNumberSource(
  text: string,
  revive: (value: number, source: string | undefined, key: string) => unknown,
): unknown {
  return JSON.parse(text, (key: string, value: unknown, context?: { source?: string }): unknown =>
    typeof value === "number" ? revive(value, context?.source, key) : value,
  );
}

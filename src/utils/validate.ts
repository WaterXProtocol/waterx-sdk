// Integer-domain guards for on-chain numeric params (internal, not on the
// barrel). The generated BCS layer coerces `number` params only after JS
// arithmetic has already lost precision — a non-safe integer (>= 2^53),
// fractional, or negative value would serialize a silently-wrong integer into
// the PTB instead of failing (verified: `bcs.u64().serialize(2**53 + 2)`
// encodes the wrong value without throwing). Every u64/u128 param on the
// fetch AND write (tx-build) surfaces funnels through these so garbage throws
// with the parameter's name before a transaction is built.

export const U64_MAX = 18_446_744_073_709_551_615n; // 2^64 − 1
const U128_MAX = 340_282_366_920_938_463_463_374_607_431_768_211_455n; // 2^128 − 1

function toUint(value: bigint | number, label: string, max: bigint, width: string): bigint {
  let v: bigint;
  if (typeof value === "bigint") {
    v = value;
  } else {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(
        `${label} must be a non-negative safe integer (< 2^53) or a bigint, got ${value}`,
      );
    }
    v = BigInt(value);
  }
  if (v < 0n || v > max) {
    throw new RangeError(`${label} out of ${width} range, got ${v}`);
  }

  return v;
}

/** Validate a u64 param (bigint passthrough with range check; number must be a safe integer >= 0). */
export function toU64(value: bigint | number, label: string): bigint {
  return toUint(value, label, U64_MAX, "u64");
}

/** Validate a u128 param (bigint passthrough with range check; number must be a safe integer >= 0). */
export function toU128(value: bigint | number, label: string): bigint {
  return toUint(value, label, U128_MAX, "u128");
}

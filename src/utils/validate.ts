// Numeric-domain guards (internal, NOT on the public barrel). One place for the
// question "is this value inside the domain the callee can honestly compute
// over?", asked at the two points where garbage enters:
//
// 1. INTEGER params (`toU64` / `toU128` + the `*OrNull` / `*Arg` variants) on
//    the fetch AND write (tx-build) surfaces. The generated BCS layer coerces
//    `number` params only after JS arithmetic has already lost precision — a
//    non-safe integer (>= 2^53), fractional, or negative value would serialize
//    a silently-wrong integer into the PTB instead of failing (verified:
//    `bcs.u64().serialize(2**53 + 2)` encodes the wrong value without
//    throwing). Every u64/u128 param funnels through these so garbage throws
//    with the parameter's name before a transaction is built.
// 2. FLOAT / BIGINT domains (`assertFinite` / `assertFiniteNonNegative` /
//    `assertUnsignedBigInt`) for the money-path math in `utils/math.ts`.
//
// The second family lives HERE rather than privately inside `math.ts` so the
// whole numeric-domain vocabulary is discoverable in one file: hiding it is why
// `parseWholeDollarU64` once re-derived `toU64`'s entire chain (finite →
// integer → safe integer → non-negative → <= u64::MAX) by hand.
//
// Everything throws `RangeError` naming the offending parameter.

import type { TransactionArgument } from "@mysten/sui/transactions";

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

/** `Option<u64>` param: `null` / `undefined` pass through as `null`, anything else is validated. */
export function toU64OrNull(
  value: bigint | number | null | undefined,
  label: string,
): bigint | null {
  return value == null ? null : toU64(value, label);
}

/** `Option<u128>` param: `null` / `undefined` pass through as `null`, anything else is validated. */
export function toU128OrNull(
  value: bigint | number | null | undefined,
  label: string,
): bigint | null {
  return value == null ? null : toU128(value, label);
}

/**
 * u64 param that may instead be a PTB result chained from an earlier command
 * (e.g. the `lp_amount` returned by `mintWlp`). A `TransactionArgument` passes
 * through untouched — its value only exists on chain, where Move types it.
 */
export function toU64Arg(
  value: bigint | number | TransactionArgument,
  label: string,
): bigint | TransactionArgument {
  return typeof value === "bigint" || typeof value === "number" ? toU64(value, label) : value;
}

/** u128 half of `toU64Arg` — same passthrough rule, u128 range. */
export function toU128Arg(
  value: bigint | number | TransactionArgument,
  label: string,
): bigint | TransactionArgument {
  return typeof value === "bigint" || typeof value === "number" ? toU128(value, label) : value;
}

/** Reject NaN / ±Infinity for a `number` money-path input. */
export function assertFinite(label: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number, got ${value}`);
  }
}

/** Reject NaN / ±Infinity / negative for a `number` money-path input. */
export function assertFiniteNonNegative(label: string, value: number): void {
  assertFinite(label, value);
  if (value < 0) {
    throw new RangeError(`${label} must be >= 0, got ${value}`);
  }
}

/** Reject a negative `bigint` where the on-chain type is unsigned. */
export function assertUnsignedBigInt(label: string, value: bigint): void {
  if (value < 0n) {
    throw new RangeError(`${label} must be >= 0, got ${value}`);
  }
}

// Numeric-domain guards. One place for the question "is this value inside the
// domain the callee can honestly compute over?", asked at the three points
// where garbage enters:
//
// 1. INTEGER params (`toU64` / `toU128` / `toU8` / `toU16` + the `*OrNull` /
//    `toU64Arg` variants) on the fetch AND write (tx-build) surfaces. What the
//    generated BCS layer does with a bad `number` depends on the width, and at
//    no width is the answer "throw naming the parameter" (verified against
//    `@mysten/sui`'s `bcs`):
//    - u64 / u128 throw on negative and on fractional — but a `number` past
//      2^53 has already lost precision in JS BEFORE BCS sees it. `2**53 + 1`
//      collapses to `2**53` at parse time, so BCS faithfully encodes a value
//      the caller never wrote. (`2**53 + 2` IS exactly representable and
//      encodes correctly — the hazard is the odd side of the f64 cliff, not
//      BCS.) Hence the `Number.isSafeInteger` floor here.
//    - u8 / u16 throw when the value is out of range but SILENTLY TRUNCATE a
//      fractional one (`bcs.u8().serialize(2.7)` encodes `2`), so the
//      fractional case is the one only a guard can catch.
//    Every integer param funnels through these so garbage throws with the
//    parameter's name before a transaction is built.
// 2. FLOAT / BIGINT domains (`assertFinite` / `assertFiniteNonNegative` /
//    `assertUnitFraction` / `assertTokenDecimal` / `assertUnsignedBigInt`) for
//    the money-path math in `utils/math.ts`.
// 3. The WHOLE-DOLLAR USD price domain (`WholeDollarUsdPrice` /
//    `parseWholeDollarU64`) the `waterx_perp_view` read params live in.
//
// Families 2 and 3 live HERE rather than privately inside `math.ts` /
// `perp/fetch/positions.ts` so the whole numeric-domain vocabulary is
// discoverable in one file: hiding it is why `parseWholeDollarU64` once
// re-derived `toU64`'s entire chain (finite → integer → safe integer →
// non-negative → <= u64::MAX) by hand.
//
// Everything throws `RangeError` naming the offending parameter.
//
// Visibility: this module is internal EXCEPT for the whole-dollar pair, which
// is public and re-exported from `perp/fetch/positions.ts` (→ the `perp/fetch`
// barrel → `@waterx/sdk`) — that is the published import path, not this file.

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

function toSmallUint(value: number, label: string, max: number, width: string): number {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${label} must be an integer in [0, ${max}] (${width}), got ${value}`);
  }

  return value;
}

/**
 * Validate a u8 param. Returns a `number` (not a bigint) because that is the
 * shape the generated BCS layer takes at this width.
 *
 * Separate from `toU64` on purpose: at u8/u16 the BCS writer already throws on
 * an out-of-range value, but SILENTLY TRUNCATES a fractional one — so the
 * fractional case is what this guard exists to catch (see the header note).
 */
export function toU8(value: number, label: string): number {
  return toSmallUint(value, label, 0xff, "u8");
}

/** Validate a u16 param. Same width caveat as {@link toU8}. */
export function toU16(value: number, label: string): number {
  return toSmallUint(value, label, 0xffff, "u16");
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

// NOTE: there is deliberately no `toU128Arg`. No write builder exposes a u128
// param that can take a chained `TransactionArgument` (every u128 site — size /
// trigger price / acceptable price — is a caller-supplied literal), so a u128
// half of `toU64Arg` would be an export with no consumer. Add it back the day a
// builder actually chains a u128 PTB result.

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

/**
 * Reject anything outside `[0, 1]` for a `number` input that is a FRACTION of a
 * whole — a maintenance-margin rate above 1 means "maintenance exceeds the
 * entire notional", which is not a rate the caller can have meant.
 */
export function assertUnitFraction(label: string, value: number): void {
  assertFinite(label, value);
  if (value < 0 || value > 1) {
    throw new RangeError(`${label} must be within [0, 1], got ${value}`);
  }
}

/**
 * Reject a token-decimal outside `[0, 19]` — the domain of the contract's
 * `10u64.pow(decimal)` (`10^19 < 2^64 <= 10^20`), and the same bound the raw
 * `POW10` table in `utils/math.ts` is built over.
 */
export function assertTokenDecimal(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 19) {
    throw new RangeError(`${label} must be an integer in [0, 19], got ${value}`);
  }
}

/** Reject a negative `bigint` where the on-chain type is unsigned. */
export function assertUnsignedBigInt(label: string, value: bigint): void {
  if (value < 0n) {
    throw new RangeError(`${label} must be >= 0, got ${value}`);
  }
}

// ======== Whole-dollar USD price domain ========
// The one numeric domain here that is PUBLIC (see the visibility note at the
// top): `perp/fetch/positions.ts` re-exports both symbols, and that is the
// published import path.

/**
 * WHOLE-DOLLAR integer USD price for the `waterx_perp_view` read params
 * (`80000n` for BTC at $80k). The Move view applies `float::from(...)`
 * internally — do NOT pass a 1e9-scaled `rawPrice()` value or every
 * pnl/notional-derived field inflates by 1e9 (`rawPrice()` is for tx-build
 * args only; the u128 order-book `triggerPrice` key on `getOrder` is the one
 * view param that still takes that scale). Sub-$1 prices cannot be
 * represented (u64 whole dollars). The price only bases the
 * pnl / close-fee / notional-derived fields — `0n` zero-bases them (still
 * computed with price 0, not skipped).
 */
export type WholeDollarUsdPrice = bigint | number;

const PLAIN_INT_RE = /^-?\d+$/;

/**
 * Parse a user/env-supplied value into a whole-dollar u64 price
 * (`WholeDollarUsdPrice`) with NO silent rounding: throws `RangeError` on
 * fractional, negative, non-finite, non-numeric, or `> u64::MAX` input. If
 * rounding is ever wanted it must be explicit at the call site
 * (e.g. `parseWholeDollarU64(Math.round(x))`) — never baked in here.
 *
 * The numeric domain (finite → safe integer → non-negative → `<= u64::MAX`) is
 * `toU64`'s and is NOT restated here; this function only adds the string form,
 * whose digits parse exactly past the 2^53 f64 cliff.
 */
export function parseWholeDollarU64(value: string | number): bigint {
  const label = "whole-dollar USD price";
  if (typeof value !== "string") return toU64(value, label);

  const trimmed = value.trim();
  if (!PLAIN_INT_RE.test(trimmed)) {
    throw new RangeError(`${label} must be a plain integer string, got "${value}"`);
  }

  return toU64(BigInt(trimmed), label);
}

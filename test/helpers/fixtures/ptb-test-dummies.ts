/**
 * Shared dummy addresses and Bucket `float::from_scaled_val` stubs for **unit** PTB tests.
 * Not real `PriceResult` / oracle wiring — only correct transaction graph shape.
 */

import type { Transaction } from "@mysten/sui/transactions";

import { mockSuiAddress } from "./sui-mock-fixtures.ts";
import { MOCK_TESTNET_CONFIG } from "./mock-testnet-config.ts";

const BUCKET_FRAMEWORK_PKG = MOCK_TESTNET_CONFIG.packages.bucket_framework.published_at;

// ---- Distinct 32-byte hex IDs (repeat-byte pattern via mockSuiAddress) ----

const PTB_ADDR_AA = mockSuiAddress("aa");

/**
 * Recipient / owner-style address in WLP tests.
 * Same bytes as {@link PTB_DUMMY_ACCOUNT_ID} (common PTB test pattern).
 */
export const PTB_DUMMY_RECIPIENT = PTB_ADDR_AA;

/** Dummy UserAccount object id / liquidate `recipient` for trading & order PTB tests. */
export const PTB_DUMMY_ACCOUNT_ID = PTB_ADDR_AA;

/** Deposit coin object id (e.g. USDC for `mintWlp`); also usable as any dummy `0xbb…` object id. */
export const PTB_DUMMY_DEPOSIT_COIN = mockSuiAddress("bb");

/**
 * Dummy id with repeated `cc` bytes (distinct from {@link PTB_DUMMY_ACCOUNT_ID}, the `aa` pattern).
 * Shared by coin strings and “second” UserAccount-style ids in unit tests.
 */
export const PTB_DUMMY_ID_CC = mockSuiAddress("cc");

/** Generic coin object id — same bytes as {@link PTB_DUMMY_ID_CC}. */
export const PTB_DUMMY_COIN_CC = PTB_DUMMY_ID_CC;

/** Arbitrary dummy object id (`dd`…): `tx.object`, LP slot, etc. */
export const PTB_DUMMY_OBJECT_DD = mockSuiAddress("dd");

/** LP coin object id (string form in `requestRedeemWlp` tests). Same as {@link PTB_DUMMY_OBJECT_DD}. */
export const PTB_DUMMY_LP_COIN_DD = PTB_DUMMY_OBJECT_DD;

/** Second LP coin id for `requestRedeemWlp` + `tx.object` variant. */
export const PTB_DUMMY_LP_COIN_EE = mockSuiAddress("ee");

const DEFAULT_FLOAT_SCALED = 1_000_000_000n;

/** Single `float::from_scaled_val` result — use where a `PriceResult`-shaped argument is required. */
export function dummyBucketFloatPriceResult(
  tx: Transaction,
  scaledVal: bigint = DEFAULT_FLOAT_SCALED,
) {
  const [a] = tx.moveCall({
    target: `${BUCKET_FRAMEWORK_PKG}::float::from_scaled_val`,
    arguments: [tx.pure.u128(scaledVal)],
  });
  return a!;
}

/** Two `float::from_scaled_val` arms — base vs collateral `PriceResult` stubs (default 1n / 2n). */
export function dummyBucketFloatPricePair(
  tx: Transaction,
  baseScaled: bigint = 1n,
  collateralScaled: bigint = 2n,
) {
  return {
    base: dummyBucketFloatPriceResult(tx, baseScaled),
    collateral: dummyBucketFloatPriceResult(tx, collateralScaled),
  };
}

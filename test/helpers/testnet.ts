/**
 * Shared testnet client + constants for read-only / simulate tests (no admin keystore).
 *
 * Uses full testnet config (**Pyth + Supra**) so `buildOracleFeed` / tx-builders match on-chain
 * `PriceAggregator` expectations (every weighted rule is fed).
 */
import { TESTNET_OBJECTS, TESTNET_TYPES, WaterXClient } from "@waterx/perp-sdk";

export const client = WaterXClient.testnet();

/** @alias client */
export const clientTxBuildersSimulate = client;

export { TESTNET_OBJECTS, TESTNET_TYPES };

/** Convert a human-readable USD price to 1e9-scaled bigint for test convenience. */
export function rawPrice(usd: number): bigint {
  return BigInt(Math.round(usd * 1e9));
}

/** Well-formed Sui address for `tx.setSender()` in dry-runs / PTB experiments (not a real custodial key). */
export const DUMMY_SENDER = "0x1111111111111111111111111111111111111111111111111111111111111111";

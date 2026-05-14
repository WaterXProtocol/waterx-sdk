// ======== Network ========
export type Network = "MAINNET" | "TESTNET";

// ======== Permission Bitmasks (matches account_data.move) ========
export const PERM_OPEN_POSITION = 1;
export const PERM_CLOSE_POSITION = 2;
export const PERM_INCREASE_POSITION = 4;
export const PERM_DECREASE_POSITION = 8;
export const PERM_PLACE_ORDER = 16;
export const PERM_CANCEL_ORDER = 32;
export const PERM_DEPOSIT_COLLATERAL = 64;
export const PERM_WITHDRAW_COLLATERAL = 128;
export const PERM_MINT_WLP = 256;
export const PERM_REDEEM_WLP = 512;
export const PERM_ALL_TRADING = 0xff;
export const PERM_ALL = 0xffff;

// ======== Order Type Tags ========
export const ORDER_LIMIT_BUY = 0;
export const ORDER_LIMIT_SELL = 1;
export const ORDER_STOP_BUY = 2;
export const ORDER_STOP_SELL = 3;
/** Wildcard tag accepted by `cancel_order_request` — scans all 4 books. */
export const ORDER_TAG_WILDCARD = 255;

// ======== Action Type Constants (request.move) ========
export const ACTION_OPEN_POSITION = 0;
export const ACTION_CLOSE_POSITION = 1;
export const ACTION_PLACE_ORDER = 2;
export const ACTION_CANCEL_ORDER = 3;
export const ACTION_DEPOSIT_COLLATERAL = 4;
export const ACTION_WITHDRAW_COLLATERAL = 5;
export const ACTION_LIQUIDATE = 6;
export const ACTION_INCREASE_POSITION = 7;
export const ACTION_DECREASE_POSITION = 8;
export const ACTION_UPDATE_ORDER = 9;
export const ACTION_CANCEL_PRE_ORDER = 10;
export const ACTION_ADD_PRE_ORDER = 11;

// ======== Misc ========
/** Zero address — used as a placeholder sender in simulateTransaction. */
export const SENDER = "0x0000000000000000000000000000000000000000000000000000000000000000";

/** Sui Clock shared object. */
export const CLOCK = "0x6";

/** Float scaling factor (1e9). All `Float` values from `bucket_v2_framework` are 1e9-scaled. */
export const FLOAT_SCALE = 1_000_000_000n;

/**
 * Convert a human-readable USD price to the raw 1e9-scaled `u128` value
 * that on-chain `Float`-typed parameters expect.
 */
export function rawPrice(usd: number | string): bigint {
  const n = typeof usd === "string" ? Number(usd) : usd;
  if (!Number.isFinite(n)) throw new Error(`Invalid USD price: ${usd}`);
  return BigInt(Math.round(n * Number(FLOAT_SCALE)));
}

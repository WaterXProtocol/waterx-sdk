// Perp-line domain constants (trading permissions / order tags / action codes /
// fee rates / well-known addresses). Re-exports the shared primitives from
// `../constants.ts` so perp code and the `./perp` barrel get the full set from
// a single import.

export * from "../constants.ts";

// ======== Fee rates & risk parameters ========
/** Default crypto market trading fee rate (3 bps). Per-market value lives in MarketConfig. */
export const CRYPTO_FEE_RATE = 0.0003;
/** Default stock / commodity market trading fee rate (5 bps). Per-market value lives in MarketConfig. */
export const STOCK_FEE_RATE = 0.0005;
/** Default maintenance margin rate (150 bps = 1.5%). Per-market value lives in MarketConfig. */
export const MAINTENANCE_MARGIN_RATE = 0.015;

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

// ======== Staking Permission Bitmasks (matches waterx_staking.move) ========
export const STAKING_PERM_DEPOSIT_STAKE = 1 << 0;
export const STAKING_PERM_REDEEM_STAKE = 1 << 1;
export const STAKING_PERM_CLAIM_REWARD = 1 << 2;
export const STAKING_PERM_ALL =
  STAKING_PERM_DEPOSIT_STAKE | STAKING_PERM_REDEEM_STAKE | STAKING_PERM_CLAIM_REWARD;

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
/** Zero-address placeholder used as the sender in dry-run / simulate calls. */
export const DRY_RUN_SENDER = "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Well-known address of Sui's native funds-accumulator root shared object
 * (`@0xacc` in the framework). Pass this to `request_deposit_from_funds<T>`
 * to drain `Balance<T>` parked at an account's address. Defined in
 * `account/constants.ts` (account-framework constant); re-exported here for
 * back-compat.
 */
export { ACCUMULATOR_ROOT } from "../account/constants.ts";

// ======== Network ========
export type Network = "MAINNET" | "TESTNET";

// ======== Scaling ========
/** Basis-point denominator (10_000). Matches BP_SCALE in the Move contracts. */
export const BPS_SCALE = 10_000n;

/** Float scaling factor (1e9). All `Float` values from `bucket_v2_framework` are 1e9-scaled. */
export const FLOAT_SCALE = 1_000_000_000n;

/** Double scaling factor (1e18). Used for high-precision intermediate values (e.g. u256 fields). */
export const DOUBLE_SCALE = 1_000_000_000_000_000_000n;

// ======== Token decimals ========
/** SUI coin decimals (gas + staking rewards). */
export const SUI_DECIMALS = 9;
/** WLP LP-token decimals. */
export const WLP_DECIMALS = 6;
/** Shared decimals for trading collateral / WLP backing assets (USDC, USDSUI). */
export const COLLATERAL_DECIMALS = 6;

/**
 * @deprecated Import the individual `SUI_DECIMALS` / `WLP_DECIMALS` /
 * `COLLATERAL_DECIMALS` constants instead. Kept as a back-compat shim so
 * downstream code that still does `import { TOKEN_DECIMALS }` keeps working;
 * removed in a future major.
 */
export const TOKEN_DECIMALS = {
  SUI: SUI_DECIMALS,
  USDC: COLLATERAL_DECIMALS,
  USDSUI: COLLATERAL_DECIMALS,
  WLP: WLP_DECIMALS,
} as const satisfies Record<string, number>;

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

// ======== Time ========
export const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

// ======== Misc ========
/** Zero-address placeholder used as the sender in dry-run / simulate calls. */
export const DRY_RUN_SENDER = "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Well-known address of Sui's native funds-accumulator root shared object
 * (`@0xacc` in the framework). Pass this to `request_deposit_from_funds<T>`
 * to drain `Balance<T>` parked at an account's address.
 */
export const ACCUMULATOR_ROOT = "0xacc";

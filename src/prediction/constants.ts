export type Network = "MAINNET" | "TESTNET";

export const CLOCK_OBJECT_ID = "0x6";

export const PREDICTION_PERM_PLACE_ORDER = 1 << 0;
export const PREDICTION_PERM_CANCEL_ORDER = 1 << 1;
export const PREDICTION_PERM_CLAIM = 1 << 2;
export const PREDICTION_PERM_REQUEST_CLOSE = 1 << 3;

/** Default chunk size for `buildBatchForceClaimTransactions` (1 request + N claims; Sui max ~1024 commands). */
export const DEFAULT_FORCE_CLAIM_CHUNK_SIZE = 1000;
export const PREDICTION_PERM_ALL =
  PREDICTION_PERM_PLACE_ORDER |
  PREDICTION_PERM_CANCEL_ORDER |
  PREDICTION_PERM_CLAIM |
  PREDICTION_PERM_REQUEST_CLOSE;

export const ACCOUNT_PERM_WITHDRAW = 1 << 0;
export const ACCOUNT_PERM_MANAGE_DELEGATES = 1 << 1;
export const ACCOUNT_PERM_RECEIVE = 1 << 2;
export const ACCOUNT_PERM_ALL = 0xffffffff;

export const PREDICTION_ERROR_CODES = {
  EBadStatus: 1,
  EMarketNotResolved: 3,
  EAlreadyResolved: 4,
  EBadPriceCap: 5,
  EFillExceedsMax: 6,
  EFillBelowMin: 7,
  EBadExpiry: 8,
  EBadPayment: 9,
  EMarketPaused: 10,
  EBelowMinReserve: 11,
  EMarketAlreadyResolved: 12,
  ECloseProceedsBelowMin: 13,
  EUnauthorized: 14,
  ENotAccountPosition: 16,
  EOrderInCooldown: 17,
  EOrderExpired: 18,
  EOrderNotExpired: 19,
} as const;

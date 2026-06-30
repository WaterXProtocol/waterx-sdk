/**
 * On-chain `waterx_prediction` protocol constants mirrored for e2e discovery + skip logic.
 * The Move contract (`waterx_prediction.move`) is the source of truth — keep these in sync.
 */

/**
 * Keeper fill grace window past an order's expiry (audit M02). `self_cancel_order` /
 * `self_cancel_close` abort `EOrderNotExpired` (19) until `now >= expiry_ts + KEEPER_FILL_GRACE_MS`,
 * so e2e discovery must not surface a rescue id (and the seed must not treat one as reusable)
 * before this window elapses. Mirrors `const KEEPER_FILL_GRACE_MS: u64 = 300_000;`.
 */
export const KEEPER_FILL_GRACE_MS = 300_000n;

/** `confirm_close` abort when the underlying market resolved before the close was confirmed. */
export const E_MARKET_ALREADY_RESOLVED = 12;
/** `fill_order` / `self_cancel_*` abort when the order's expiry has already passed. */
export const E_ORDER_EXPIRED = 18;
/** `fill_order` abort when the keeper fill price exceeds the order's price cap. */
export const E_FILL_ABOVE_PRICE_CAP = 20;
/** `fill_order` abort when the keeper fill price is below the order's min price. */
export const E_FILL_BELOW_MIN_PRICE = 21;

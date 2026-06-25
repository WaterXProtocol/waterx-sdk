/**
 * Read-only perp queries — barrel.
 *
 * Each helper builds a one-shot PTB, runs `client.simulate(tx)` (zero-address
 * sender), and decodes the BCS return values. Implementations are split by
 * domain under `fetch/`:
 *
 *   simulate.ts   shared simulate/decode plumbing (internal)
 *   market.ts     account data + market / pool / token-pool / global-config
 *   positions.ts  position / order reads + paginated lists + redeem requests
 *   referral.ts   waterx_referral queries
 *   account.ts    wxa account reads + inclusive spendable-credit balance
 *   custody.ts    native-custody PSM reads
 *   bridge.ts     wormhole_bridge limits + withdrawal_queue fee estimate
 */

export * from "./fetch/market.ts";
export * from "./fetch/positions.ts";
export * from "./fetch/referral.ts";
export * from "./fetch/account.ts";
export * from "./fetch/custody.ts";
export * from "./fetch/bridge.ts";

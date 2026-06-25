/**
 * Unified WaterX account namespace — exposed as `client.account`.
 *
 * Aggregates the generic `waterx_account` framework builders with the funding
 * (credit + custody) builders into one surface. Every export is `PerpClient`-first:
 * the perp line's config carries the shared `waterx_account` package +
 * `AccountRegistry`, plus the bridge / native_custody / withdrawal_queue /
 * credit_registry that credit & custody read. Because `waterx_account` is a
 * single shared object across both product lines, an account created here is
 * usable by perp and prediction alike (see the cross-network caveat on the
 * umbrella `WaterXClient`).
 *
 * The prediction-specific account operations (delegate prediction permission,
 * prediction protocol whitelist / asset allowlist) are NOT generic and stay on
 * `client.predict`.
 *
 * INVARIANT: every export below must be **client-first** — `bindClient` (in
 * `unified-client.ts`) blindly binds the `PerpClient` as arg 0 to each function
 * here, so a non-client-first helper (e.g. a local crypto/URL util) leaking out
 * of these modules would be mis-bound silently. Keep such helpers unexported, or
 * add them to `NON_CLIENT_FIRST` in `unified-client.ts` (the coverage guard in
 * `test/perp/unit/unified-client.test.ts` only excuses names on that list).
 */

export * from "../user/account.ts"; // generic waterx_account framework builders
export * from "../user/credit.ts"; // cross-chain CREDIT / bridge builders
export * from "../user/custody.ts"; // native_custody PSM mint builders

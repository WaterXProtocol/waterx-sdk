/**
 * Unified WaterX account namespace — exposed as `client.account`.
 *
 * Aggregates the generic `waterx_account` framework builders with the funding
 * (credit + custody) builders into one surface. This is the contract's **base**
 * layer: it lives under `account/` and depends only **down** (base-client /
 * constants / generated) — it must never import `perp/` or `prediction/`. Builders
 * are typed to the {@link AccountClientLike} capability interface (in `./client.ts`),
 * which `PerpClient` satisfies structurally; `bindClient` passes the perp-line
 * client (which carries the shared `waterx_account` + `AccountRegistry`, bridge /
 * native_custody / withdrawal_queue / credit_registry) as arg 0. Because
 * `waterx_account` is a single shared object across both product lines, an account
 * created here is usable by perp and prediction alike (see the cross-network caveat
 * on the umbrella `WaterXClient`).
 *
 * The prediction-specific account operations (delegate prediction permission,
 * prediction protocol whitelist / asset allowlist) are NOT generic and stay on
 * `client.predict`.
 *
 * INVARIANT: every export below must be **client-first** — `bindClient` (in
 * `unified-client.ts`) blindly binds the client as arg 0 to each function here, so
 * a non-client-first helper (e.g. a local crypto/URL util) leaking out of these
 * modules would be mis-bound silently. Keep such helpers unexported, or add them to
 * `NON_CLIENT_FIRST` in `unified-client.ts` (the coverage guard in
 * `test/perp/unit/unified-client.test.ts` only excuses names on that list).
 */

export * from "./account.ts"; // generic waterx_account framework builders
export * from "./funding/credit.ts"; // cross-chain CREDIT / bridge builders
export * from "./funding/custody.ts"; // native_custody PSM mint builders

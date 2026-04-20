import type { BaseAsset } from "../../src/constants.ts";

/**
 * Pinned `position_id` per market for the integration reference UserAccount
 * (`INTEGRATION_REFERENCE_USER_ACCOUNT_ID` / `INTEGRATION_REFERENCE_WALLET_ADDRESS`). E2e simulate resolves these **first**
 * (must exist on-chain, same `accountId`, `size > 0`) before falling back to a
 * short scan of the latest global ids.
 *
 * **Ops:** Prefer auto-refresh: successful `pnpm e2e:preflight`, `pnpm e2e:prepare`, or
 * `pnpm e2e:bootstrap-positions` writes **`.e2e-fixed-positions.local.json`**
 * when not in CI — `resolveE2eOpenPosition` reads it after env vars.
 * You can still set ids here for committed defaults. Use `pnpm diagnose:positions` to inspect.
 * Testnet slots can be liquidated; re-run preflight/bootstrap if ids go stale.
 */
export const E2E_FIXED_OPEN_POSITION_IDS: Partial<Record<BaseAsset, number>> = {
  // Example — uncomment and set after you know the on-chain id:
  // BTC: 123,
};

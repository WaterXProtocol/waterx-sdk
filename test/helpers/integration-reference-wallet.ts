/**
 * Stable testnet wallet address used in e2e (simulate) reads and documented for integration traders.
 * Must match the signer that owns the WaterX UserAccount used in `pnpm test:integration`.
 * Persistent perp + WLP targets for this account: `test/helpers/e2e-persistent-state.ts`.
 */
export const INTEGRATION_REFERENCE_WALLET_ADDRESS =
  "0xdab02860cc388c0d1613520dca5b876ff1a89435d85933f027982baa8ef18700";

/**
 * Canonical WaterX **UserAccount** object id for {@link INTEGRATION_REFERENCE_WALLET_ADDRESS} on
 * WaterX testnet. E2e simulate / preflight resolve this **after** optional
 * `WATERX_INTEGRATION_ACCOUNT_ID` and before falling back to `getAccountsByOwner`’s first row.
 *
 * If this account is recreated on-chain, update this constant (and re-run preflight to refresh
 * `.e2e-fixed-positions.local.json`).
 */
export const INTEGRATION_REFERENCE_USER_ACCOUNT_ID =
  "0x20f9ec03b8704d7c5295e88143131646d1791cd7e4f2c5290565471d99fa3295";

/**
 * Default WaterX account object id for E2E **dry-run** (`client.simulate` only).
 * Used as `accountId` in PTB args when env/chain discovery do not provide one.
 * Does not require a private key or `.env` file; override with `E2E_ACCOUNT_ID` env var if needed.
 *
 * Some flows still skip when the account has `hasData=false` on testnet (see `skipUnlessAccountReady`).
 */
export const E2E_DEFAULT_ACCOUNT_ID =
  "0x26266b1381bcf03ab3acc37c1e87beffb52d49f345248bc3efb9114176990ae4";

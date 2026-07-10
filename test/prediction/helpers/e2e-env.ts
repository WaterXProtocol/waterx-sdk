/**
 * Optional `process.env` overrides for E2E / integration (no `.env` file required).
 * CI fetches WaterXProtocol/waterx-config plus on-chain discovery.
 */

export function optionalEnv(key: string): string | undefined {
  const v = process.env[key];
  return v === undefined || v === "" ? undefined : v;
}

/** Client options for the prediction e2e client. `loadConfig` no longer reads
 *  env — it only takes the `waterxConfigUrl` opt — so this harness sources the
 *  URL from `E2E_CONFIG_URL` (line-specific), falling back to the shared
 *  `WATERX_CONFIG_URL` that CI sets, and passes it as the opt. */
export function readE2eClientOverrides() {
  return {
    waterxConfigUrl: optionalEnv("E2E_CONFIG_URL") ?? optionalEnv("WATERX_CONFIG_URL"),
    grpcUrl: optionalEnv("E2E_GRPC_URL"),
    settlement: optionalEnv("E2E_SETTLEMENT_ASSET") === "USD" ? ("USD" as const) : undefined,
  };
}

/** @deprecated Use {@link readE2eClientOverrides}. */
export const readTestnetClientOverrides = readE2eClientOverrides;

/** Static fixture overrides (otherwise discovered on-chain). */
export function readFixtureOverrides() {
  return {
    accountId: optionalEnv("E2E_ACCOUNT_ID"),
    /** Wallet address for account-scoped dry-run simulate (`tx.setSender`). No private key needed. */
    accountOwner: optionalEnv("E2E_ACCOUNT_OWNER"),
    orderId: optionalEnv("E2E_ORDER_ID"),
    positionId: optionalEnv("E2E_POSITION_ID"),
    marketId: optionalEnv("E2E_MARKET_ID"),
    marketKey: optionalEnv("E2E_MARKET_KEY"),
    usdCoinObjectId: optionalEnv("E2E_USD_COIN_OBJECT_ID"),
  };
}

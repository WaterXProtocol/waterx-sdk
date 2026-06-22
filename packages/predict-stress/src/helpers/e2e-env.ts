/**
 * Optional `process.env` overrides for E2E / integration (no `.env` file required).
 * CI fetches WaterXProtocol/waterx-config plus on-chain discovery.
 */

export function optionalEnv(key: string): string | undefined {
  const v = process.env[key];
  return v === undefined || v === "" ? undefined : v;
}

/** Client options (falls back to waterx-config defaults). */
export function readTestnetClientOverrides() {
  return {
    configUrl: optionalEnv("E2E_CONFIG_URL"),
    grpcUrl: optionalEnv("E2E_GRPC_URL"),
    settlement: optionalEnv("E2E_SETTLEMENT_ASSET") === "USD" ? ("USD" as const) : undefined,
  };
}

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

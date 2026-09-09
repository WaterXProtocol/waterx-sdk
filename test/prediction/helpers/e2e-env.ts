/**
 * Optional `process.env` overrides for E2E / integration (no `.env` file required).
 * CI fetches WaterXProtocol/waterx-config plus on-chain discovery.
 */
import type { Network } from "~predict/constants.ts";

import { resolveWaterxConfigUrl } from "../../../scripts/waterx-config-url.ts";
import { DEFAULT_GRPC_URLS } from "../../../src/base-client.ts";

export function optionalEnv(key: string): string | undefined {
  const v = process.env[key];
  return v === undefined || v === "" ? undefined : v;
}

/**
 * The fullnode URL the harness's client is built against — `E2E_GRPC_URL`
 * when set, else the SDK's per-network default (the same resolution
 * `BaseLineClient` applies to `grpcUrl`). The JSON-RPC helpers
 * (`suix_queryEvents`) read it from here: the canonical config document
 * carries object ids only, never an endpoint. Trailing slash stripped.
 */
export function readE2eRpcUrl(network: Network): string {
  return (optionalEnv("E2E_GRPC_URL") ?? DEFAULT_GRPC_URLS[network]).replace(/\/$/, "");
}

/** Client options for the prediction e2e client. `loadConfig` never reads env
 *  — it only takes the `waterxConfigUrl` opt — so this harness composes the
 *  document URL here: `E2E_CONFIG_URL` (line-specific) else the shared
 *  `WATERX_CONFIG_URL`, each a CDN BASE that gets `/<network>.json` appended
 *  (a legacy complete-file value still works — see `resolveWaterxConfigUrl`). */
export function readE2eClientOverrides(network: Network = "TESTNET") {
  return {
    waterxConfigUrl: resolveWaterxConfigUrl(
      optionalEnv("E2E_CONFIG_URL") ?? optionalEnv("WATERX_CONFIG_URL"),
      network,
    ),
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

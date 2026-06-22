import type { Network } from "~predict/constants.ts";

/** Lower-case network label for describe strings and skip messages. */
export type PredictE2eNetwork = "testnet" | "mainnet";

/**
 * Prediction e2e network — driven by `WATERX_E2E_NETWORK` (set by `scripts/run-e2e.ts`).
 * Defaults to testnet when unset (e.g. bare `vitest run --project predict-e2e`).
 */
export function resolvePredictE2eNetwork(): PredictE2eNetwork {
  const raw = process.env.WATERX_E2E_NETWORK?.trim().toLowerCase();
  if (raw === "mainnet" || raw === "testnet") return raw;
  return "testnet";
}

/** Canonical `Network` key for `PredictClient.create` / `Client.create`. */
export function predictE2eNetworkKey(): Network {
  return resolvePredictE2eNetwork() === "mainnet" ? "MAINNET" : "TESTNET";
}

/** Exported once per worker for stable describe labels. */
export const predictE2eNetwork: PredictE2eNetwork = resolvePredictE2eNetwork();

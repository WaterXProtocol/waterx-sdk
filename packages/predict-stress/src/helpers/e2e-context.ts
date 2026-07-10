/**
 * Minimal testnet client factory for stress harness (no fixture discovery).
 */
import { PredictClient } from "@waterx/sdk/prediction/client";

import { readE2eClientOverrides } from "./e2e-env.ts";

/** Testnet client. `loadConfig` has no default and never reads env, so the
 *  `waterxConfigUrl` opt comes from `E2E_CONFIG_URL` / `WATERX_CONFIG_URL`
 *  via `readE2eClientOverrides()`; other `E2E_*` overrides are optional. */
export function createE2eClient(): Promise<PredictClient> {
  return PredictClient.testnet({ ...readE2eClientOverrides(), cache: true });
}

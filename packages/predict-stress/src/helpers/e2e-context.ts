/**
 * Minimal testnet client factory for stress harness (no fixture discovery).
 */
import { PredictClient } from "@waterx/perp-sdk/prediction/client";

import { readTestnetClientOverrides } from "./e2e-env.ts";

/** Testnet client using waterx-config defaults; optional `E2E_*` process.env overrides. */
export function createE2eClient(): Promise<PredictClient> {
  return PredictClient.testnet({ ...readTestnetClientOverrides(), cache: true });
}

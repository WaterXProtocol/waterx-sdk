import type { PredictClient } from "~predict/client.ts";
import { PredictClient as PredictClientClass } from "~predict/client.ts";
import type { WaterxPredictionConfig } from "~predict/config.ts";

import { TESTNET_FIXTURE_CONFIG } from "../fixtures/testnet-config.ts";

type MockConfigOverrides = Partial<Omit<WaterxPredictionConfig, "packages">> & {
  packages?: Partial<WaterxPredictionConfig["packages"]>;
};

/** Offline client fixture using test-only deployment IDs (no RPC until methods run). */
export function createMockPredictClient(overrides: MockConfigOverrides = {}): PredictClient {
  return new PredictClientClass("TESTNET", {
    ...TESTNET_FIXTURE_CONFIG,
    ...overrides,
    packages: {
      ...TESTNET_FIXTURE_CONFIG.packages,
      ...overrides.packages,
    },
  });
}

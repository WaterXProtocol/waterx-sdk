import { PredictClient } from "~predict/client.ts";

import type { WaterXConfig } from "../../../src/config.ts";
import { MOCK_TESTNET_CONFIG } from "../../helpers/fixtures/mock-testnet-config.ts";

/**
 * Offline client fixture over the shared parsed document (no RPC until methods
 * run). Pass a shaped copy of the fixture to test a particular deployment; the
 * default is cloned so a test that mutates `client.config` cannot poison the
 * shared fixture.
 */
export function createMockPredictClient(config: WaterXConfig = MOCK_TESTNET_CONFIG): PredictClient {
  return new PredictClient("TESTNET", structuredClone(config));
}

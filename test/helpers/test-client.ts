/**
 * Offline `WaterXClient` for unit tests — no network, deterministic config.
 */
import { WaterXClient } from "../../src/client.ts";
import { MOCK_TESTNET_CONFIG } from "./fixtures/mock-testnet-config.ts";

export function createUnitTestClient(): WaterXClient {
  return new WaterXClient("TESTNET", structuredClone(MOCK_TESTNET_CONFIG), {
    grpcUrl: "https://fullnode.test.invalid:443",
  });
}

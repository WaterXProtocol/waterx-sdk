/**
 * Offline `PerpClient` for unit tests — no network, deterministic config.
 */
import { PerpClient } from "../../../src/perp/client.ts";
import { MOCK_TESTNET_CONFIG } from "./fixtures/mock-testnet-config.ts";

export function createUnitTestClient(): PerpClient {
  // Clone so tests that mutate `client.config` (e.g. delete wlp) do not poison the shared fixture.
  return new PerpClient("TESTNET", structuredClone(MOCK_TESTNET_CONFIG), {
    grpcUrl: "https://fullnode.test.invalid:443",
  });
}

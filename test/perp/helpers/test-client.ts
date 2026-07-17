/**
 * Offline `PerpClient` for unit tests — no network, deterministic config.
 */
import type { PythGeneration } from "../../../src/oracle/config.ts";
import type { OracleSource } from "../../../src/oracle/price-update-rule.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import { MOCK_TESTNET_CONFIG } from "./fixtures/mock-testnet-config.ts";

export function createUnitTestClient(
  opts: { oracleSource?: OracleSource; pythGeneration?: PythGeneration } = {},
): PerpClient {
  // Clone so tests that mutate `client.config` (e.g. delete wlp) do not poison the shared fixture.
  return new PerpClient("TESTNET", structuredClone(MOCK_TESTNET_CONFIG), {
    grpcUrl: "https://fullnode.test.invalid:443",
    oracleSource: opts.oracleSource,
    pythGeneration: opts.pythGeneration,
  });
}

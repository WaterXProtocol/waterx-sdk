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
  const client = new PerpClient("TESTNET", structuredClone(MOCK_TESTNET_CONFIG), {
    grpcUrl: "https://fullnode.test.invalid:443",
    pythGeneration: opts.pythGeneration,
  });
  if (opts.oracleSource !== undefined) {
    // HOST-level override for routing tests: production derives oracleSource
    // from pythGeneration (one knob), but the oracle layer's routing contract
    // is keyed on host.oracleSource — tests exercise that contract directly
    // (e.g. lazer routing without dragging in the PRO infra defaults).
    (client as { oracleSource: OracleSource }).oracleSource = opts.oracleSource;
  }
  return client;
}

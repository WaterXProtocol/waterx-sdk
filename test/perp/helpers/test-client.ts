/**
 * Offline `PerpClient` for unit tests — no network, deterministic config.
 */
import { ORACLE_SOURCES, type OracleSource } from "../../../src/oracle/price-update-rule.ts";
import type { FetchPolicy } from "../../../src/oracle/update-fetch.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import type { WaterXConfig } from "../../../src/perp/config.ts";
import { MOCK_TESTNET_CONFIG } from "./fixtures/mock-testnet-config.ts";

/**
 * A copy of `config` wiring exactly `sources` — the fed set is derived, so a
 * test that wants a particular one shapes the config rather than passing a
 * list past the derivation.
 */
export function withOracleSources<C extends WaterXConfig>(
  config: C,
  sources: readonly OracleSource[],
): C {
  const next = structuredClone(config);
  const wanted = new Set<OracleSource>(sources);
  for (const source of ORACLE_SOURCES) {
    // EMPTY the feeds rather than delete the block. Derivation excludes an
    // empty-feeds source either way, but the block stays reachable — which
    // tests need for two things the fed set does not govern: exercising a
    // rule directly (`supportedTickers` reads config, not the fed set), and
    // wiring a ticker under an UNLISTED source to check it is not fed.
    const block = next.packages[source];
    if (!wanted.has(source) && block !== undefined) block.feeds = {};
  }
  return next;
}

export function createUnitTestClient(
  opts: {
    /**
     * The fed set this client should end up with.
     *
     * There is no `oracleSource` create option any more — the fed set is
     * DERIVED from the config (`deriveOracleSources`). So this shapes the mock
     * config to wire exactly the named sources, which is also a more faithful
     * test: it exercises the same derivation production goes through instead
     * of injecting a list past it.
     */
    oracleSource?: OracleSource | OracleSource[];
    pythApiKey?: string;
    pythFetch?: { timeoutMs?: number; retries?: number };
    waterxEndpoint?: string;
    waterxFetch?: FetchPolicy;
  } = {},
): PerpClient {
  // Clone so tests that mutate `client.config` (e.g. delete wlp) do not poison the shared fixture.
  // Unwire every source the test did not ask for; the client then derives
  // exactly the requested set. Deleting the block (rather than emptying
  // `feeds`) keeps "not deployed" and "deployed but serving nothing"
  // distinguishable for the tests that care about the difference.
  const config = withOracleSources(
    MOCK_TESTNET_CONFIG,
    opts.oracleSource === undefined
      ? ["waterx_rule"]
      : Array.isArray(opts.oracleSource)
        ? opts.oracleSource
        : [opts.oracleSource],
  );

  return new PerpClient("TESTNET", config, {
    grpcUrl: "https://fullnode.test.invalid:443",
    pythApiKey: opts.pythApiKey,
    pythFetch: opts.pythFetch,
    waterxEndpoint: opts.waterxEndpoint,
    waterxFetch: opts.waterxFetch,
  });
}

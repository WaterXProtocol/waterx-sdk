/**
 * Offline `PerpClient` for unit tests — no network, deterministic config.
 */
import type { WaterXConfig } from "../../../src/config.ts";
import type { OracleSource } from "../../../src/oracle/price-update-rule.ts";
import { deriveOracleSources } from "../../../src/oracle/source-list.ts";
import type { FetchPolicy } from "../../../src/oracle/update-fetch.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import { MOCK_TESTNET_CONFIG } from "../../helpers/fixtures/mock-testnet-config.ts";

/**
 * A copy of `config` wiring exactly `sources` — the fed set is derived, so a
 * test that wants a particular one shapes the config rather than passing a
 * list past the derivation.
 *
 * Each unwanted source's TICKER SET is emptied rather than its block deleted:
 * derivation drops an empty source either way, but the block stays reachable
 * for tests that exercise a rule's on-chain objects directly. Lazer's set is
 * `oracle_rules.pyth_lazer.lazer_feed_ids`; the quote-center's is
 * `oracle_rules.waterx.feeds`.
 */
export function withOracleSources(
  config: WaterXConfig,
  sources: readonly OracleSource[],
): WaterXConfig {
  const next = structuredClone(config);
  const wanted = new Set<OracleSource>(sources);
  if (!wanted.has("pyth_lazer_rule") && next.oracle_rules.pyth_lazer) {
    next.oracle_rules.pyth_lazer.lazer_feed_ids = {};
  }
  if (!wanted.has("waterx_rule")) next.oracle_rules.waterx.feeds = {};
  // Self-checking: the parameter promises a fed set, so verify the config
  // actually produces it. Without this, a fixture that loses a feed entry
  // silently yields a differently-fed client and the affected tests assert
  // against the wrong set with no signal.
  const derived = deriveOracleSources(next);
  if (derived.length !== wanted.size || derived.some((s) => !wanted.has(s))) {
    throw new Error(
      `withOracleSources: asked for [${[...wanted].join(", ")}] but the shaped config ` +
        `derives [${derived.join(", ")}] — is the fixture missing a rule block or its tickers?`,
    );
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
  // Clone so tests that mutate `client.config` do not poison the shared fixture.
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

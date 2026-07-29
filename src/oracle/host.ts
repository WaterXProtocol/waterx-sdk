/**
 * `OracleHost` — the narrow slice of a line client the oracle module reads.
 *
 * The oracle/refresh code used to take a concrete `PerpClient`, which fused the
 * shared oracle layer to the perp line. It only ever needs config-schema
 * lookups, the Pyth infra block, and a gRPC client — so it depends on this
 * structural interface instead. `PerpClient` satisfies it without any `implements`
 * clause, and a future `PredictClient` (or a test double) can too.
 */

import type { SuiGrpcClient } from "@mysten/sui/grpc";

import type { Network } from "../constants.ts";
import type { OracleConfig, PythAccessConfig } from "./config.ts";
import type { OracleSource } from "./price-update-rule.ts";

export interface OracleHost {
  /** Sui network this client targets — each rule keys its OWN infra table by it (`PYTH_CORE_INFRA`, `LAZER_INFRA`). */
  readonly network: Network;
  /** Oracle slice of the canonical `waterx-config` JSON (rule packages + per-ticker feeds). */
  readonly config: OracleConfig;
  /** Caller-supplied Pyth credential + fetch policy (create options) — NO endpoints, NO object ids. */
  readonly pyth: PythAccessConfig;
  /** gRPC client for the on-chain reads the Pyth update path needs. */
  readonly grpcClient: SuiGrpcClient;
  /**
   * Client-selected oracle rule source for `refreshOraclePrices`'s on-chain
   * update leg — the REQUIRED `oracleSource` create option, no default:
   * every deployment names its source explicitly. Routing is driven by this
   * value ALONE: never by a config JSON `enabled` flag (e.g. a future
   * `pyth_lazer_rule.enabled`) and never by `process.env` — the SDK never
   * reads it; consumers (BE/FE) wire this option from their own env var
   * (`ORACLE_SOURCE`).
   */
  readonly oracleSource: OracleSource;

  /** True when `ticker` is priced by `constant_rule`. */
  isConstantTicker(ticker: string): boolean;
  /** The `supra_rule` config when deployed, enabled, and fully wired; else `undefined`. */
  getSupraRule(): { published_at: string; config: string; oracle_holder: string } | undefined;
  /** The `pyth_rule.feeds` entry for `ticker` (`{ feed_id, price_info_object }`); throws if absent. */
  getPythFeed(ticker: string): { feed_id: string; price_info_object: string };
}

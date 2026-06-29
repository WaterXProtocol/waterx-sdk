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

import type { OracleConfig, PythInfraConfig } from "./config.ts";

export interface OracleHost {
  /** Oracle slice of the canonical `waterx-config` JSON (rule packages + per-ticker feeds). */
  readonly config: OracleConfig;
  /** External Pyth/Wormhole/Hermes infra (network default, overridable via config). */
  readonly pyth: PythInfraConfig;
  /** gRPC client for the on-chain reads the Pyth update path needs. */
  readonly grpcClient: SuiGrpcClient;

  /** True when `ticker` is priced by `constant_rule`. */
  isConstantTicker(ticker: string): boolean;
  /** The `supra_rule` config when deployed, enabled, and fully wired; else `undefined`. */
  getSupraRule(): { published_at: string; config: string; oracle_holder: string } | undefined;
  /** The `pyth_rule.feeds` entry for `ticker` (`{ feed_id, price_info_object }`); throws if absent. */
  getPythFeed(ticker: string): { feed_id: string; price_info_object: string };
}

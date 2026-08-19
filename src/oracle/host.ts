/**
 * `OracleHost` — the narrow slice of a line client the oracle module reads.
 *
 * The oracle/refresh code used to take a concrete `PerpClient`, which fused the
 * shared oracle layer to the perp line. It only ever needs config-schema
 * lookups, the caller-supplied access slices, and a gRPC client — so it depends
 * on this structural interface instead. `PerpClient` satisfies it without any
 * `implements` clause, and a future `PredictClient` (or a test double) can too.
 */

import type { SuiGrpcClient } from "@mysten/sui/grpc";

import type { Network } from "../constants.ts";
import type { OracleConfig, PythAccessConfig, WaterxAccessConfig } from "./config.ts";
import type { OracleSource } from "./price-update-rule.ts";

export interface OracleHost {
  /** Sui network this client targets — each rule keys its OWN infra table by it (`LAZER_INFRA`, `WATERX_INFRA`). */
  readonly network: Network;
  /** Oracle slice of the canonical `waterx-config` JSON (rule packages + per-ticker feeds). */
  readonly config: OracleConfig;
  /** Caller-supplied Pyth credential + fetch policy (create options) — NO endpoints, NO object ids. */
  readonly pyth: PythAccessConfig;
  /**
   * Caller-supplied WaterX quote-center overrides for `WaterxRule`
   * (`waterxEndpoint` / `waterxFetch` create options) — access-only, mirroring
   * `pyth` above. OPTIONAL so an existing host stays a valid `OracleHost`;
   * unset fields resolve against the rule's own `WATERX_INFRA[network]` table.
   * This is the hook a browser consumer uses to route the quote-center fetch
   * through a same-origin proxy (`endpoint`) or its own transport
   * (`fetch.fetchImpl`) — that request is made from the page, so it is bound
   * by the quote-center's CORS allowlist.
   */
  readonly waterx?: WaterxAccessConfig;
  /** gRPC client for any on-chain reads an update path needs. */
  readonly grpcClient: SuiGrpcClient;
  /**
   * The FED SET for `refreshOraclePrices`'s update legs — the REQUIRED
   * `oracleSource` create option normalized to a non-empty, deduped list.
   * Every listed source's data is fetched and fed in one build; the chain's
   * per-ticker weight tables decide which contributions count (feeding an
   * unweighted rule is dropped on-chain; starving a weighted one aborts), so
   * during weight migrations the list stays a SUPERSET of every ticker's
   * weighted set. Routing is driven by this value ALONE: never by a config
   * JSON `enabled` flag and never by `process.env` — the SDK never reads it;
   * consumers (BE/FE) wire this option from their own env var
   * (`ORACLE_SOURCE`, comma-separated).
   */
  readonly oracleSources: readonly OracleSource[];

  /** True when `ticker` is priced by `constant_rule`. */
  isConstantTicker(ticker: string): boolean;
  /** The `supra_rule` config when deployed, enabled, and fully wired; else `undefined`. */
  getSupraRule(): { published_at: string; config: string; oracle_holder: string } | undefined;
}

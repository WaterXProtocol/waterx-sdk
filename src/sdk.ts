/**
 * Package root for `@waterx/sdk` (`.` export).
 *
 * - `WaterXClient` — the umbrella entry point
 *   (`client.account.*` / `client.perp.*` / `client.predict.*`).
 * - `perp` / `prediction` — namespaces exposing each line's full API; use these
 *   to disambiguate the builder names that collide across the two lines. The perp
 *   sub-client itself is exported (flat + `perp.PerpClient`) as `PerpClient`.
 * - The flat re-export below preserves the legacy `@waterx/perp-sdk` surface at
 *   the package root for one major cycle (DEPRECATED — removed next major).
 *
 * Prediction is reachable only via the `prediction` namespace / `@waterx/sdk/prediction`
 * (never flat at the root) because its builder names collide with perp's.
 */

export { WaterXClient } from "./unified-client.ts";
/** @deprecated Renamed to `WaterXClient` (the umbrella). Removed next major. */
export { WaterXClient as Client } from "./unified-client.ts";
export type {
  AccountModule,
  ClientCreateOptions,
  PerpModule,
  PredictModule,
} from "./unified-client.ts";
export type {
  BuildBatchClaimTxParams as BuildPredictBatchClaimTxParams,
  BuildPlaceOrderTxParams as BuildPredictPlaceOrderTxParams,
} from "./prediction/tx-builders.ts";

export * as perp from "./perp/index.ts";
export * as prediction from "./prediction/index.ts";

// DEPRECATED flat perp surface (migration aid from `@waterx/perp-sdk`).
export * from "./perp/index.ts";

/**
 * The canonical price plane — the ONE off-chain price with the settlement's
 * definition (`./canonical/frame.ts` has the principle). This barrel is the
 * module the cross-repo plan names (`@waterx/sdk/oracle/canonical`);
 * `@waterx/sdk/oracle` re-exports all of it.
 *
 *   - `readCanonicalPrices`  — REST seed: `GET /v1/canonical?symbols=`, per-symbol fallback.
 *   - `openCanonicalStream`  — live: WebSocket `GET /v1/canonical/stream?symbols=`.
 *   - `parseCanonicalQuote` + the constants — the shared wire contract, for consumers
 *     that pin it in their own tests.
 *
 * `readQuoteCenterPrices` / `readLazerPrices` (`../read-prices.ts`) read ONE
 * LEG each and are deprecated for price reads in favour of these.
 */

export {
  CANONICAL_BATCH_ROUTE,
  CANONICAL_DROP_REASONS,
  CANONICAL_MAX_FUTURE_DRIFT_MS,
  CANONICAL_STREAM_ROUTE,
  CanonicalPrecisionError,
  parseCanonicalQuote,
} from "./canonical/frame.ts";
export type {
  CanonicalDropReason,
  CanonicalLeg,
  CanonicalQuote,
  CanonicalStatus,
} from "./canonical/frame.ts";
export { readCanonicalPrices } from "./canonical/read.ts";
export type { CanonicalReadOptions } from "./canonical/read.ts";
export { openCanonicalStream } from "./canonical/stream.ts";
export type {
  CanonicalConnectionEvent,
  CanonicalStreamHandle,
  CanonicalStreamOptions,
} from "./canonical/stream.ts";

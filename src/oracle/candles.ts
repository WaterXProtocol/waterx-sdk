/**
 * The live candle plane — the quote-center's in-flight OHLC bars
 * (`./candles/frame.ts` has the contract). This barrel is
 * `@waterx/sdk/oracle/candles`; `@waterx/sdk/oracle` re-exports all of it.
 *
 *   - `openCandleStream`     — live: WebSocket `GET /v1/candles/stream?symbols=&tf=`.
 *   - `LiveCandleBook`       — the per-(symbol, tf) newest bar with the order and `void` applied.
 *   - `parseLiveCandleFrame` / `compareLiveCandleFrames` + the constants — the shared wire
 *     contract, for consumers that pin it in their own tests or merge a REST seed.
 *
 * Closed buckets are authoritative on REST (`GET /v1/candles/{symbol}`); a live bar is
 * provisional until the quote-center's rollup persists it.
 */

export {
  CANDLE_DROP_REASONS,
  CANDLE_MAX_FUTURE_DRIFT_MS,
  CANDLE_MAX_SYMBOLS_PER_REQUEST,
  CANDLE_STREAM_ROUTE,
  CANDLE_TIMEFRAME_MS,
  CANDLE_TIMEFRAMES,
  LIVE_CANDLE_SOURCES,
  LIVE_CANDLE_STATES,
  LiveCandleBook,
  compareLiveCandleFrames,
  isCandleTimeframe,
  liveCandleKey,
  parseLiveCandleFrame,
} from "./candles/frame.ts";
export type {
  CandleDropReason,
  CandleTimeframe,
  LiveCandleApplyResult,
  LiveCandleFrame,
  LiveCandleSource,
  LiveCandleState,
} from "./candles/frame.ts";
export { openCandleStream } from "./candles/stream.ts";
export type {
  CandleConnectionEvent,
  CandleShardSnapshot,
  CandleStreamHandle,
  CandleStreamOptions,
  CandleStreamSnapshot,
} from "./candles/stream.ts";

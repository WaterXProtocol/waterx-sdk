/**
 * The live candle plane — the quote-center's in-flight OHLC bars
 * (`./candles/frame.ts` has the contract). This barrel is
 * `@waterx/sdk/oracle/candles`; `@waterx/sdk/oracle` re-exports all of it.
 *
 *   - `openCandleStream`     — live: WebSocket `GET /v1/candles/stream?symbols=&tf=`.
 *   - `LiveCandleBook`       — the per-(symbol, tf) newest bar with the order, `void` and
 *                              reconnect resync (`markSuspect`) applied.
 *   - `candlePointToFrame`   — a REST `include_open=true` live point as a frame, for the seed
 *                              every (re)connect needs (the gateway may send no snapshot);
 *                              `candleSeedWindow` is the `from` / `to` to ask REST for.
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
  candlePointToFrame,
  candleSeedWindow,
  compareLiveCandleFrames,
  isCandleTimeframe,
  liveCandleKey,
  parseLiveCandleFrame,
} from "./candles/frame.ts";
export type {
  CandleDropReason,
  CandlePoint,
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

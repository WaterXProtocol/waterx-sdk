/**
 * The live candle plane — the quote-center's in-flight OHLC bars
 * (`./candles/frame.ts` has the contract). This barrel is
 * `@waterx/sdk/oracle/candles`; `@waterx/sdk/oracle` re-exports all of it.
 *
 *   - `openCandleStream`     — live: WebSocket `GET /v1/candles/stream?symbols=&tf=`.
 *   - `seedLiveCandles`      — the REST `include_open=true` seed every (re)connect needs (the
 *                              gateway may send no snapshot; a missed `void` is never re-sent).
 *   - `LiveCandleBook`       — the per-(symbol, tf) newest bar with the order, `void` and
 *                              reconnect resync (`markSuspect` + fresh evidence) applied.
 *   - `candlePointToFrame` / `candleSeedWindow` — the seed's building blocks.
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
  nextLiveCandleMark,
  parseLiveCandleFrame,
  supersedesLiveCandleMark,
} from "./candles/frame.ts";
export type {
  CandleDropReason,
  CandlePoint,
  CandleTimeframe,
  LiveCandleApplyResult,
  LiveCandleEvidence,
  LiveCandleFrame,
  LiveCandleSource,
  LiveCandleState,
} from "./candles/frame.ts";
export { CANDLES_ROUTE, seedLiveCandles } from "./candles/seed.ts";
export type { SeedLiveCandlesOptions, SeedLiveCandlesResult } from "./candles/seed.ts";
export { openCandleStream } from "./candles/stream.ts";
export type {
  CandleConnectionEvent,
  CandleShardSnapshot,
  CandleStreamHandle,
  CandleStreamOptions,
  CandleStreamSnapshot,
} from "./candles/stream.ts";

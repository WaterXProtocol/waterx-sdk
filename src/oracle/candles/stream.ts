/**
 * `candles/stream.ts` — `openCandleStream`, the live read of the quote-center's
 * live candle plane: WebSocket `GET /v1/candles/stream?symbols=A,B&tf=1m,5m`,
 * one connection per ≤32-ticker shard, every requested timeframe on each.
 * Each shard's connection (dial, `ws`-iff-`headers`, capped jittered backoff,
 * handshake timeout, `stop` / `reconnectNow`) is `../stream-connection.ts`,
 * shared with `openCanonicalStream`. What is the candle stream's own is below.
 * `frame.ts` has the wire contract.
 *
 * THE QUERY. Exactly ONE `symbols` and ONE `tf` field, each comma-joined: the
 * quote-center's extractor refuses a repeated field (a plain-text 400 at the
 * gateway). `tf` is a LIST — one connection carries every requested timeframe
 * (`candle_tf_filter` in its `api.rs`); an unknown entry is a 400 (code 10005),
 * so timeframes are validated here, at open, instead of being retried into
 * forever. The client always sends both fields: the server reads an omitted
 * `symbols` as EVERY symbol (and answers an all-empty list such as `symbols=,`
 * with a 400, code 10002), so an empty ticker list throws rather than
 * subscribing the world or retrying a 400. Tickers are trimmed, as the server
 * trims each entry, so `" BTCUSD"` subscribes the pair it names AND matches
 * its frames. A ticker containing a comma throws: the server would split it
 * into several symbols (past the 32 cap, even), none of which would match the
 * one string this client subscribed. Unknown symbols are skipped by the server
 * (their pair simply never sends a frame).
 *
 * NO SNAPSHOT GUARANTEE. The quote-service sends the current frame of every
 * matching pair when a stream opens, but the gateway shares ONE upstream per
 * path + query, so a client that joins an upstream another client opened gets
 * live frames only. Consumers call `LiveCandleBook.markSuspect(event.tickers)`
 * and then `seedLiveCandles` on every `opened` event: a `void` lost during the
 * outage is never re-sent (see `frame.ts`).
 *
 * THE GUARD orders per (symbol, tf) on the plane's own key through
 * `supersedesLiveCandleMark`: a frame that does not supersede the last
 * delivered one is `out_of_order`, or `duplicate` at an equal key on the SAME
 * connection. The watermark survives reconnects, with one exception: the FIRST
 * frame of a pair on a new connection is delivered at an equal key — it is the
 * server re-sending that bar after the outage (what a consumer passes to
 * `LiveCandleBook.apply` as fresh evidence), not a replay to suppress. `void`
 * frames are delivered, and a `void` supersedes an `open` frame of its bucket
 * whatever its `updated_at_ms`: the tombstone comes from a NEW leader, whose
 * clock may be behind the old one's.
 *
 * QUIET IS NOT FAILURE. A shard whose markets are all out of session — or
 * that joined a shared upstream with no snapshot — legitimately delivers
 * nothing. A connection that stayed open `backoff.quietHealthyAfterMs`
 * (default 10 s) therefore does not count towards the backoff when it ends,
 * so a quiet shard keeps redialling at the initial delay rather than climbing
 * to the cap and being up to 30 s late when its market reopens. (The canonical
 * stream keeps the stricter rule: every evaluation is a frame there.)
 *
 * PER-SHARD STATUS. Each shard is an independent connection, and a shard can
 * go SILENT while the others are healthy (open but delivering nothing), which
 * an aggregate `connected` / `lastFrameAt` hides. So `snapshot().shards` lists
 * every shard — its tickers, `connected`, `connectedAt`, `idleSince`,
 * `lastFrameAt` (activity), `lastDeliveredAt` (delivery), counters — and
 * `reconnectNow(shard)` redials one shard alone. A watchdog compares
 * `Date.now() - shard.idleSince` against its own budget: `idleSince` is the
 * later of the CURRENT connection's open and its last delivery, and is absent
 * while the shard is down — so a fresh connection is never judged by the
 * previous connection's last delivery (which `lastDeliveredAt`, kept across
 * reconnects, would do). The SDK sets no idle budget itself: a quiet shard is
 * not a broken one, and each redial costs the consumer a `markSuspect` + seed.
 * Lifecycle events carry `shard` / `shardCount` / `tickers` as fields rather
 * than the canonical stream's `reason: "shard i/n"` prefix.
 *
 * No SSE, as the canonical client: the quote-center serves SSE on a plain GET,
 * but every consumer of this client dials WebSocket.
 */

import { chunkCanonicalTickers } from "../canonical/frame.ts";
import { frameText, StreamConnection, type StreamMessageContext } from "../stream-connection.ts";
import {
  CANDLE_DROP_REASONS,
  CANDLE_STREAM_ROUTE,
  CANDLE_TIMEFRAMES,
  compareLiveCandleFrames,
  isCandleTimeframe,
  liveCandleKey,
  nextLiveCandleMark,
  parseLiveCandleFrame,
  supersedesLiveCandleMark,
  type CandleDropReason,
  type CandleTimeframe,
  type LiveCandleFrame,
} from "./frame.ts";

/** A lifecycle event. `shard` is the 0-based shard index (always `0` on an unsharded stream). */
export interface CandleConnectionEvent {
  type: "opened" | "closed" | "failed";
  /**
   * As the canonical stream's: `closed` → `code=<n> frames=<delivered> <server reason>`
   * (or `reconnectNow frames=<delivered>` after `reconnectNow`); `failed` → the cause.
   */
  reason?: string;
  shard: number;
  shardCount: number;
  /** The shard's (trimmed, de-duplicated) tickers — what to `markSuspect` and re-seed on `opened`. */
  tickers: readonly string[];
}

export interface CandleStreamOptions {
  /** Quote-center http(s) (or ws(s)) base URL; the ws(s) URL is derived from it, a proxy base path preserved. */
  endpoint: string;
  /** The tickers to subscribe (`BTCUSD`). Trimmed, de-duplicated, then sharded at 32. At least one; none may contain a comma. */
  tickers: readonly string[];
  /** The timeframes to subscribe on every shard. Default: all of {@link CANDLE_TIMEFRAMES}. */
  timeframes?: readonly CandleTimeframe[];
  /** Handshake headers (e.g. `X-Internal-Key`). Requires the optional peer dependency `ws` at runtime. */
  headers?: Record<string, string>;
  /** Every DELIVERED frame (`void` included), with the 0-based index of the shard that carried it. */
  onFrame: (frame: LiveCandleFrame, shard: number) => void;
  onConnection?: (event: CandleConnectionEvent) => void;
  /**
   * Default 1 s doubling to 30 s (20% proportional jitter) over consecutive
   * fruitless connections. A connection is fruitful when it delivered a frame,
   * or stayed open at least `quietHealthyAfterMs` (default 10 000) — see
   * "QUIET IS NOT FAILURE" in the module header.
   */
  backoff?: { initialMs?: number; maxMs?: number; quietHealthyAfterMs?: number };
  /** Abort a handshake that produced neither `open` nor an HTTP error within this budget. Default 10 000. */
  handshakeTimeoutMs?: number;
}

/** One shard's status — what a per-shard watchdog reads. */
export interface CandleShardSnapshot {
  /** 0-based shard index; the `shard` of its events and `reconnectNow(shard)`'s argument. */
  shard: number;
  tickers: readonly string[];
  connected: boolean;
  /** Epoch ms the CURRENT connection opened; absent while not connected. */
  connectedAt?: number;
  /**
   * THE WATCHDOG SIGNAL: epoch ms since which the CURRENT connection has
   * delivered nothing — the later of its open and its last delivery. Absent
   * while not connected (a down shard is redialling already).
   */
  idleSince?: number;
  /** Epoch ms of the last parsed, subscribed frame (delivered or dropped by the guard) — socket activity. Survives reconnects. */
  lastFrameAt?: number;
  /** Epoch ms of the last frame DELIVERED to `onFrame`, on ANY connection — a diagnostic; watch `idleSince`. */
  lastDeliveredAt?: number;
  /** Frames delivered to `onFrame` since start. */
  framesAccepted: number;
  /** Cumulative drops per {@link CandleDropReason}; every reason is a key. */
  droppedByReason: Record<string, number>;
}

export interface CandleStreamSnapshot {
  /** True iff EVERY shard is connected. */
  connected: boolean;
  /** The latest `lastFrameAt` of any shard. */
  lastFrameAt?: number;
  /** The latest `lastDeliveredAt` of any shard. */
  lastDeliveredAt?: number;
  framesAccepted: number;
  droppedByReason: Record<string, number>;
  /** Per-shard status, in shard order. */
  shards: CandleShardSnapshot[];
}

export interface CandleStreamHandle {
  /** Number of connections (≥ 1). */
  readonly shardCount: number;
  /** Tears every socket down and cancels pending redials. No callback fires after it returns. Idempotent. */
  stop(): void;
  /**
   * Ends a connection now so the normal reconnect path redials it: shard
   * `shard` only, or every shard when omitted. The attempt is settled at once
   * (it does not wait for a close event a half-open peer would never send).
   * No-op when stopped or out of range.
   */
  reconnectNow(shard?: number): void;
  snapshot(): CandleStreamSnapshot;
}

const DEFAULT_QUIET_HEALTHY_AFTER_MS = 10_000;

/** Trim (as the server does), drop empties, refuse commas, then de-duplicate and split at the server's cap. */
function shardTickers(tickers: readonly string[]): string[][] {
  const trimmed = tickers.map((t) => t.trim()).filter((t) => t !== "");
  for (const ticker of trimmed) {
    if (ticker.includes(",")) {
      throw new Error(
        `openCandleStream: ticker ${JSON.stringify(ticker)} contains a comma — pass each ticker as its own array entry`,
      );
    }
  }
  return chunkCanonicalTickers(trimmed);
}

/** ONE connection over at most 32 tickers × the requested timeframes: the guard and the counters. */
class CandleStreamShard {
  private lastFrameAt: number | undefined;
  private lastDeliveredAt: number | undefined;
  private framesAccepted = 0;
  private readonly dropped: Record<CandleDropReason, number>;
  /** Last delivered frame per (symbol, tf) — the guard's watermark. */
  private readonly marks = new Map<string, LiveCandleFrame>();
  /** Pairs the CURRENT connection has delivered — an equal key is a duplicate only within one connection. */
  private pairsSeen: { connection: number; keys: Set<string> } = { connection: 0, keys: new Set() };
  private readonly subscribed: ReadonlySet<string>;
  private readonly connection: StreamConnection;

  constructor(
    private readonly options: CandleStreamOptions,
    private readonly tickers: readonly string[],
    private readonly timeframes: ReadonlySet<CandleTimeframe>,
    private readonly index: number,
    private readonly shardCount: number,
  ) {
    this.subscribed = new Set(tickers);
    this.dropped = Object.fromEntries(CANDLE_DROP_REASONS.map((r) => [r, 0])) as Record<
      CandleDropReason,
      number
    >;
    this.connection = new StreamConnection({
      caller: "openCandleStream",
      endpoint: options.endpoint,
      route: CANDLE_STREAM_ROUTE,
      query: { symbols: tickers.join(","), tf: [...timeframes].join(",") },
      headers: options.headers,
      backoff: options.backoff,
      handshakeTimeoutMs: options.handshakeTimeoutMs,
      quietHealthyAfterMs: options.backoff?.quietHealthyAfterMs ?? DEFAULT_QUIET_HEALTHY_AFTER_MS,
      onEvent: (event) =>
        this.options.onConnection?.({
          ...event,
          shard: this.index,
          shardCount: this.shardCount,
          tickers: this.tickers,
        }),
      onMessage: (data, context) => this.handleFrame(data, context),
    });
  }

  start(): void {
    this.connection.start();
  }

  stop(): void {
    this.connection.stop();
  }

  reconnectNow(): void {
    this.connection.reconnectNow();
  }

  snapshot(): CandleShardSnapshot {
    const connectedAt = this.connection.connectedAt;
    // A delivery on an EARLIER connection is older than this connection's open,
    // so the max is the current connection's own idle start.
    const idleSince =
      connectedAt === undefined ? undefined : Math.max(connectedAt, this.lastDeliveredAt ?? 0);
    return {
      shard: this.index,
      tickers: this.tickers,
      connected: connectedAt !== undefined,
      ...(connectedAt !== undefined ? { connectedAt } : {}),
      ...(idleSince !== undefined ? { idleSince } : {}),
      ...(this.lastFrameAt !== undefined ? { lastFrameAt: this.lastFrameAt } : {}),
      ...(this.lastDeliveredAt !== undefined ? { lastDeliveredAt: this.lastDeliveredAt } : {}),
      framesAccepted: this.framesAccepted,
      droppedByReason: { ...this.dropped },
    };
  }

  private handleFrame(data: unknown, context: StreamMessageContext): void {
    const now = Date.now();
    const text = frameText(data);
    const frame = text === undefined ? "malformed" : parseLiveCandleFrame(text, now);
    if (typeof frame === "string") {
      this.dropped[frame]++;
      return;
    }
    if (!this.subscribed.has(frame.symbol) || !this.timeframes.has(frame.tf)) {
      this.dropped.unsolicited++;
      return;
    }
    this.lastFrameAt = now;

    // THE GUARD — see the module header.
    const key = liveCandleKey(frame.symbol, frame.tf);
    if (this.pairsSeen.connection !== context.connection) {
      this.pairsSeen = { connection: context.connection, keys: new Set() };
    }
    const prev = this.marks.get(key);
    if (prev !== undefined && !supersedesLiveCandleMark(frame, prev)) {
      const equal = compareLiveCandleFrames(frame, prev) === 0;
      if (!equal) {
        this.dropped.out_of_order++;
        return;
      }
      if (this.pairsSeen.keys.has(key)) {
        this.dropped.duplicate++;
        return;
      }
    }
    this.marks.set(key, nextLiveCandleMark(frame, prev));
    this.pairsSeen.keys.add(key);

    context.delivering();
    this.framesAccepted++;
    this.lastDeliveredAt = now;
    this.options.onFrame(frame, this.index);
  }
}

/**
 * WebSocket `GET /v1/candles/stream?symbols=…&tf=…` — the quote-center's live
 * (in-flight) candle bars, ordered per (symbol, tf). The server MAY send the
 * current bars first; through the gateway it may not, so seed from REST
 * (`seedLiveCandles`) on every `opened` event (module header). More than
 * `CANDLE_MAX_SYMBOLS_PER_REQUEST` tickers shard into several connections
 * behind the one handle; each shard carries every requested timeframe.
 * Connects immediately and keeps reconnecting until `stop()`. Throws
 * synchronously on no tickers, a ticker containing a comma, an unknown
 * timeframe, a non-http(s)/ws(s) endpoint, or nothing to dial with (no global
 * `WebSocket` and no `headers`). See the module header.
 */
export function openCandleStream(opts: CandleStreamOptions): CandleStreamHandle {
  const chunks = shardTickers(opts.tickers);
  if (chunks.length === 0) {
    // The server reads an OMITTED `symbols` as every symbol (and an all-empty
    // list as a 400): there is no list to send.
    throw new Error("openCandleStream: at least one ticker is required");
  }
  const requested = opts.timeframes ?? CANDLE_TIMEFRAMES;
  for (const tf of requested) {
    if (!isCandleTimeframe(tf)) {
      throw new Error(
        `openCandleStream: unknown timeframe ${JSON.stringify(tf)}; expected one of ${CANDLE_TIMEFRAMES.join(", ")}`,
      );
    }
  }
  const timeframes: ReadonlySet<CandleTimeframe> = new Set(requested);
  if (timeframes.size === 0) {
    // An empty `tf=` is also "every timeframe" to the server.
    throw new Error("openCandleStream: at least one timeframe is required");
  }
  // Construct EVERY shard before starting any, so a throwing constructor
  // leaves nothing dialling behind a handle the caller never received.
  const shards = chunks.map(
    (chunk, i) => new CandleStreamShard(opts, chunk, timeframes, i, chunks.length),
  );
  for (const shard of shards) shard.start();

  return {
    shardCount: shards.length,
    stop(): void {
      for (const shard of shards) shard.stop();
    },
    reconnectNow(shard?: number): void {
      if (shard === undefined) {
        for (const s of shards) s.reconnectNow();
        return;
      }
      shards[shard]?.reconnectNow();
    },
    snapshot(): CandleStreamSnapshot {
      const snaps = shards.map((shard) => shard.snapshot());
      const droppedByReason: Record<string, number> = {};
      let lastFrameAt: number | undefined;
      let lastDeliveredAt: number | undefined;
      for (const snap of snaps) {
        for (const [reason, n] of Object.entries(snap.droppedByReason)) {
          droppedByReason[reason] = (droppedByReason[reason] ?? 0) + n;
        }
        if (snap.lastFrameAt !== undefined && (lastFrameAt ?? -1) < snap.lastFrameAt) {
          lastFrameAt = snap.lastFrameAt;
        }
        if (snap.lastDeliveredAt !== undefined && (lastDeliveredAt ?? -1) < snap.lastDeliveredAt) {
          lastDeliveredAt = snap.lastDeliveredAt;
        }
      }
      return {
        connected: snaps.every((snap) => snap.connected),
        ...(lastFrameAt !== undefined ? { lastFrameAt } : {}),
        ...(lastDeliveredAt !== undefined ? { lastDeliveredAt } : {}),
        framesAccepted: snaps.reduce((sum, snap) => sum + snap.framesAccepted, 0),
        droppedByReason,
        shards: snaps,
      };
    },
  };
}

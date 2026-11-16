/**
 * `candles/stream.ts` — `openCandleStream`, the live read of the quote-center's
 * live candle plane: WebSocket `GET /v1/candles/stream?symbols=A,B&tf=1m,5m`,
 * one connection per ≤32-ticker shard, every requested timeframe on each.
 * The transport is `openCanonicalStream`'s (`../canonical/stream.ts`) — the
 * same `ws`-iff-`headers` dial, capped jittered backoff reset by DELIVERY,
 * handshake timeout, `stop` / `reconnectNow`, the same lifecycle vocabulary —
 * and the helpers are shared with it, so read that header for the transport
 * rules. What differs is below. `frame.ts` has the wire contract.
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
 * its frames. Unknown symbols are skipped by the server (their pair simply
 * never sends a frame).
 *
 * NO SNAPSHOT GUARANTEE. The quote-service sends the current frame of every
 * matching pair when a stream opens, but the gateway shares ONE upstream per
 * path + query, so a client that joins an upstream another client opened gets
 * live frames only. Consumers seed from REST (`include_open=true`, via
 * `candlePointToFrame`) on every `opened` event, and call
 * `LiveCandleBook.markSuspect(event.tickers)` first: a `void` lost during the
 * outage is never re-sent (see `frame.ts`).
 *
 * THE GUARD orders per (symbol, tf) on the plane's own key
 * (`compareLiveCandleFrames`): a frame ordered below the last delivered one is
 * `out_of_order` and an equal key on the SAME connection a `duplicate`. The
 * watermark survives reconnects, as the canonical guard's does, with one
 * exception: the FIRST frame of a pair on a new connection is delivered at an
 * equal key — it is the server re-asserting that bar after the outage (what
 * clears `LiveCandleBook`'s suspect mark), not a replay to suppress. `void`
 * frames are delivered: the consumer drops the bucket's bar (`LiveCandleBook`
 * does it).
 *
 * PER-SHARD STATUS. Each shard is an independent connection, and a shard can
 * go SILENT while the others are healthy (open but delivering nothing), which
 * an aggregate `connected` / `lastFrameAt` hides. So `snapshot().shards` lists
 * every shard — its tickers, `connected`, `connectedAt`, `lastFrameAt`
 * (activity), `lastDeliveredAt` (delivery), counters — and
 * `reconnectNow(shard)` redials one shard alone: a consumer's watchdog compares
 * `lastDeliveredAt ?? connectedAt` per shard against its own idle budget and
 * redials the silent one. The SDK sets no idle budget itself: a shard whose
 * markets are all out of session legitimately sends nothing (no ticks, no bar).
 * Lifecycle events carry `shard` / `shardCount` as fields rather than the
 * canonical stream's `reason: "shard i/n"` prefix.
 *
 * No SSE, as the canonical client: the quote-center serves SSE on a plain GET,
 * but every consumer of this client dials WebSocket.
 */

import {
  canonicalReconnectDelayMs,
  DEFAULT_HANDSHAKE_TIMEOUT_MS,
  DEFAULT_INITIAL_MS,
  DEFAULT_MAX_MS,
  errorText,
  frameText,
  loadWs,
  OPEN,
  WS_SCHEME_BY_PROTOCOL,
  WsPeerUnavailableError,
  type SocketLike,
} from "../canonical/stream.ts";
import { joinEndpointPath } from "../update-fetch.ts";
import {
  CANDLE_DROP_REASONS,
  CANDLE_MAX_SYMBOLS_PER_REQUEST,
  CANDLE_STREAM_ROUTE,
  CANDLE_TIMEFRAMES,
  compareLiveCandleFrames,
  isCandleTimeframe,
  liveCandleKey,
  parseLiveCandleFrame,
  type CandleDropReason,
  type CandleTimeframe,
  type LiveCandleFrame,
} from "./frame.ts";

/** A lifecycle event. `shard` is the 0-based shard index (always `0` on an unsharded stream). */
export interface CandleConnectionEvent {
  type: "opened" | "closed" | "failed";
  /** As the canonical stream's: `closed` → `code=<n> frames=<delivered> <server reason>`; `failed` → the cause. */
  reason?: string;
  shard: number;
  shardCount: number;
  /** The shard's (trimmed, de-duplicated) tickers — what to `markSuspect` and re-seed on `opened`. */
  tickers: readonly string[];
}

export interface CandleStreamOptions {
  /** Quote-center http(s) (or ws(s)) base URL; the ws(s) URL is derived from it, a proxy base path preserved. */
  endpoint: string;
  /** The tickers to subscribe (`BTCUSD`). De-duplicated, then sharded at 32. At least one. */
  tickers: readonly string[];
  /** The timeframes to subscribe on every shard. Default: all of {@link CANDLE_TIMEFRAMES}. */
  timeframes?: readonly CandleTimeframe[];
  /** Handshake headers (e.g. `X-Internal-Key`). Requires the optional peer dependency `ws` at runtime. */
  headers?: Record<string, string>;
  /** Every DELIVERED frame (`void` included), with the 0-based index of the shard that carried it. */
  onFrame: (frame: LiveCandleFrame, shard: number) => void;
  onConnection?: (event: CandleConnectionEvent) => void;
  /** Default 1 s doubling to 30 s (20% proportional jitter); reset by the first frame a connection delivers. */
  backoff?: { initialMs?: number; maxMs?: number };
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
  /** Epoch ms of the last parsed, subscribed frame (delivered or dropped by the guard) — socket activity. */
  lastFrameAt?: number;
  /** Epoch ms of the last frame DELIVERED to `onFrame` — the idle signal a watchdog compares. */
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
   * Drops a socket so the normal reconnect path redials it: shard `shard`
   * only, or every shard when omitted. No-op when stopped or out of range.
   */
  reconnectNow(shard?: number): void;
  snapshot(): CandleStreamSnapshot;
}

/** One connection attempt. `settled` makes the first terminal event the only one that counts. */
interface Attempt {
  socket: SocketLike | undefined;
  opened: boolean;
  settled: boolean;
  frames: number;
  handshakeTimer: ReturnType<typeof setTimeout> | undefined;
}

type ShardEvent = Pick<CandleConnectionEvent, "type" | "reason">;

/** Per-connection guard state: the pairs this connection has already delivered or re-asserted. */
interface ConnectionPairs {
  attempt: Attempt | undefined;
  seen: Set<string>;
}

/** Trim (as the server does), drop empties, de-duplicate (first occurrence wins, order kept), split at the server's cap. */
function shardTickers(tickers: readonly string[]): string[][] {
  const distinct = [...new Set(tickers.map((t) => t.trim()).filter((t) => t !== ""))];
  const out: string[][] = [];
  for (let i = 0; i < distinct.length; i += CANDLE_MAX_SYMBOLS_PER_REQUEST) {
    out.push(distinct.slice(i, i + CANDLE_MAX_SYMBOLS_PER_REQUEST));
  }
  return out;
}

/** ONE connection over at most `CANDLE_MAX_SYMBOLS_PER_REQUEST` tickers × the requested timeframes. */
class CandleStreamShard {
  private attempt: Attempt | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private fruitlessAttempts = 0;
  private connectedAt: number | undefined;
  private lastFrameAt: number | undefined;
  private lastDeliveredAt: number | undefined;
  private framesAccepted = 0;
  private readonly dropped: Record<CandleDropReason, number>;
  /** Last delivered frame per (symbol, tf) — the guard's watermark. */
  private readonly marks = new Map<string, LiveCandleFrame>();
  /** Pairs the CURRENT connection has delivered — an equal key is a duplicate only within one connection. */
  private connectionPairs: ConnectionPairs = { attempt: undefined, seen: new Set() };
  private readonly subscribed: ReadonlySet<string>;
  private readonly url: string;
  private readonly headers: Record<string, string> | undefined;
  private readonly initialMs: number;
  private readonly maxMs: number;
  private readonly handshakeTimeoutMs: number;

  constructor(
    private readonly options: CandleStreamOptions,
    private readonly tickers: readonly string[],
    private readonly timeframes: ReadonlySet<CandleTimeframe>,
    private readonly index: number,
    private readonly shardCount: number,
  ) {
    this.subscribed = new Set(tickers);
    const url = joinEndpointPath(options.endpoint, CANDLE_STREAM_ROUTE);
    const scheme = WS_SCHEME_BY_PROTOCOL[url.protocol];
    if (scheme === undefined) {
      throw new Error(`openCandleStream: endpoint must be http(s) or ws(s), got ${url.protocol}//`);
    }
    url.protocol = scheme;
    url.searchParams.set("symbols", tickers.join(","));
    url.searchParams.set("tf", [...timeframes].join(","));
    this.url = url.toString();
    const headers = options.headers;
    this.headers = headers && Object.keys(headers).length > 0 ? headers : undefined;
    this.initialMs = options.backoff?.initialMs ?? DEFAULT_INITIAL_MS;
    this.maxMs = options.backoff?.maxMs ?? DEFAULT_MAX_MS;
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;
    this.dropped = Object.fromEntries(CANDLE_DROP_REASONS.map((r) => [r, 0])) as Record<
      CandleDropReason,
      number
    >;
    if (!this.headers && typeof globalThis.WebSocket !== "function") {
      throw new Error(
        "openCandleStream: no WebSocket implementation — this runtime has no global " +
          "WebSocket (Node ≥ 22 or a browser), and only a stream opened with `headers` dials " +
          'the optional peer dependency "ws" instead',
      );
    }
  }

  start(): void {
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    const attempt = this.attempt;
    this.attempt = undefined;
    this.connectedAt = undefined;
    if (attempt !== undefined) this.teardown(attempt);
  }

  reconnectNow(): void {
    if (this.stopped) return;
    const attempt = this.attempt;
    if (attempt === undefined || attempt.settled || attempt.socket === undefined) return;
    this.dropSocket(attempt);
  }

  snapshot(): CandleShardSnapshot {
    const connected = this.attempt?.opened === true && this.attempt.socket?.readyState === OPEN;
    return {
      shard: this.index,
      tickers: this.tickers,
      connected,
      ...(connected && this.connectedAt !== undefined ? { connectedAt: this.connectedAt } : {}),
      ...(this.lastFrameAt !== undefined ? { lastFrameAt: this.lastFrameAt } : {}),
      ...(this.lastDeliveredAt !== undefined ? { lastDeliveredAt: this.lastDeliveredAt } : {}),
      framesAccepted: this.framesAccepted,
      droppedByReason: { ...this.dropped },
    };
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const attempt: Attempt = {
      socket: undefined,
      opened: false,
      settled: false,
      frames: 0,
      handshakeTimer: undefined,
    };
    this.attempt = attempt;

    let socket: SocketLike;
    try {
      socket = await this.dial();
    } catch (err) {
      if (attempt.settled) return;
      this.settle(attempt, { type: "failed", reason: errorText(err) });
      if (err instanceof WsPeerUnavailableError) this.stop();
      return;
    }
    if (attempt.settled) {
      socket.close();
      return;
    }
    attempt.socket = socket;

    attempt.handshakeTimer = setTimeout(() => {
      attempt.handshakeTimer = undefined;
      this.settle(attempt, {
        type: "failed",
        reason: `handshake timed out after ${String(this.handshakeTimeoutMs)}ms`,
      });
    }, this.handshakeTimeoutMs);

    socket.addEventListener("open", () => {
      if (attempt.settled) return;
      attempt.opened = true;
      this.connectedAt = Date.now();
      this.clearHandshakeTimer(attempt);
      this.emit({ type: "opened" });
    });
    socket.addEventListener("message", (event) => {
      if (attempt.settled) return;
      this.handleFrame(attempt, event.data);
    });
    socket.on?.("unexpected-response", (req, res) => {
      const status = res.statusCode;
      res.resume();
      req.destroy();
      this.settle(attempt, { type: "failed", reason: `handshake answered HTTP ${String(status)}` });
    });
    socket.addEventListener("error", (event) => {
      if (attempt.opened) return;
      this.settle(attempt, { type: "failed", reason: errorText(event) });
    });
    socket.addEventListener("close", (event) => {
      if (attempt.opened) {
        const reason = event.reason === "" ? "" : ` ${event.reason}`;
        this.settle(attempt, {
          type: "closed",
          reason: `code=${String(event.code)} frames=${String(attempt.frames)}${reason}`,
        });
        return;
      }
      this.settle(attempt, {
        type: "failed",
        reason: `closed before open (code ${String(event.code)})`,
      });
    });
  }

  private async dial(): Promise<SocketLike> {
    let socket: SocketLike;
    if (this.headers) {
      const Ws = await loadWs();
      socket = new Ws(this.url, {
        headers: this.headers,
        handshakeTimeout: this.handshakeTimeoutMs,
      });
    } else {
      socket = new globalThis.WebSocket(this.url) as unknown as SocketLike;
    }
    socket.binaryType = "arraybuffer";
    return socket;
  }

  private settle(attempt: Attempt, event: ShardEvent): void {
    if (attempt.settled) return;
    if (this.attempt === attempt) {
      this.attempt = undefined;
      this.connectedAt = undefined;
    }
    this.teardown(attempt);
    if (attempt.frames === 0) this.fruitlessAttempts++;
    // Redial BEFORE the consumer hears about it (see the canonical stream).
    this.scheduleReconnect();
    this.emit(event);
  }

  private emit(event: ShardEvent): void {
    this.options.onConnection?.({
      ...event,
      shard: this.index,
      shardCount: this.shardCount,
      tickers: this.tickers,
    });
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== undefined) return;
    const delay = canonicalReconnectDelayMs(this.fruitlessAttempts, this.initialMs, this.maxMs);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connect();
    }, delay);
  }

  private clearHandshakeTimer(attempt: Attempt): void {
    if (attempt.handshakeTimer !== undefined) {
      clearTimeout(attempt.handshakeTimer);
      attempt.handshakeTimer = undefined;
    }
  }

  private teardown(attempt: Attempt): void {
    attempt.settled = true;
    this.clearHandshakeTimer(attempt);
    this.dropSocket(attempt);
  }

  private dropSocket(attempt: Attempt): void {
    const socket = attempt.socket;
    if (socket === undefined) return;
    try {
      if (socket.terminate) socket.terminate();
      else socket.close();
    } catch {
      /* already gone */
    }
  }

  private handleFrame(attempt: Attempt, data: unknown): void {
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

    const key = liveCandleKey(frame.symbol, frame.tf);
    if (this.connectionPairs.attempt !== attempt) {
      this.connectionPairs = { attempt, seen: new Set() };
    }
    const firstOnConnection = !this.connectionPairs.seen.has(key);
    const prev = this.marks.get(key);
    if (prev !== undefined) {
      const order = compareLiveCandleFrames(frame, prev);
      if (order < 0) {
        this.dropped.out_of_order++;
        return;
      }
      if (order === 0 && !firstOnConnection) {
        this.dropped.duplicate++;
        return;
      }
    }
    this.marks.set(key, frame);
    this.connectionPairs.seen.add(key);

    if (attempt.frames === 0) this.fruitlessAttempts = 0;
    attempt.frames++;
    this.framesAccepted++;
    this.lastDeliveredAt = now;
    this.options.onFrame(frame, this.index);
  }
}

/**
 * WebSocket `GET /v1/candles/stream?symbols=…&tf=…` — the quote-center's live
 * (in-flight) candle bars, ordered per (symbol, tf). The server MAY send the
 * current bars first; through the gateway it may not, so seed from REST
 * `include_open=true` on every `opened` event (module header). More than `CANDLE_MAX_SYMBOLS_PER_REQUEST`
 * tickers shard into several connections behind the one handle; each shard
 * carries every requested timeframe. Connects immediately and keeps
 * reconnecting until `stop()`. Throws synchronously on no tickers, an unknown
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

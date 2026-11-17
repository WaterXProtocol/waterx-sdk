/**
 * `canonical/stream.ts` — `openCanonicalStream`, the live read of the canonical
 * price plane: ONE WebSocket carrying every subscribed ticker on
 * `/v1/canonical/stream` (one per ≤32-ticker shard past the server's cap),
 * reconnect with capped backoff, and a per-ticker ordering guard. The connection
 * itself (dial, redial, backoff, handshake timeout) is `../stream-connection.ts`,
 * shared with `openCandleStream`. Structured after the backend's `quote-center-price-stream.ts`
 * (the BBO-leg stream client it replaces) so that file can be deleted. See
 * `frame.ts` for what canonical IS and why the BBO stream was the wrong price.
 *
 * DEPLOY ORDER, and it is not optional: the quote-center must serve
 * `/v1/canonical/stream` BEFORE a consumer carrying this client rolls out.
 * There is deliberately no route ladder — a 404 on the handshake is reported
 * as a `failed` event whose reason names `HTTP 404` (when the transport can see
 * it; below), the client retries on the usual capped backoff and heals the
 * moment the route is deployed, but until then the consumer serves no live
 * prices and should say so at ERROR, as the backend did.
 *
 * TRANSPORT. Without `headers` the client dials the global WHATWG `WebSocket`
 * (Node ≥ 22, every browser) and adds no dependency. With `headers` — how the
 * backend's `X-Internal-Key` reaches the quote-center — the WHATWG constructor
 * is useless (it cannot send handshake headers), so the client loads the
 * optional peer dependency `ws` by dynamic import and dials that. `ws` is also
 * the only client that exposes a refused handshake's HTTP status
 * (`unexpected-response`); the global one reports a 404 and a dead host alike
 * as an opaque error. `ws` is a PEER, not a dependency: a browser bundle must
 * never pull it, and a consumer that needs headers already runs on Node.
 *
 * THE GUARD orders on the server's own key, not on `timestamp_ms`. The
 * price time is NOT monotonic per symbol: a Lazer-driven tick carries the
 * feed's `feedUpdateTimestamp`, a liveness or BBO tick the evaluation clock,
 * so a Lazer price can legitimately arrive stamped BEFORE the liveness verdict
 * it supersedes. The quote-center's stream bridge orders on
 * `evaluated_at_ms` (one clock per leader), falling back to `timestamp_ms`
 * when it is 0, and drops only a key BELOW the last one it forwarded. The
 * client applies exactly that, per ticker, uniformly to `ok` and non-ok
 * frames:
 *
 *   key = evaluated_at_ms > 0 ? evaluated_at_ms : timestamp_ms
 *   key === 0            → delivered, state untouched (an unstamped verdict —
 *                          only a non-ok frame can have one)
 *   key <  watermark     → `out_of_order` (the watermark is the highest key
 *                          DELIVERED, ok or not)
 *   ok, key === last ok  → `duplicate` (the same evaluation re-sent — a replay
 *                          after reconnect; emitting it is how a chart moves
 *                          while the mark stands still)
 *   otherwise            → delivered; the watermark (and, for ok, the last-ok
 *                          key) moves to `key`
 *
 * So a verdict at key K never blocks the ok price at K that follows (only a
 * LOWER key is out of order, and `duplicate` compares ok against ok), a
 * replayed pre-recovery verdict cannot re-stale a ticker that has since priced
 * (its key is below the watermark), and a Lazer ok after a liveness verdict is
 * never dropped for its older price time. `duplicate` is the one rule the
 * server does not have: the bridge forwards an equal key, and a client-side
 * replay of the same evaluation is what the reconnect path produces.
 *
 * SHARDED AT THE SERVER'S CAP. The quote-center refuses a subscription of more
 * than `CANONICAL_MAX_SYMBOLS_PER_REQUEST` (32) symbols. More tickers than
 * that open one connection per ≤32-ticker shard behind the ONE handle: each
 * shard reconnects independently with its own backoff, `stop` / `reconnectNow`
 * fan out, and `snapshot` aggregates (`connected` iff every shard is,
 * `lastFrameAt` the latest, counters summed). A sharded stream's lifecycle
 * events name their shard (`reason` is `shard i/n`, or prefixed `shard i/n: `);
 * an unsharded one's are unchanged. Tickers are de-duplicated first.
 *
 * TWO CLOCKS in the snapshot (carried over from the backend). `lastFrameAt` is
 * socket ACTIVITY — the last parsed, subscribed frame — and a diagnostic. What
 * drives the backoff is DELIVERY: the first frame delivered on a connection
 * resets the fruitless-attempt counter, and a close that delivered nothing
 * counts as a failure, so a connection that only replays timestamps already
 * seen is loud, useless, and treated as such.
 */

import { frameText, StreamConnection, type StreamMessageContext } from "../stream-connection.ts";
import {
  CANONICAL_DROP_REASONS,
  CANONICAL_STREAM_ROUTE,
  chunkCanonicalTickers,
  parseCanonicalQuote,
  type CanonicalDropReason,
  type CanonicalQuote,
} from "./frame.ts";

/** The `onConnection` payload — structurally the fixed block's inline type, named so consumers and tests can refer to it. */
export type CanonicalConnectionEvent = { type: "opened" | "closed" | "failed"; reason?: string };

/** Signature fixed by the cross-repo plan (plus the one additive option, `handshakeTimeoutMs`). */
export interface CanonicalStreamOptions {
  /** Quote-center http(s) base URL; the ws(s) URL is derived from it, a proxy base path preserved. */
  endpoint: string;
  /** The tickers to subscribe. Connecting with `?symbols=` IS the subscription; there is no handshake message. */
  tickers: readonly string[];
  /**
   * Handshake headers (e.g. `X-Internal-Key`). Requires the optional peer
   * dependency `ws` at runtime — see the module header.
   */
  headers?: Record<string, string>;
  /** Every DELIVERED frame, `ok` or not (see the module header for which frames are delivered). */
  onFrame: (quote: CanonicalQuote) => void;
  /**
   * Connection lifecycle. `closed` carries `code=<n> frames=<delivered> <server reason>`;
   * `failed` the cause (`handshake answered HTTP 404`, `handshake timed out after Nms`,
   * `closed before open (code N)`, the socket's error text, or the missing-`ws` message).
   */
  onConnection?: (event: CanonicalConnectionEvent) => void;
  /** Default 1 s doubling to 30 s (20% proportional jitter); reset by the first frame a connection delivers. */
  backoff?: { initialMs?: number; maxMs?: number };
  /**
   * ADDITIVE to the fixed signature. Abort a handshake that has produced
   * neither `open` nor an HTTP error within this budget (the WHATWG socket has
   * no handshake timeout of its own). Default 10 000.
   */
  handshakeTimeoutMs?: number;
}

/** Signature fixed by the cross-repo plan. */
export interface CanonicalStreamHandle {
  /** Tears the socket down and cancels any pending redial. No callback fires after it returns. Idempotent. */
  stop(): void;
  /**
   * Ends the current connection so the normal reconnect path redials. For a
   * half-open connection (the far end vanished without a FIN) or one replaying
   * frames nobody can use — neither recovers by waiting. The attempt is settled
   * at once (`closed`, reason `reconnectNow frames=<delivered>`), not when the
   * socket's own close event arrives: a half-open peer never sends one. No-op
   * when stopped.
   */
  reconnectNow(): void;
  snapshot(): {
    connected: boolean;
    /** Epoch ms of the last parsed, subscribed frame on ANY ticker — socket activity. Diagnostic. */
    lastFrameAt?: number;
    /** Frames delivered to `onFrame` since start (`ok` and `unavailable`). */
    framesAccepted: number;
    /** Cumulative drops per {@link CanonicalDropReason} since start; every reason is a key. */
    droppedByReason: Record<string, number>;
  };
}

/**
 * The backoff rule (capped exponential, proportional jitter) — the shared
 * connection's, re-exported under the name this module has always had.
 */
export { streamReconnectDelayMs as canonicalReconnectDelayMs } from "../stream-connection.ts";

/** Per-ticker guard state — see "THE GUARD" in the module header. */
interface OrderMark {
  /** Highest ordering key delivered (ok or not). */
  watermark: number;
  /** Ordering key of the last delivered `ok` frame. */
  lastOk: number | undefined;
}

/** The server bridge's ordering key: the evaluation clock, else the price time. */
function orderingKey(quote: CanonicalQuote): number {
  const evaluatedAt = quote.evaluated_at_ms ?? 0;
  return evaluatedAt > 0 ? evaluatedAt : quote.timestamp_ms;
}

/**
 * ONE connection over at most `CANONICAL_MAX_SYMBOLS_PER_REQUEST` tickers: the
 * guard and the counters. The socket, redial and backoff are
 * `../stream-connection.ts`'s.
 */
class CanonicalPriceStream implements CanonicalStreamHandle {
  private lastFrameAt: number | undefined;
  private framesAccepted = 0;
  private readonly dropped: Record<CanonicalDropReason, number>;
  /** Per-ticker ordering state (see "THE GUARD"). */
  private readonly marks = new Map<string, OrderMark>();
  private readonly subscribed: ReadonlySet<string>;
  private readonly connection: StreamConnection;

  /**
   * @param tickers this connection's (de-duplicated, ≤32) share of `options.tickers`.
   * @param shardLabel `shard i/n` on a sharded stream — named in every lifecycle event.
   */
  constructor(
    private readonly options: CanonicalStreamOptions,
    tickers: readonly string[],
    private readonly shardLabel?: string,
  ) {
    this.subscribed = new Set(tickers);
    this.dropped = Object.fromEntries(CANONICAL_DROP_REASONS.map((r) => [r, 0])) as Record<
      CanonicalDropReason,
      number
    >;
    this.connection = new StreamConnection({
      caller: "openCanonicalStream",
      endpoint: options.endpoint,
      route: CANONICAL_STREAM_ROUTE,
      query: { symbols: tickers.join(",") },
      headers: options.headers,
      backoff: options.backoff,
      handshakeTimeoutMs: options.handshakeTimeoutMs,
      onEvent: (event) => this.emit(event),
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

  snapshot(): ReturnType<CanonicalStreamHandle["snapshot"]> {
    return {
      connected: this.connection.connected,
      lastFrameAt: this.lastFrameAt,
      framesAccepted: this.framesAccepted,
      droppedByReason: { ...this.dropped },
    };
  }

  /** Every lifecycle event leaves through here, so a shard's always names it. */
  private emit(event: CanonicalConnectionEvent): void {
    const label = this.shardLabel;
    if (label === undefined) {
      this.options.onConnection?.(event);
      return;
    }
    this.options.onConnection?.({
      type: event.type,
      reason: event.reason === undefined ? label : `${label}: ${event.reason}`,
    });
  }

  /** The hot path: a counter bump or a field write per frame; the parse is the only allocation. */
  private handleFrame(data: unknown, context: StreamMessageContext): void {
    const now = Date.now();
    const text = frameText(data);
    const quote = text === undefined ? "malformed" : parseCanonicalQuote(text, now);
    if (typeof quote === "string") {
      this.dropped[quote]++;
      return;
    }
    if (!this.subscribed.has(quote.symbol)) {
      this.dropped.unsolicited++;
      return;
    }
    // SOCKET ACTIVITY, counted only once a frame has PARSED as ours: raw bytes
    // would let an upstream envelope change — every frame malformed, no price
    // served — look like a healthy connection.
    this.lastFrameAt = now;

    // THE GUARD — the rule table is in the module header.
    const key = orderingKey(quote);
    if (key !== 0) {
      const isOk = quote.status === "ok";
      const mark = this.marks.get(quote.symbol);
      if (mark !== undefined) {
        if (key < mark.watermark) {
          this.dropped.out_of_order++;
          return;
        }
        if (isOk && key === mark.lastOk) {
          this.dropped.duplicate++;
          return;
        }
        mark.watermark = key;
        if (isOk) mark.lastOk = key;
      } else {
        this.marks.set(quote.symbol, { watermark: key, lastOk: isOk ? key : undefined });
      }
    }

    // DELIVERY. The first frame a connection delivers proves it productive and
    // resets the backoff; a connection that never reaches here counts as
    // fruitless when it settles.
    context.delivering();
    this.framesAccepted++;
    this.options.onFrame(quote);
  }
}

/** More than 32 tickers: one {@link CanonicalPriceStream} per shard behind one handle. */
class ShardedCanonicalStream implements CanonicalStreamHandle {
  constructor(private readonly shards: readonly CanonicalPriceStream[]) {}

  stop(): void {
    for (const shard of this.shards) shard.stop();
  }

  reconnectNow(): void {
    for (const shard of this.shards) shard.reconnectNow();
  }

  snapshot(): ReturnType<CanonicalStreamHandle["snapshot"]> {
    const snaps = this.shards.map((shard) => shard.snapshot());
    const droppedByReason: Record<string, number> = {};
    for (const snap of snaps) {
      for (const [reason, n] of Object.entries(snap.droppedByReason)) {
        droppedByReason[reason] = (droppedByReason[reason] ?? 0) + n;
      }
    }
    let lastFrameAt: number | undefined;
    for (const { lastFrameAt: at } of snaps) {
      if (at !== undefined && (lastFrameAt === undefined || at > lastFrameAt)) lastFrameAt = at;
    }
    return {
      connected: snaps.every((snap) => snap.connected),
      lastFrameAt,
      framesAccepted: snaps.reduce((sum, snap) => sum + snap.framesAccepted, 0),
      droppedByReason,
    };
  }
}

/**
 * WebSocket `GET /v1/canonical/stream?symbols=…`; per-ticker ordering guard
 * on `evaluated_at_ms` (else `timestamp_ms`), the server bridge's key; a
 * `status !== "ok"` frame IS delivered to `onFrame`. More than
 * `CANONICAL_MAX_SYMBOLS_PER_REQUEST` tickers shard into several connections
 * behind the one handle. Connects immediately and keeps reconnecting until
 * `stop()`. Throws synchronously when nothing can dial (no global `WebSocket`
 * and no `headers`). See the module header for every disposition.
 */
export function openCanonicalStream(opts: CanonicalStreamOptions): CanonicalStreamHandle {
  const chunks = chunkCanonicalTickers(opts.tickers);
  if (chunks.length <= 1) {
    const stream = new CanonicalPriceStream(opts, chunks[0] ?? []);
    stream.start();
    return stream;
  }
  // Construct EVERY shard before starting any: a constructor that throws (no
  // WebSocket implementation, a bad endpoint) must not leave earlier shards
  // dialling behind a handle the caller never received.
  const shards = chunks.map(
    (chunk, i) =>
      new CanonicalPriceStream(opts, chunk, `shard ${String(i + 1)}/${String(chunks.length)}`),
  );
  for (const shard of shards) shard.start();
  return new ShardedCanonicalStream(shards);
}

/**
 * `canonical/stream.ts` — `openCanonicalStream`, the live read of the canonical
 * price plane: ONE WebSocket carrying every subscribed ticker on
 * `/v1/canonical/stream` (one per ≤32-ticker shard past the server's cap),
 * reconnect with capped backoff, and a per-ticker ordering guard. Structured after the backend's `quote-center-price-stream.ts`
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

import { joinEndpointPath } from "../update-fetch.ts";
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
   * Drops the current socket so the normal reconnect path redials. For a
   * half-open connection (the far end vanished without a FIN) or one replaying
   * frames nobody can use — neither recovers by waiting. No-op when stopped.
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

const DEFAULT_INITIAL_MS = 1_000;
const DEFAULT_MAX_MS = 30_000;
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 10_000;
/** Caps the exponent so `2 ** n` cannot overflow into Infinity on a long outage. */
const MAX_BACKOFF_EXPONENT = 10;
/** Fraction of the computed delay added as jitter. See {@link canonicalReconnectDelayMs}. */
const JITTER_FRACTION = 0.2;
/** WHATWG + `ws` agree: `readyState === 1` is OPEN. */
const OPEN = 1;
/** Endpoint scheme → stream scheme. TLS is preserved, never downgraded. */
const WS_SCHEME_BY_PROTOCOL: Readonly<Record<string, "ws:" | "wss:">> = {
  "https:": "wss:",
  "wss:": "wss:",
  "http:": "ws:",
  "ws:": "ws:",
};
/**
 * The optional peer's specifier, held in a variable so bundlers cannot resolve
 * the import statically: a browser or Next.js build that only wants
 * `readCanonicalPrices` shares this module graph and must not be asked to
 * resolve `ws` at build time. The magic comments cover webpack, Turbopack and
 * Vite; Node resolves the specifier at runtime from the SDK's own location,
 * where pnpm links the peer when the consumer installs it.
 */
const WS_SPECIFIER = "ws";

/**
 * Capped exponential backoff plus PROPORTIONAL jitter. Pure, so the spread is
 * testable. The jitter is a fraction of the CURRENT delay rather than of the
 * base: at the 30 s ceiling — exactly the state every replica reaches together
 * while one upstream recovers — a fixed ±200 ms would redial the whole fleet
 * inside the same window it used at 1 s.
 */
export function canonicalReconnectDelayMs(
  fruitlessAttempts: number,
  initialMs: number,
  maxMs: number,
  random: () => number = Math.random,
): number {
  const exponent = Math.min(Math.max(fruitlessAttempts - 1, 0), MAX_BACKOFF_EXPONENT);
  const delay = Math.min(initialMs * 2 ** exponent, maxMs);
  return delay + Math.floor(random() * delay * JITTER_FRACTION);
}

/**
 * The slice of a socket this client drives — satisfied by the WHATWG
 * `WebSocket` and by `ws` (whose EventTarget facade speaks the same four
 * events). The two optional members are `ws`-only and feature-detected.
 */
interface SocketLike {
  readonly readyState: number;
  binaryType?: string;
  addEventListener(type: "open", listener: () => void): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(type: "error", listener: (event: unknown) => void): void;
  addEventListener(
    type: "close",
    listener: (event: { code: number; reason: string }) => void,
  ): void;
  close(code?: number, reason?: string): void;
  /** `ws` only: drop the TCP connection without the close handshake a half-open peer would never answer. */
  terminate?(): void;
  /** `ws` only: Node EventEmitter surface, used to observe a refused handshake's HTTP status. */
  on?(
    event: "unexpected-response",
    listener: (req: { destroy(): void }, res: { statusCode?: number; resume(): void }) => void,
  ): unknown;
}

/** One connection attempt. `settled` makes the first terminal event the only one that counts. */
interface Attempt {
  socket: SocketLike | undefined;
  opened: boolean;
  settled: boolean;
  /** Frames DELIVERED on this connection — what decides whether its close was productive. */
  frames: number;
  handshakeTimer: ReturnType<typeof setTimeout> | undefined;
}

/** The optional `ws` peer could not be loaded — permanent, so the stream stops instead of retrying into it. */
class WsPeerUnavailableError extends Error {
  constructor(cause: unknown) {
    super(
      `cannot load the optional peer dependency "ws", which a stream opened with \`headers\` ` +
        `dials with (the WHATWG WebSocket cannot send handshake headers): ${errorText(cause)} ` +
        `— install it (pnpm add ws) or drop \`headers\``,
    );
    this.name = "WsPeerUnavailableError";
  }
}

/** Load the optional `ws` peer (tests mock the module to prove the missing-peer path). */
async function loadWs(): Promise<new (url: string, opts: object) => SocketLike> {
  let mod: { WebSocket?: unknown; default?: unknown };
  try {
    mod = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */ WS_SPECIFIER
    )) as typeof mod;
  } catch (err) {
    throw new WsPeerUnavailableError(err);
  }
  const ctor = mod.WebSocket ?? mod.default;
  if (typeof ctor !== "function") {
    throw new WsPeerUnavailableError(new Error("the ws module exports no WebSocket class"));
  }
  return ctor as new (url: string, opts: object) => SocketLike;
}

const textDecoder = new TextDecoder();

/** A frame's payload as text, or `undefined` for a shape this client does not decode (a `Blob`). */
function frameText(data: unknown): string | undefined {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return textDecoder.decode(data);
  if (ArrayBuffer.isView(data)) return textDecoder.decode(data);
  return undefined;
}

function errorText(event: unknown): string {
  if (event instanceof Error) return event.message;
  if (typeof event === "object" && event !== null) {
    const e = event as { message?: unknown; error?: unknown };
    if (typeof e.message === "string" && e.message !== "") return e.message;
    if (e.error instanceof Error) return e.error.message;
  }
  return "socket error";
}

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

/** ONE connection over at most `CANONICAL_MAX_SYMBOLS_PER_REQUEST` tickers. */
class CanonicalPriceStream implements CanonicalStreamHandle {
  private attempt: Attempt | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  /** Consecutive connections that delivered nothing; drives the backoff exponent. */
  private fruitlessAttempts = 0;
  private lastFrameAt: number | undefined;
  private framesAccepted = 0;
  private readonly dropped: Record<CanonicalDropReason, number>;
  /** Per-ticker ordering state (see "THE GUARD"). */
  private readonly marks = new Map<string, OrderMark>();
  private readonly subscribed: ReadonlySet<string>;
  private readonly url: string;
  private readonly headers: Record<string, string> | undefined;
  private readonly initialMs: number;
  private readonly maxMs: number;
  private readonly handshakeTimeoutMs: number;

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
    const url = joinEndpointPath(options.endpoint, CANONICAL_STREAM_ROUTE);
    // Secure stays secure: an `https:` OR `wss:` endpoint dials `wss:`. Anything
    // that is not http(s)/ws(s) is a misconfiguration, not a scheme to guess —
    // the old `https: ? wss: : ws:` quietly downgraded a `wss://` endpoint.
    const scheme = WS_SCHEME_BY_PROTOCOL[url.protocol];
    if (scheme === undefined) {
      throw new Error(
        `openCanonicalStream: endpoint must be http(s) or ws(s), got ${url.protocol}//`,
      );
    }
    url.protocol = scheme;
    url.searchParams.set("symbols", tickers.join(","));
    this.url = url.toString();
    const headers = options.headers;
    this.headers = headers && Object.keys(headers).length > 0 ? headers : undefined;
    this.initialMs = options.backoff?.initialMs ?? DEFAULT_INITIAL_MS;
    this.maxMs = options.backoff?.maxMs ?? DEFAULT_MAX_MS;
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;
    this.dropped = Object.fromEntries(CANONICAL_DROP_REASONS.map((r) => [r, 0])) as Record<
      CanonicalDropReason,
      number
    >;
    // Fail at construction, not on a timer: a consumer with nothing to dial
    // with is misconfigured, and a `failed` event minutes later says less.
    if (!this.headers && typeof globalThis.WebSocket !== "function") {
      throw new Error(
        "openCanonicalStream: no WebSocket implementation — this runtime has no global " +
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
    if (attempt !== undefined) this.teardown(attempt);
  }

  reconnectNow(): void {
    if (this.stopped) return;
    const attempt = this.attempt;
    if (attempt === undefined || attempt.settled || attempt.socket === undefined) return;
    // `terminate()` (ws) skips the close handshake a half-open peer would never
    // answer; `close()` is the WHATWG best. Either way the 'close' listener
    // still fires, which is what settles the attempt and schedules the redial.
    this.dropSocket(attempt);
  }

  snapshot(): ReturnType<CanonicalStreamHandle["snapshot"]> {
    return {
      connected: this.attempt?.socket?.readyState === OPEN,
      lastFrameAt: this.lastFrameAt,
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
      if (attempt.settled) return; // stop() won the race during the import
      // A missing `ws` peer is permanent: say so once and stop, rather than
      // retry into the same import error every backoff. Anything else a
      // constructor can throw is reported and retried like a failed handshake.
      this.settle(attempt, { type: "failed", reason: errorText(err) });
      if (err instanceof WsPeerUnavailableError) this.stop();
      return;
    }
    if (attempt.settled) {
      // stop() during the import: never attach to a socket nobody will tear down.
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
      this.clearHandshakeTimer(attempt);
      this.emit({ type: "opened" });
    });
    socket.addEventListener("message", (event) => {
      if (attempt.settled) return;
      this.handleFrame(attempt, event.data);
    });
    // `ws` only: a non-101 handshake answer. `ws` leaves the request to the
    // listener once one is attached — drain and destroy it here.
    socket.on?.("unexpected-response", (req, res) => {
      const status = res.statusCode;
      res.resume();
      req.destroy();
      this.settle(attempt, {
        type: "failed",
        reason: `handshake answered HTTP ${String(status)}`,
      });
    });
    socket.addEventListener("error", (event) => {
      // After `open`, an error is always followed by `close`, which carries the
      // code and is the event that settles the attempt; before `open` the
      // error IS the verdict.
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

  /** Construct the socket for this attempt: `ws` iff headers are set, else the global WebSocket. */
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
    // Binary frames as ArrayBuffer, so UTF-8 JSON on a binary frame still
    // decodes (the default `Blob` would need an async read on the hot path).
    socket.binaryType = "arraybuffer";
    return socket;
  }

  private settle(attempt: Attempt, event: CanonicalConnectionEvent): void {
    if (attempt.settled) return;
    if (this.attempt === attempt) this.attempt = undefined;
    this.teardown(attempt);
    // The ONLY writer of the counter besides delivery. A `failed` event can
    // only reach here with `opened === false`, i.e. having delivered nothing;
    // a `closed` one is productive iff it delivered — the first delivery
    // already reset the counter, so only the fruitless case is counted here.
    if (attempt.frames === 0) this.fruitlessAttempts++;
    // Redial is scheduled BEFORE the consumer hears about it: a throwing
    // `onConnection` must not be able to leave the stream with no attempt, no
    // timer and `stopped === false` — connected to nothing, forever.
    this.scheduleReconnect();
    this.emit(event);
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

  /**
   * Mark the attempt final and release its socket. The socket may still be
   * half-open (a handshake we aborted, a failed upgrade); dropping it is
   * idempotent and guarantees the fd is released. `terminate()` (ws) skips the
   * close handshake a half-open peer would never answer; `close()` is the
   * WHATWG best.
   */
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

  /** The hot path: a counter bump or a field write per frame; the parse is the only allocation. */
  private handleFrame(attempt: Attempt, data: unknown): void {
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
    if (attempt.frames === 0) this.fruitlessAttempts = 0;
    attempt.frames++;
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

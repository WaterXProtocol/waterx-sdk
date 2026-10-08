/**
 * `canonical/stream.ts` — `openCanonicalStream`, the live read of the canonical
 * price plane: ONE WebSocket carrying every subscribed ticker on
 * `/v1/canonical/stream`, reconnect with capped backoff, and a per-ticker
 * ordering guard. Structured after the backend's `quote-center-price-stream.ts`
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
 * THE GUARD. `timestamp_ms` is the evaluation's PRICE time and the ordering
 * key. An `ok` frame is delivered iff it is strictly newer than the last
 * delivered `ok` frame for that ticker (`out_of_order` / `duplicate`
 * otherwise): a same-instant re-emit is a duplicate whatever its price says —
 * emitting it is how a chart moves while the mark stands still. A non-ok frame
 * carries no price, only a verdict, and the contract says every evaluation is
 * delivered so the consumer marks the ticker stale instead of freezing on the
 * last price; it is delivered when it is unstamped (`timestamp_ms` 0) or
 * stamped at or after the mark, dropped `out_of_order` when stamped before it,
 * and it NEVER advances the mark — a verdict at T must not block the ok price
 * at T that follows, and a replayed pre-recovery verdict must not be able to
 * re-stale a ticker that has since priced.
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
  parseCanonicalQuote,
  type CanonicalDropReason,
  type CanonicalQuote,
} from "./frame.ts";

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
  onConnection?: (event: { type: "opened" | "closed" | "failed"; reason?: string }) => void;
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

/** Per-ticker ordering mark — MUTATED in place (one frame per ticker per tick allocates otherwise). */
interface TickerState {
  timestampMs: number;
}

type ConnectionEvent = Parameters<NonNullable<CanonicalStreamOptions["onConnection"]>>[0];

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
    mod = (await import("ws")) as typeof mod;
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

class CanonicalPriceStream implements CanonicalStreamHandle {
  private attempt: Attempt | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  /** Consecutive connections that delivered nothing; drives the backoff exponent. */
  private fruitlessAttempts = 0;
  private lastFrameAt: number | undefined;
  private framesAccepted = 0;
  private readonly dropped: Record<CanonicalDropReason, number>;
  private readonly marks = new Map<string, TickerState>();
  private readonly subscribed: ReadonlySet<string>;
  private readonly url: string;
  private readonly headers: Record<string, string> | undefined;
  private readonly initialMs: number;
  private readonly maxMs: number;
  private readonly handshakeTimeoutMs: number;

  constructor(private readonly options: CanonicalStreamOptions) {
    this.subscribed = new Set(options.tickers);
    const url = joinEndpointPath(options.endpoint, CANONICAL_STREAM_ROUTE);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("symbols", options.tickers.join(","));
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
    if (attempt !== undefined) {
      attempt.settled = true;
      this.clearHandshakeTimer(attempt);
      this.dropSocket(attempt);
    }
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
      this.options.onConnection?.({ type: "opened" });
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
    try {
      socket.binaryType = "arraybuffer";
    } catch {
      /* a transport without the setter — text frames still decode */
    }
    return socket;
  }

  private settle(attempt: Attempt, event: Exclude<ConnectionEvent, { type: "opened" }>): void {
    if (attempt.settled) return;
    attempt.settled = true;
    this.clearHandshakeTimer(attempt);
    if (this.attempt === attempt) this.attempt = undefined;
    // The socket may still be half-open (a handshake we aborted, a failed
    // upgrade); dropping it is idempotent and guarantees the fd is released.
    this.dropSocket(attempt);
    // The ONLY writer of the counter besides delivery. A `failed` event can
    // only reach here with `opened === false`, i.e. having delivered nothing;
    // a `closed` one is productive iff it delivered — the first delivery
    // already reset the counter, so only the fruitless case is counted here.
    if (attempt.frames === 0) this.fruitlessAttempts++;
    this.options.onConnection?.(event);
    this.scheduleReconnect();
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

    const mark = this.marks.get(quote.symbol);
    if (quote.status === "ok") {
      if (mark === undefined) {
        this.marks.set(quote.symbol, { timestampMs: quote.timestamp_ms });
      } else if (quote.timestamp_ms < mark.timestampMs) {
        this.dropped.out_of_order++;
        return;
      } else if (quote.timestamp_ms === mark.timestampMs) {
        this.dropped.duplicate++;
        return;
      } else {
        mark.timestampMs = quote.timestamp_ms;
      }
    } else if (
      mark !== undefined &&
      quote.timestamp_ms !== 0 &&
      quote.timestamp_ms < mark.timestampMs
    ) {
      // A verdict from before the last price is stale news; a verdict at or
      // after it (or unstamped) is the consumer's to act on. Never moves the mark.
      this.dropped.out_of_order++;
      return;
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

/**
 * WebSocket `GET /v1/canonical/stream?symbols=…`; per-ticker newest-`timestamp_ms`
 * guard; a `status !== "ok"` frame IS delivered to `onFrame`. Connects
 * immediately and keeps reconnecting until `stop()`. Throws synchronously when
 * nothing can dial (no global `WebSocket` and no `headers`). See the module
 * header for every disposition.
 */
export function openCanonicalStream(opts: CanonicalStreamOptions): CanonicalStreamHandle {
  const stream = new CanonicalPriceStream(opts);
  stream.start();
  return stream;
}

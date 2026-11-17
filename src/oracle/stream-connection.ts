/**
 * `stream-connection.ts` — ONE reconnecting WebSocket to a quote-center stream
 * route: the connection state machine `openCanonicalStream` and
 * `openCandleStream` share, so a transport fix lands once. Internal — no barrel
 * re-exports it. What a stream IS (its frames, guard and snapshot) stays with
 * its own module; this file only dials, redials and hands raw frames over.
 *
 * DIAL. Without `headers` the global WHATWG `WebSocket` (Node ≥ 22, browsers);
 * with `headers` the optional peer `ws`, loaded by a bundler-opaque dynamic
 * import — the WHATWG constructor cannot send handshake headers, and `ws` is
 * also the only client that exposes a refused handshake's HTTP status.
 *
 * ONE VERDICT PER ATTEMPT. `settle` ends an attempt exactly once: tears the
 * socket down, counts it fruitless or not, schedules the redial, THEN tells the
 * owner — a throwing `onEvent` must not be able to leave the connection with no
 * attempt and no timer.
 *
 * BACKOFF is capped, exponential and proportionally jittered over consecutive
 * FRUITLESS attempts. The first frame an attempt delivers resets the count. An
 * attempt that delivered nothing is fruitless — unless the owner sets
 * `quietHealthyAfterMs` and the attempt stayed open at least that long: a
 * stream whose pairs can legitimately be silent (candles out of session) must
 * not climb to the cap for being quiet, while a server that accepts and
 * immediately drops still backs off.
 *
 * `reconnectNow` SETTLES the attempt itself rather than waiting for the
 * socket's `close` event: the WHATWG `close()` starts a closing handshake that
 * a half-open peer never answers, so the event the redial used to hang on may
 * never come.
 */

import { joinEndpointPath } from "./update-fetch.ts";

export interface StreamConnectionEvent {
  type: "opened" | "closed" | "failed";
  reason?: string;
}

/** Handed to `onMessage` with each raw frame. */
export interface StreamMessageContext {
  /** Identifies the connection the frame arrived on (changes on every redial). */
  readonly connection: number;
  /** Call just before handing a frame to the consumer: marks this connection productive. */
  delivering(): void;
}

export interface StreamConnectionConfig {
  /** The public function's name, for error messages (`openCanonicalStream`). */
  caller: string;
  /** http(s) or ws(s) base URL; a proxy base path is preserved, TLS never downgraded. */
  endpoint: string;
  route: string;
  /** Query fields, each set ONCE. */
  query: Readonly<Record<string, string>>;
  headers?: Record<string, string>;
  backoff?: { initialMs?: number; maxMs?: number };
  handshakeTimeoutMs?: number;
  /** See "BACKOFF" in the module header. Unset: only delivery makes an attempt productive. */
  quietHealthyAfterMs?: number;
  onEvent(event: StreamConnectionEvent): void;
  onMessage(data: unknown, context: StreamMessageContext): void;
}

export const DEFAULT_INITIAL_MS = 1_000;
export const DEFAULT_MAX_MS = 30_000;
export const DEFAULT_HANDSHAKE_TIMEOUT_MS = 10_000;
/** Caps the exponent so `2 ** n` cannot overflow into Infinity on a long outage. */
const MAX_BACKOFF_EXPONENT = 10;
/** Fraction of the computed delay added as jitter. See {@link streamReconnectDelayMs}. */
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
export function streamReconnectDelayMs(
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
  id: number;
  socket: SocketLike | undefined;
  opened: boolean;
  /** Epoch ms `open` fired; undefined before it. */
  openedAt: number | undefined;
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

/** A frame's payload as text, or `undefined` for a shape a stream does not decode (a `Blob`). */
export function frameText(data: unknown): string | undefined {
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

/** ONE reconnecting connection. See the module header. */
export class StreamConnection {
  private attempt: Attempt | undefined;
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  /** Consecutive fruitless attempts; drives the backoff exponent. */
  private fruitlessAttempts = 0;
  private readonly url: string;
  private readonly headers: Record<string, string> | undefined;
  private readonly initialMs: number;
  private readonly maxMs: number;
  private readonly handshakeTimeoutMs: number;

  constructor(private readonly config: StreamConnectionConfig) {
    const url = joinEndpointPath(config.endpoint, config.route);
    // Secure stays secure: an `https:` OR `wss:` endpoint dials `wss:`. Anything
    // that is not http(s)/ws(s) is a misconfiguration, not a scheme to guess.
    const scheme = WS_SCHEME_BY_PROTOCOL[url.protocol];
    if (scheme === undefined) {
      throw new Error(`${config.caller}: endpoint must be http(s) or ws(s), got ${url.protocol}//`);
    }
    url.protocol = scheme;
    for (const [key, value] of Object.entries(config.query)) url.searchParams.set(key, value);
    this.url = url.toString();
    const headers = config.headers;
    this.headers = headers && Object.keys(headers).length > 0 ? headers : undefined;
    this.initialMs = config.backoff?.initialMs ?? DEFAULT_INITIAL_MS;
    this.maxMs = config.backoff?.maxMs ?? DEFAULT_MAX_MS;
    this.handshakeTimeoutMs = config.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;
    // Fail at construction, not on a timer: a consumer with nothing to dial
    // with is misconfigured, and a `failed` event minutes later says less.
    if (!this.headers && typeof globalThis.WebSocket !== "function") {
      throw new Error(
        `${config.caller}: no WebSocket implementation — this runtime has no global ` +
          "WebSocket (Node ≥ 22 or a browser), and only a stream opened with `headers` dials " +
          'the optional peer dependency "ws" instead',
      );
    }
  }

  /** True while the current attempt's socket is open. */
  get connected(): boolean {
    return this.attempt?.socket?.readyState === OPEN;
  }

  /** Epoch ms the CURRENT connection opened; undefined while not connected. */
  get connectedAt(): number | undefined {
    return this.connected ? this.attempt?.openedAt : undefined;
  }

  start(): void {
    void this.connect();
  }

  /** Tears the socket down and cancels any pending redial. No callback fires after it returns. Idempotent. */
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

  /** Ends the current attempt NOW and lets the normal redial path run. No-op when stopped or between attempts. */
  reconnectNow(): void {
    if (this.stopped) return;
    const attempt = this.attempt;
    if (attempt === undefined || attempt.settled || attempt.socket === undefined) return;
    this.settle(
      attempt,
      attempt.opened
        ? { type: "closed", reason: `reconnectNow frames=${String(attempt.frames)}` }
        : { type: "failed", reason: "reconnectNow before open" },
    );
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const attempt: Attempt = {
      id: ++this.attempts,
      socket: undefined,
      opened: false,
      openedAt: undefined,
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

    const context: StreamMessageContext = {
      connection: attempt.id,
      delivering: () => {
        // The first frame a connection delivers proves it productive and
        // resets the backoff.
        if (attempt.frames === 0) this.fruitlessAttempts = 0;
        attempt.frames++;
      },
    };

    socket.addEventListener("open", () => {
      if (attempt.settled) return;
      attempt.opened = true;
      attempt.openedAt = Date.now();
      this.clearHandshakeTimer(attempt);
      this.config.onEvent({ type: "opened" });
    });
    socket.addEventListener("message", (event) => {
      if (attempt.settled) return;
      this.config.onMessage(event.data, context);
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

  private settle(attempt: Attempt, event: StreamConnectionEvent): void {
    if (attempt.settled) return;
    if (this.attempt === attempt) this.attempt = undefined;
    this.teardown(attempt);
    // The ONLY writer of the counter besides delivery (which already reset it).
    if (attempt.frames === 0) {
      const quiet = this.config.quietHealthyAfterMs;
      const healthyQuiet =
        quiet !== undefined &&
        attempt.openedAt !== undefined &&
        Date.now() - attempt.openedAt >= quiet;
      if (healthyQuiet) this.fruitlessAttempts = 0;
      else this.fruitlessAttempts++;
    }
    // Redial is scheduled BEFORE the owner hears about it: a throwing
    // `onEvent` must not be able to leave the connection with no attempt, no
    // timer and `stopped === false` — connected to nothing, forever.
    this.scheduleReconnect();
    this.config.onEvent(event);
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== undefined) return;
    const delay = streamReconnectDelayMs(this.fruitlessAttempts, this.initialMs, this.maxMs);
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
    const socket = attempt.socket;
    if (socket === undefined) return;
    try {
      if (socket.terminate) socket.terminate();
      else socket.close();
    } catch {
      /* already gone */
    }
  }
}

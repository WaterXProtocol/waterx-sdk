/**
 * `openCanonicalStream` against a REAL WebSocket server on a loopback port —
 * connect, frame delivery, the per-ticker newest-timestamp guard, the drop
 * vocabulary, reconnect with capped backoff, handshake failures (404 /
 * timeout), `headers` through the optional `ws` peer, `stop()` and
 * `reconnectNow()`. Timings are shortened through the options; nothing here
 * sleeps on a wall-clock constant longer than a few hundred ms.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CANONICAL_MAX_FUTURE_DRIFT_MS,
  CANONICAL_MAX_SYMBOLS_PER_REQUEST,
  type CanonicalQuote,
} from "../../../src/oracle/canonical/frame.ts";
import {
  canonicalReconnectDelayMs,
  openCanonicalStream,
  type CanonicalConnectionEvent,
  type CanonicalStreamHandle,
  type CanonicalStreamOptions,
} from "../../../src/oracle/canonical/stream.ts";
import {
  startFakeCanonicalStreamServer,
  until,
  type FakeCanonicalStreamServer,
} from "../helpers/fake-canonical-stream-server.ts";
import { rawCanonicalQuote, rawUnavailableQuote } from "../helpers/fixtures/canonical.ts";

interface Harness {
  stream: CanonicalStreamHandle;
  frames: CanonicalQuote[];
  events: CanonicalConnectionEvent[];
}

const FAST = { backoff: { initialMs: 10, maxMs: 40 }, handshakeTimeoutMs: 200 } as const;
const TICKERS = ["BTCUSD", "ETHUSD"] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let server: FakeCanonicalStreamServer | undefined;
let harness: Harness | undefined;

function open(
  endpoint: string,
  extra: Partial<CanonicalStreamOptions> = {},
  tickers: readonly string[] = TICKERS,
): Harness {
  const frames: CanonicalQuote[] = [];
  const events: CanonicalConnectionEvent[] = [];
  const stream = openCanonicalStream({
    endpoint,
    tickers,
    onFrame: (quote) => frames.push(quote),
    onConnection: (event) => events.push(event),
    ...FAST,
    ...extra,
  });
  harness = { stream, frames, events };
  return harness;
}

const opened = (h: Harness) => h.events.filter((e) => e.type === "opened").length;

afterEach(async () => {
  harness?.stream.stop();
  harness = undefined;
  await server?.close();
  server = undefined;
  vi.doUnmock("ws");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("canonicalReconnectDelayMs (pure)", () => {
  const noJitter = () => 0;

  it("the first attempts wait the initial delay, then double, capped at maxMs", () => {
    expect(canonicalReconnectDelayMs(0, 1_000, 30_000, noJitter)).toBe(1_000);
    expect(canonicalReconnectDelayMs(1, 1_000, 30_000, noJitter)).toBe(1_000);
    expect(canonicalReconnectDelayMs(2, 1_000, 30_000, noJitter)).toBe(2_000);
    expect(canonicalReconnectDelayMs(3, 1_000, 30_000, noJitter)).toBe(4_000);
    expect(canonicalReconnectDelayMs(6, 1_000, 30_000, noJitter)).toBe(30_000);
  });

  it("the exponent is capped so a long outage cannot overflow to Infinity", () => {
    const delay = canonicalReconnectDelayMs(1_000, 1_000, 30_000, noJitter);
    expect(Number.isFinite(delay)).toBe(true);
    expect(delay).toBe(30_000);
  });

  it("jitter is PROPORTIONAL to the current delay: floor(random × delay × 0.2)", () => {
    expect(canonicalReconnectDelayMs(1, 1_000, 30_000, () => 0.5)).toBe(1_100);
    expect(canonicalReconnectDelayMs(6, 1_000, 30_000, () => 0.999)).toBe(30_000 + 5_994);
  });
});

describe("openCanonicalStream — connecting", () => {
  it("dials ws://<endpoint>/v1/canonical/stream?symbols=… and reports opened", async () => {
    server = await startFakeCanonicalStreamServer();
    const h = open(server.endpoint);

    await until(() => opened(h) === 1, "opened");

    expect(server.connects).toHaveLength(1);
    expect(server.connects[0]).toMatchObject({
      path: "/v1/canonical/stream",
      symbols: "BTCUSD,ETHUSD",
    });
    expect(h.stream.snapshot().connected).toBe(true);
  });

  it("an https endpoint dials wss (and a proxy base path survives)", () => {
    const dialed: string[] = [];
    class RecordingSocket {
      readyState = 0;
      constructor(url: string) {
        dialed.push(url);
      }
      addEventListener(): void {}
      close(): void {}
    }
    vi.stubGlobal("WebSocket", RecordingSocket);

    const h = open("https://app.example/api/quote-center/");
    h.stream.stop();

    expect(dialed).toEqual([
      "wss://app.example/api/quote-center/v1/canonical/stream?symbols=BTCUSD%2CETHUSD",
    ]);
  });

  it.each([
    ["wss://qc.example", "wss:"],
    ["ws://qc.example", "ws:"],
    ["http://qc.example", "ws:"],
  ])("%s dials %s — TLS is never downgraded", (endpoint, scheme) => {
    const dialed: string[] = [];
    class RecordingSocket {
      readyState = 0;
      constructor(url: string) {
        dialed.push(url);
      }
      addEventListener(): void {}
      close(): void {}
    }
    vi.stubGlobal("WebSocket", RecordingSocket);

    open(endpoint).stream.stop();

    expect(new URL(dialed[0]!).protocol).toBe(scheme);
  });

  it("a non-http(s)/ws(s) endpoint throws at open rather than guessing a scheme", () => {
    expect(() => open("ftp://qc.example")).toThrow(/must be http\(s\) or ws\(s\), got ftp:/);
    harness = undefined;
  });

  it("a throwing onConnection does not stop the stream: the redial is scheduled before the callback runs", async () => {
    type Listener = (event: unknown) => void;
    const sockets: FakeSocket[] = [];
    class FakeSocket {
      readyState = 0;
      listeners = new Map<string, Listener[]>();
      constructor() {
        sockets.push(this);
      }
      addEventListener(type: string, listener: Listener): void {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
      }
      close(): void {
        this.readyState = 3;
      }
      fire(type: string, event: unknown = {}): void {
        for (const listener of this.listeners.get(type) ?? []) listener(event);
      }
    }
    vi.stubGlobal("WebSocket", FakeSocket);

    const h = open("http://qc.example", {
      onConnection: (event) => {
        if (event.type === "closed") throw new Error("consumer bug");
      },
    });
    // Listeners attach after the (async) dial resolves — wait for them.
    await until(() => (sockets[0]?.listeners.size ?? 0) > 0, "listeners attached");
    sockets[0]!.readyState = 1;
    sockets[0]!.fire("open");
    // The consumer's throw escapes the socket's close listener (that is the
    // runtime's business), but the transport has already queued its redial.
    expect(() => sockets[0]!.fire("close", { code: 1006, reason: "" })).toThrow(/consumer bug/);
    await until(() => sockets.length === 2, "a second dial after the throwing callback");
  });

  it("throws synchronously when there is no WebSocket implementation to dial with", () => {
    vi.stubGlobal("WebSocket", undefined);
    expect(() => open("http://127.0.0.1:1")).toThrow(/no WebSocket implementation/);
    harness = undefined;
  });
});

describe("openCanonicalStream — frames", () => {
  async function connected(): Promise<Harness> {
    server = await startFakeCanonicalStreamServer();
    const h = open(server.endpoint);
    await until(() => opened(h) === 1, "opened");
    return h;
  }

  it("delivers an ok frame decoded (price_scaled as a string) and counts it", async () => {
    const h = await connected();

    server!.send(rawCanonicalQuote("BTCUSD"));
    await until(() => h.frames.length === 1, "one frame");

    expect(h.frames[0]).toMatchObject({
      symbol: "BTCUSD",
      status: "ok",
      price: 82996.7079006,
      price_scaled: "82996707900600",
      timestamp_ms: 1_791_425_996_375,
    });
    const snap = h.stream.snapshot();
    expect(snap.framesAccepted).toBe(1);
    expect(snap.lastFrameAt).toBeTypeOf("number");
  });

  it("delivers a status != ok frame with its reason, and a verdict at T does not block the ok price at T", async () => {
    const h = await connected();
    const T = 1_791_425_996_375;

    server!.send(rawUnavailableQuote("BTCUSD", "no_canonical_evaluation"));
    await until(() => h.frames.length === 1, "unavailable frame");
    expect(h.frames[0]).toMatchObject({ status: "unavailable", reason: "no_canonical_evaluation" });

    // An unavailable frame stamped T, then an ok frame stamped the SAME T: only
    // a key BELOW the watermark is out of order, and `duplicate` compares an ok
    // frame against the last delivered OK frame, so the price is still new.
    server!.send({ ...rawUnavailableQuote("BTCUSD", "weight_threshold"), timestamp_ms: T });
    server!.send(rawCanonicalQuote("BTCUSD", { timestamp_ms: T }));
    await until(() => h.frames.length === 3, "three frames");
    expect(h.frames[2]!.status).toBe("ok");
    expect(h.stream.snapshot().framesAccepted).toBe(3);
  });

  it("the guard: older ok → out_of_order, same ok → duplicate, older unavailable → out_of_order, unstamped unavailable → delivered", async () => {
    const h = await connected();
    const T = 1_791_425_996_375;

    server!.send(rawCanonicalQuote("BTCUSD", { timestamp_ms: T }));
    server!.send(rawCanonicalQuote("BTCUSD", { timestamp_ms: T - 1 })); // out_of_order
    server!.send(rawCanonicalQuote("BTCUSD", { timestamp_ms: T })); // duplicate
    server!.send({ ...rawUnavailableQuote("BTCUSD", "x"), timestamp_ms: T - 5 }); // out_of_order
    server!.send(rawUnavailableQuote("BTCUSD", "y")); // timestamp 0 ⇒ delivered
    server!.send({ ...rawUnavailableQuote("BTCUSD", "z"), timestamp_ms: T }); // ≥ mark ⇒ delivered
    server!.send(rawCanonicalQuote("BTCUSD", { timestamp_ms: T + 1 })); // delivered
    await until(() => h.frames.length === 4, "four delivered frames");

    expect(h.frames.map((f) => `${f.status}:${f.reason}:${String(f.timestamp_ms)}`)).toEqual([
      `ok::${String(T)}`,
      "unavailable:y:0",
      `unavailable:z:${String(T)}`,
      `ok::${String(T + 1)}`,
    ]);
    expect(h.stream.snapshot().droppedByReason).toMatchObject({ out_of_order: 2, duplicate: 1 });
    // Tickers are independent: ETHUSD at an OLDER stamp than BTCUSD's mark is fine.
    server!.send(rawCanonicalQuote("ETHUSD", { timestamp_ms: T - 1_000 }));
    await until(() => h.frames.length === 5, "ETHUSD frame");
  });

  it("unsolicited / malformed / non_positive_price / bad_timestamp are counted, not delivered", async () => {
    const h = await connected();

    server!.send(rawCanonicalQuote("DOGEUSD")); // unsolicited
    server!.send("{not json"); // malformed
    server!.send(rawCanonicalQuote("BTCUSD", { status: "stale" })); // malformed
    server!.send(rawCanonicalQuote("BTCUSD", { price: 0 })); // non_positive_price
    server!.send(
      rawCanonicalQuote("BTCUSD", {
        timestamp_ms: Date.now() + CANONICAL_MAX_FUTURE_DRIFT_MS + 60_000,
      }),
    ); // bad_timestamp
    await until(() => h.stream.snapshot().droppedByReason.bad_timestamp === 1, "drops tallied");

    expect(h.frames).toHaveLength(0);
    expect(h.stream.snapshot().droppedByReason).toEqual({
      malformed: 2,
      non_positive_price: 1,
      bad_timestamp: 1,
      unsolicited: 1,
      out_of_order: 0,
      duplicate: 0,
    });
    // A malformed frame is not socket ACTIVITY the owner should trust.
    expect(h.stream.snapshot().lastFrameAt).toBeUndefined();
  });

  it("a BINARY frame carrying UTF-8 JSON parses; garbage bytes are malformed", async () => {
    const h = await connected();

    server!.sendBinary(new TextEncoder().encode(JSON.stringify(rawCanonicalQuote("BTCUSD"))));
    await until(() => h.frames.length === 1, "binary frame decoded");
    server!.sendBinary(new Uint8Array([0xff, 0xfe, 0x00, 0x01]));
    await until(() => h.stream.snapshot().droppedByReason.malformed === 1, "garbage dropped");
  });
});

describe("openCanonicalStream — ordering on evaluated_at_ms (the server bridge's key)", () => {
  async function connected(): Promise<Harness> {
    server = await startFakeCanonicalStreamServer();
    const h = open(server.endpoint);
    await until(() => opened(h) === 1, "opened");
    return h;
  }
  const T = 1_791_425_996_375;
  const ok = (ts: number, evaluatedAt?: number) =>
    rawCanonicalQuote("BTCUSD", { timestamp_ms: ts, evaluated_at_ms: evaluatedAt });
  const unavailable = (reason: string, ts: number, evaluatedAt?: number) => ({
    ...rawUnavailableQuote("BTCUSD", reason),
    timestamp_ms: ts,
    ...(evaluatedAt === undefined ? {} : { evaluated_at_ms: evaluatedAt }),
  });
  const shape = (f: CanonicalQuote) =>
    `${f.status}:${String(f.timestamp_ms)}:${String(f.evaluated_at_ms)}`;

  it("a liveness verdict then a Lazer price whose feed time LAGS it are both delivered — evaluated_at_ms orders them", async () => {
    const h = await connected();

    server!.send(ok(T, T)); // clock-driven ok: price time = evaluation clock
    server!.send(unavailable("stale", T + 20, T + 20)); // liveness sweep at the evaluation clock
    server!.send(ok(T - 5, T + 30)); // Lazer ok: feed time older than BOTH, evaluated later
    server!.send(unavailable("weight_threshold", T - 3, T + 40)); // Lazer-driven verdict, feed time older than the last ok
    await until(() => h.frames.length === 4, "all four delivered");

    expect(h.frames.map(shape)).toEqual([
      `ok:${String(T)}:${String(T)}`,
      `unavailable:${String(T + 20)}:${String(T + 20)}`,
      `ok:${String(T - 5)}:${String(T + 30)}`,
      `unavailable:${String(T - 3)}:${String(T + 40)}`,
    ]);
    expect(h.stream.snapshot().droppedByReason).toMatchObject({ out_of_order: 0, duplicate: 0 });
  });

  it("a genuinely OLDER evaluation is out_of_order whatever its price time; the same evaluation re-sent is a duplicate", async () => {
    const h = await connected();

    server!.send(ok(T, T + 50));
    server!.send(ok(T + 100, T + 40)); // newer price time, older evaluation ⇒ out_of_order
    server!.send(unavailable("stale", T + 100, T + 45)); // older evaluation ⇒ out_of_order
    server!.send(ok(T, T + 50)); // same evaluation key as the last ok ⇒ duplicate
    server!.send(unavailable("stale", 0)); // key 0 ⇒ always delivered
    server!.send(ok(T + 1, T + 60));
    await until(() => h.frames.length === 3, "three delivered");

    expect(h.frames.map(shape)).toEqual([
      `ok:${String(T)}:${String(T + 50)}`,
      "unavailable:0:0",
      `ok:${String(T + 1)}:${String(T + 60)}`,
    ]);
    expect(h.stream.snapshot().droppedByReason).toMatchObject({ out_of_order: 2, duplicate: 1 });
  });

  it("a frame without evaluated_at_ms (a pre-field server) orders on timestamp_ms, against the same watermark", async () => {
    const h = await connected();

    server!.send(ok(T)); // key T
    server!.send(ok(T - 1)); // key T - 1 ⇒ out_of_order
    server!.send(ok(T + 10, 0)); // evaluated_at 0 ⇒ falls back: key T + 10
    server!.send(unavailable("stale", T + 5)); // key T + 5 < T + 10 ⇒ out_of_order
    server!.send(ok(T + 11)); // key T + 11
    await until(() => h.frames.length === 3, "three delivered");

    expect(h.frames.map((f) => f.timestamp_ms)).toEqual([T, T + 10, T + 11]);
    expect(h.stream.snapshot().droppedByReason).toMatchObject({ out_of_order: 2, duplicate: 0 });
  });
});

describe("openCanonicalStream — more than CANONICAL_MAX_SYMBOLS_PER_REQUEST tickers shard", () => {
  const MANY = Array.from(
    { length: CANONICAL_MAX_SYMBOLS_PER_REQUEST + 1 },
    (_, i) => `T${String(i).padStart(2, "0")}USD`,
  );

  it("33 tickers open TWO sockets of ≤32 behind one handle, and the snapshot aggregates them", async () => {
    server = await startFakeCanonicalStreamServer();
    const h = open(server.endpoint, {}, [...MANY, MANY[0]!]); // a repeat does not widen a shard

    await until(() => opened(h) === 2, "both shards opened");
    expect(server.connects).toHaveLength(2);
    const subscribed = server.connects.map((c) => c.symbols!.split(","));
    expect(subscribed.map((s) => s.length).sort((a, b) => b - a)).toEqual([32, 1]);
    expect(new Set(subscribed.flat())).toEqual(new Set(MANY));
    expect(h.stream.snapshot().connected).toBe(true);

    // The fake sends every frame to every socket: the shard that owns the
    // ticker delivers it, the other counts it unsolicited.
    server.send(rawCanonicalQuote(MANY[0]!));
    server.send(rawCanonicalQuote(MANY[32]!));
    await until(() => h.frames.length === 2, "one frame per shard");
    await until(() => h.stream.snapshot().droppedByReason.unsolicited === 2, "cross-shard drops");
    const snap = h.stream.snapshot();
    expect(snap.framesAccepted).toBe(2);
    expect(snap.lastFrameAt).toBeTypeOf("number");
    expect(new Set(h.frames.map((f) => f.symbol))).toEqual(new Set([MANY[0], MANY[32]]));
  });

  it("connected is false while any shard is down; reconnectNow and stop fan out", async () => {
    server = await startFakeCanonicalStreamServer();
    const h = open(server.endpoint, {}, MANY);
    await until(() => opened(h) === 2, "both shards opened");

    // Hold the dropped shard down (its redials 404) so "down" is observable.
    server.mode = "404";
    server.sockets[0]!.close(1012, "restart");
    await until(() => h.events.some((e) => e.type === "closed"), "one shard closed");
    expect(h.stream.snapshot().connected).toBe(false);
    server.mode = "serve";
    await until(() => opened(h) === 3 && h.stream.snapshot().connected, "shard redialled");
    const connectsBefore = server.connects.length;

    h.stream.reconnectNow();
    await until(() => opened(h) === 5, "both shards redialled");
    expect(server.connects).toHaveLength(connectsBefore + 2);

    h.stream.stop();
    await sleep(FAST.backoff.initialMs * 6);
    expect(server.connects).toHaveLength(connectsBefore + 2);
    expect(h.stream.snapshot().connected).toBe(false);
  });

  it("a shard's lifecycle events name the shard; an unsharded stream's do not", async () => {
    server = await startFakeCanonicalStreamServer();
    const h = open(server.endpoint, {}, MANY);
    await until(() => opened(h) === 2, "both shards opened");
    expect(h.events.map((e) => e.reason).sort()).toEqual(["shard 1/2", "shard 2/2"]);
    h.stream.stop();

    const single = open(server.endpoint, {}, MANY.slice(0, CANONICAL_MAX_SYMBOLS_PER_REQUEST));
    await until(() => opened(single) === 1, "unsharded opened");
    expect(single.events[0]).toEqual({ type: "opened" });
  });
});

describe("openCanonicalStream — connection lifecycle", () => {
  it("a server-side close is reported with code, delivered-frame count and reason, then the client redials", async () => {
    server = await startFakeCanonicalStreamServer();
    const h = open(server.endpoint);
    await until(() => opened(h) === 1, "opened");
    server.send(rawCanonicalQuote("BTCUSD"));
    await until(() => h.frames.length === 1, "frame");

    server.closeClients(1012, "restart");
    await until(() => opened(h) === 2, "reconnected");

    const closed = h.events.find((e) => e.type === "closed");
    expect(closed?.reason).toMatch(/^code=1012 frames=1 restart$/);
    expect(server.connects).toHaveLength(2);
  });

  it("a 404 handshake is a failed event — via ws (headers set) it names HTTP 404; via the global socket it does not", async () => {
    server = await startFakeCanonicalStreamServer("404");
    const withWs = open(server.endpoint, { headers: { "X-Internal-Key": "k" } });
    await until(() => withWs.events.length >= 1, "failed via ws");
    expect(withWs.events[0]).toEqual({ type: "failed", reason: "handshake answered HTTP 404" });
    // It keeps trying: the route may be deployed any moment.
    await server.waitForConnect(2);
    withWs.stream.stop();

    const viaGlobal = open(server.endpoint);
    await until(() => viaGlobal.events.length >= 1, "failed via global WebSocket");
    expect(viaGlobal.events[0]!.type).toBe("failed");
    expect(viaGlobal.events[0]!.reason).toBeTypeOf("string");
    expect(viaGlobal.events[0]!.reason).not.toMatch(/HTTP 404/);
  });

  it("headers ride the handshake (through the optional ws peer)", async () => {
    server = await startFakeCanonicalStreamServer();
    const h = open(server.endpoint, { headers: { "X-Internal-Key": "secret" } });

    await until(() => opened(h) === 1, "opened");

    expect(server.connects[0]!.headers["x-internal-key"]).toBe("secret");
    server.send(rawCanonicalQuote("BTCUSD"));
    await until(() => h.frames.length === 1, "frame over ws");
  });

  it("headers without the ws peer installed: ONE failed event naming the fix, then the stream stops", async () => {
    vi.doMock("ws", () => {
      throw new Error("Cannot find package 'ws'");
    });
    server = await startFakeCanonicalStreamServer();
    const h = open(server.endpoint, { headers: { "X-Internal-Key": "k" } });

    await until(() => h.events.length === 1, "failed");
    expect(h.events[0]!.type).toBe("failed");
    expect(h.events[0]!.reason).toMatch(/optional peer dependency "ws"/);
    await sleep(FAST.backoff.initialMs * 6);
    expect(h.events).toHaveLength(1);
    expect(server.connects).toHaveLength(0);
    expect(h.stream.snapshot().connected).toBe(false);
  });

  it("a handshake that never completes times out, fails, and redials", async () => {
    server = await startFakeCanonicalStreamServer("hang");
    const h = open(server.endpoint);

    await until(() => h.events.length >= 1, "timeout failure");
    expect(h.events[0]).toEqual({
      type: "failed",
      reason: `handshake timed out after ${String(FAST.handshakeTimeoutMs)}ms`,
    });
    await server.waitForConnect(2);
  });

  it("stop(): no event and no frame after it returns, and no redial", async () => {
    server = await startFakeCanonicalStreamServer();
    const h = open(server.endpoint);
    await until(() => opened(h) === 1, "opened");

    h.stream.stop();
    const eventsAtStop = h.events.length;
    server.send(rawCanonicalQuote("BTCUSD"));
    await until(
      () => server!.sockets[0]!.readyState === server!.sockets[0]!.CLOSED,
      "server saw close",
    );
    await sleep(FAST.backoff.initialMs * 6);

    expect(h.frames).toHaveLength(0);
    expect(h.events).toHaveLength(eventsAtStop);
    expect(server.connects).toHaveLength(1);
    expect(h.stream.snapshot().connected).toBe(false);
    h.stream.stop(); // idempotent
  });

  it("reconnectNow(): drops the socket, reports closed, redials", async () => {
    server = await startFakeCanonicalStreamServer();
    const h = open(server.endpoint);
    await until(() => opened(h) === 1, "opened");

    h.stream.reconnectNow();
    await until(() => opened(h) === 2, "redialled");

    expect(h.events.some((e) => e.type === "closed")).toBe(true);
    expect(server.connects).toHaveLength(2);
  });

  it("a connection that delivered a frame resets the backoff: the redial after it is prompt", async () => {
    server = await startFakeCanonicalStreamServer("404");
    const h = open(server.endpoint);
    // Climb the backoff on fruitless attempts first.
    await server.waitForConnect(3);
    server.mode = "serve";
    await until(() => opened(h) >= 1, "finally opened");
    server.send(rawCanonicalQuote("BTCUSD"));
    await until(() => h.frames.length === 1, "frame");

    const before = Date.now();
    server.closeClients(1000, "bye");
    await until(() => opened(h) >= 2, "prompt redial");

    // Reset ⇒ initialMs (+20% jitter), nowhere near the 40ms cap the climb had reached.
    expect(Date.now() - before).toBeLessThan(FAST.backoff.maxMs * 4);
  });
});

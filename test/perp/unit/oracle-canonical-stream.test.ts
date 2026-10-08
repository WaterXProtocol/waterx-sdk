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

  it("delivers a status != ok frame with its reason, and it does NOT move the ordering mark", async () => {
    const h = await connected();
    const T = 1_791_425_996_375;

    server!.send(rawUnavailableQuote("BTCUSD", "no_canonical_evaluation"));
    await until(() => h.frames.length === 1, "unavailable frame");
    expect(h.frames[0]).toMatchObject({ status: "unavailable", reason: "no_canonical_evaluation" });

    // An unavailable frame stamped T, then an ok frame stamped the SAME T: the
    // verdict never advanced the mark, so the price is still new.
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

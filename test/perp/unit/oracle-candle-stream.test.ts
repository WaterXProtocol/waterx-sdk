/**
 * `openCandleStream` against a REAL WebSocket server on a loopback port (the
 * canonical suite's fake, on the candle route) — the query, frame delivery,
 * the per-(symbol, tf) guard, the drop vocabulary, sharding with per-shard
 * status and per-shard redial, reconnect with backoff, handshake failures,
 * `headers` through the optional `ws` peer, `stop()` and `reconnectNow()`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CANDLE_MAX_SYMBOLS_PER_REQUEST,
  CANDLE_STREAM_ROUTE,
  type LiveCandleFrame,
} from "../../../src/oracle/candles/frame.ts";
import {
  openCandleStream,
  type CandleConnectionEvent,
  type CandleStreamHandle,
  type CandleStreamOptions,
} from "../../../src/oracle/candles/stream.ts";
import {
  startFakeCanonicalStreamServer,
  until,
  type FakeCanonicalStreamServer,
} from "../helpers/fake-canonical-stream-server.ts";
import { BUCKET_5M, rawLiveCandleFrame } from "../helpers/fixtures/candles.ts";

interface Harness {
  stream: CandleStreamHandle;
  frames: { frame: LiveCandleFrame; shard: number }[];
  events: CandleConnectionEvent[];
}

// The handshake budget is generous so a loaded CI runner cannot turn a slow open into a redial;
// the timeout test passes its own short one.
const FAST = { backoff: { initialMs: 10, maxMs: 40 }, handshakeTimeoutMs: 2_000 } as const;
const SHORT_HANDSHAKE_MS = 200;
const TICKERS = ["BTCUSD", "ETHUSD"] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let server: FakeCanonicalStreamServer | undefined;
let harness: Harness | undefined;

const startServer = (mode: FakeCanonicalStreamServer["mode"] = "serve") =>
  startFakeCanonicalStreamServer(mode, CANDLE_STREAM_ROUTE);

function open(
  endpoint: string,
  extra: Partial<CandleStreamOptions> = {},
  tickers: readonly string[] = TICKERS,
): Harness {
  const frames: Harness["frames"] = [];
  const events: CandleConnectionEvent[] = [];
  const stream = openCandleStream({
    endpoint,
    tickers,
    onFrame: (frame, shard) => frames.push({ frame, shard }),
    onConnection: (event) => events.push(event),
    ...FAST,
    ...extra,
  });
  harness = { stream, frames, events };
  return harness;
}

const opened = (h: Harness) => h.events.filter((e) => e.type === "opened").length;

async function connected(extra: Partial<CandleStreamOptions> = {}): Promise<Harness> {
  server = await startServer();
  const h = open(server.endpoint, extra);
  await until(() => opened(h) === 1, "opened");
  return h;
}

afterEach(async () => {
  harness?.stream.stop();
  harness = undefined;
  await server?.close();
  server = undefined;
  vi.doUnmock("ws");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("openCandleStream — connecting", () => {
  it("dials ws://<endpoint>/v1/candles/stream with ONE symbols and ONE tf field (all six by default)", async () => {
    const h = await connected();

    expect(server!.connects).toHaveLength(1);
    expect(server!.connects[0]).toMatchObject({
      path: "/v1/candles/stream",
      symbols: "BTCUSD,ETHUSD",
      tf: "1m,5m,15m,1h,4h,1d",
    });
    expect(h.events[0]).toEqual({
      type: "opened",
      shard: 0,
      shardCount: 1,
      tickers: ["BTCUSD", "ETHUSD"],
    });
    expect(h.stream.snapshot().connected).toBe(true);
    expect(h.stream.shardCount).toBe(1);
  });

  it("an https endpoint dials wss with a proxy base path; timeframes are de-duplicated", () => {
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

    open("https://app.example/api/quote-center/", { timeframes: ["1m", "5m", "1m"] }).stream.stop();

    expect(dialed).toHaveLength(1);
    const url = new URL(dialed[0]!);
    expect(`${url.protocol}//${url.host}${url.pathname}`).toBe(
      "wss://app.example/api/quote-center/v1/candles/stream",
    );
    expect(url.searchParams.getAll("symbols")).toEqual(["BTCUSD,ETHUSD"]);
    expect(url.searchParams.getAll("tf")).toEqual(["1m,5m"]);
  });

  it.each([
    ["no tickers", () => open("http://qc.example", {}, []), /at least one ticker/],
    ["only empty tickers", () => open("http://qc.example", {}, ["", " "]), /at least one ticker/],
    [
      "no timeframes",
      () => open("http://qc.example", { timeframes: [] }),
      /at least one timeframe/,
    ],
    [
      "an unknown timeframe",
      () => open("http://qc.example", { timeframes: ["2m" as never] }),
      /unknown timeframe "2m"/,
    ],
    [
      "a non-http(s)/ws(s) endpoint",
      () => open("ftp://qc.example"),
      /must be http\(s\) or ws\(s\)/,
    ],
  ])("%s throws at open, before anything dials", (_what, call, message) => {
    expect(call).toThrow(message);
    harness = undefined;
  });

  it("throws synchronously when there is no WebSocket implementation to dial with", () => {
    vi.stubGlobal("WebSocket", undefined);
    expect(() => open("http://127.0.0.1:1")).toThrow(/no WebSocket implementation/);
    harness = undefined;
  });
});

describe("openCandleStream — frames", () => {
  it("delivers a parsed frame with its shard and counts it", async () => {
    const h = await connected();

    server!.send(rawLiveCandleFrame());
    await until(() => h.frames.length === 1, "one frame");

    expect(h.frames[0]).toMatchObject({
      shard: 0,
      frame: { symbol: "BTCUSD", tf: "5m", bucket_ms: BUCKET_5M, state: "open", close: 83001.25 },
    });
    const snap = h.stream.snapshot();
    expect(snap.framesAccepted).toBe(1);
    expect(snap.lastFrameAt).toBeTypeOf("number");
    expect(snap.lastDeliveredAt).toBeTypeOf("number");
  });

  it("the guard per (symbol, tf): older → out_of_order, same key → duplicate, closed and void delivered", async () => {
    const h = await connected();
    const U = BUCKET_5M + 100_000;

    server!.send(rawLiveCandleFrame({ updated_at_ms: U }));
    server!.send(rawLiveCandleFrame({ updated_at_ms: U - 1 })); // out_of_order
    server!.send(rawLiveCandleFrame({ updated_at_ms: U })); // duplicate (a snapshot replay)
    server!.send(rawLiveCandleFrame({ state: "void", updated_at_ms: U + 1 })); // delivered
    server!.send(rawLiveCandleFrame({ state: "closed", updated_at_ms: U })); // closed > open/void
    server!.send(rawLiveCandleFrame({ updated_at_ms: U + 50 })); // open after closed ⇒ out_of_order
    // Pairs are independent: another tf, and another symbol, at an older stamp.
    server!.send(rawLiveCandleFrame({ tf: "1m", bucket_ms: BUCKET_5M, updated_at_ms: U - 10 }));
    server!.send(rawLiveCandleFrame({ symbol: "ETHUSD", updated_at_ms: U - 10 }));
    await until(() => h.frames.length === 5, "five delivered");

    expect(h.frames.map(({ frame }) => `${frame.symbol}:${frame.tf}:${frame.state}`)).toEqual([
      "BTCUSD:5m:open",
      "BTCUSD:5m:void",
      "BTCUSD:5m:closed",
      "BTCUSD:1m:open",
      "ETHUSD:5m:open",
    ]);
    expect(h.frames[1]!.frame.close).toBe(0);
    expect(h.stream.snapshot().droppedByReason).toMatchObject({ out_of_order: 2, duplicate: 1 });
  });

  it("unsolicited symbol or tf / malformed / bad_timestamp are counted, not delivered", async () => {
    const h = await connected({ timeframes: ["5m"] });

    server!.send(rawLiveCandleFrame({ symbol: "DOGEUSD" })); // unsolicited symbol
    server!.send(rawLiveCandleFrame({ tf: "1m" })); // unsolicited tf
    server!.send("{not json"); // malformed
    server!.send(rawLiveCandleFrame({ low: 1e9 })); // malformed
    server!.send(rawLiveCandleFrame({ updated_at_ms: Date.now() + 3_600_000 })); // bad_timestamp
    await until(() => h.stream.snapshot().droppedByReason.bad_timestamp === 1, "drops tallied");

    expect(h.frames).toHaveLength(0);
    expect(h.stream.snapshot().droppedByReason).toEqual({
      malformed: 2,
      bad_timestamp: 1,
      unsolicited: 2,
      out_of_order: 0,
      duplicate: 0,
    });
    expect(h.stream.snapshot().lastFrameAt).toBeUndefined();
  });

  it("a BINARY frame carrying UTF-8 JSON parses", async () => {
    const h = await connected();
    server!.sendBinary(new TextEncoder().encode(JSON.stringify(rawLiveCandleFrame())));
    await until(() => h.frames.length === 1, "binary frame decoded");
  });

  it("across a reconnect: the first equal frame per pair is delivered (a re-assertion), a second is a duplicate, an older one out_of_order", async () => {
    const h = await connected();
    const U = BUCKET_5M + 100_000;
    server!.send(rawLiveCandleFrame({ updated_at_ms: U }));
    server!.send(rawLiveCandleFrame({ updated_at_ms: U })); // same connection ⇒ duplicate
    await until(() => h.stream.snapshot().droppedByReason.duplicate === 1, "same-connection dup");

    server!.closeClients(1012, "restart");
    await until(() => opened(h) === 2, "reconnected");
    server!.send(rawLiveCandleFrame({ updated_at_ms: U })); // the new connection's snapshot
    server!.send(rawLiveCandleFrame({ updated_at_ms: U })); // re-sent again ⇒ duplicate
    server!.send(rawLiveCandleFrame({ updated_at_ms: U - 1 })); // older ⇒ out_of_order
    await until(() => h.stream.snapshot().droppedByReason.out_of_order === 1, "older dropped");

    expect(h.frames).toHaveLength(2);
    expect(h.stream.snapshot().droppedByReason).toMatchObject({ duplicate: 2, out_of_order: 1 });
  });

  it("tickers are trimmed like the server trims them, so their frames are not unsolicited", async () => {
    server = await startServer();
    const h = open(server.endpoint, {}, [" BTCUSD", "BTCUSD ", "  "]);
    await until(() => opened(h) === 1, "opened");
    expect(server.connects[0]!.symbols).toBe("BTCUSD");
    expect(h.events[0]!.tickers).toEqual(["BTCUSD"]);

    server.send(rawLiveCandleFrame());
    await until(() => h.frames.length === 1, "frame delivered");
    expect(h.stream.snapshot().droppedByReason.unsolicited).toBe(0);
  });
});

describe("openCandleStream — more than CANDLE_MAX_SYMBOLS_PER_REQUEST tickers shard", () => {
  const MANY = Array.from(
    { length: CANDLE_MAX_SYMBOLS_PER_REQUEST + 1 },
    (_, i) => `T${String(i).padStart(2, "0")}USD`,
  );

  it("33 tickers open TWO sockets of ≤32 (each with every tf); the snapshot lists each shard", async () => {
    server = await startServer();
    const h = open(server.endpoint, {}, [...MANY, MANY[0]!]);

    await until(() => opened(h) === 2, "both shards opened");
    expect(h.stream.shardCount).toBe(2);
    const subscribed = server.connects.map((c) => c.symbols!.split(","));
    expect(subscribed.map((s) => s.length).sort((a, b) => b - a)).toEqual([32, 1]);
    expect(new Set(subscribed.flat())).toEqual(new Set(MANY));
    expect(server.connects.every((c) => c.tf === "1m,5m,15m,1h,4h,1d")).toBe(true);
    expect(h.events.map((e) => `${String(e.shard)}/${String(e.shardCount)}`).sort()).toEqual([
      "0/2",
      "1/2",
    ]);

    server.send(rawLiveCandleFrame({ symbol: MANY[0]! }));
    await until(() => h.frames.length === 1, "shard 0 frame");
    await until(() => h.stream.snapshot().droppedByReason.unsolicited === 1, "cross-shard drop");

    const snap = h.stream.snapshot();
    expect(snap.connected).toBe(true);
    expect(snap.shards.map((s) => s.tickers.length)).toEqual([32, 1]);
    expect(h.frames[0]!.shard).toBe(0);
    // The idle signal: shard 0 delivered, shard 1 is silent — visible per shard only.
    expect(snap.shards[0]!.lastDeliveredAt).toBeTypeOf("number");
    expect(snap.shards[1]!.lastDeliveredAt).toBeUndefined();
    expect(snap.shards[1]!.connectedAt).toBeTypeOf("number");
    expect(snap.lastDeliveredAt).toBe(snap.shards[0]!.lastDeliveredAt);
  });

  it("reconnectNow(shard) redials that shard alone; reconnectNow() and stop fan out", async () => {
    server = await startServer();
    const h = open(server.endpoint, {}, MANY);
    await until(() => opened(h) === 2, "both shards opened");

    h.stream.reconnectNow(1);
    await until(() => opened(h) === 3, "shard 1 redialled");
    expect(h.events.filter((e) => e.type === "closed").map((e) => e.shard)).toEqual([1]);
    expect(server.connects).toHaveLength(3);

    h.stream.reconnectNow(99); // out of range: no-op
    h.stream.reconnectNow();
    await until(() => opened(h) === 5, "both shards redialled");
    const connectsBefore = server.connects.length;

    h.stream.stop();
    await sleep(FAST.backoff.initialMs * 6);
    expect(server.connects).toHaveLength(connectsBefore);
    const snap = h.stream.snapshot();
    expect(snap.connected).toBe(false);
    expect(snap.shards.every((s) => s.connectedAt === undefined)).toBe(true);
  });

  it("connected is false while any shard is down, and that shard says so", async () => {
    server = await startServer();
    const h = open(server.endpoint, {}, MANY);
    await until(() => opened(h) === 2, "both shards opened");

    server.mode = "404";
    server.sockets[0]!.close(1012, "restart");
    await until(() => h.events.some((e) => e.type === "closed"), "one shard closed");
    const snap = h.stream.snapshot();
    expect(snap.connected).toBe(false);
    expect(snap.shards.filter((s) => !s.connected)).toHaveLength(1);
    server.mode = "serve";
    await until(() => h.stream.snapshot().connected, "shard redialled");
  });
});

describe("openCandleStream — connection lifecycle", () => {
  it("a server-side close is reported with code, delivered-frame count and reason, then the client redials", async () => {
    const h = await connected();
    server!.send(rawLiveCandleFrame());
    await until(() => h.frames.length === 1, "frame");

    server!.closeClients(1012, "restart");
    await until(() => opened(h) === 2, "reconnected");

    const closed = h.events.find((e) => e.type === "closed");
    expect(closed).toEqual({
      type: "closed",
      reason: "code=1012 frames=1 restart",
      shard: 0,
      shardCount: 1,
      tickers: ["BTCUSD", "ETHUSD"],
    });
  });

  it("a 404 handshake via ws (headers set) names HTTP 404 and keeps retrying", async () => {
    server = await startServer("404");
    const h = open(server.endpoint, { headers: { "X-Internal-Key": "k" } });
    await until(() => h.events.length >= 1, "failed via ws");
    expect(h.events[0]).toMatchObject({ type: "failed", reason: "handshake answered HTTP 404" });
    await server.waitForConnect(2);
  });

  it("headers ride the handshake (through the optional ws peer)", async () => {
    const h = await connected({ headers: { "X-Internal-Key": "secret" } });
    expect(server!.connects[0]!.headers["x-internal-key"]).toBe("secret");
    server!.send(rawLiveCandleFrame());
    await until(() => h.frames.length === 1, "frame over ws");
  });

  it("headers without the ws peer installed: ONE failed event naming the fix, then the stream stops", async () => {
    vi.doMock("ws", () => {
      throw new Error("Cannot find package 'ws'");
    });
    server = await startServer();
    const h = open(server.endpoint, { headers: { "X-Internal-Key": "k" } });

    await until(() => h.events.length === 1, "failed");
    expect(h.events[0]!.reason).toMatch(/optional peer dependency "ws"/);
    await sleep(FAST.backoff.initialMs * 6);
    expect(h.events).toHaveLength(1);
    expect(server.connects).toHaveLength(0);
  });

  it("a handshake that never completes times out, fails, and redials", async () => {
    server = await startServer("hang");
    const h = open(server.endpoint, { handshakeTimeoutMs: SHORT_HANDSHAKE_MS });

    await until(() => h.events.length >= 1, "timeout failure");
    expect(h.events[0]).toMatchObject({
      type: "failed",
      reason: `handshake timed out after ${String(SHORT_HANDSHAKE_MS)}ms`,
    });
    await server.waitForConnect(2);
  });

  it("stop(): no event and no frame after it returns, and no redial", async () => {
    const h = await connected();

    h.stream.stop();
    const eventsAtStop = h.events.length;
    server!.send(rawLiveCandleFrame());
    await until(
      () => server!.sockets[0]!.readyState === server!.sockets[0]!.CLOSED,
      "server saw close",
    );
    await sleep(FAST.backoff.initialMs * 6);

    expect(h.frames).toHaveLength(0);
    expect(h.events).toHaveLength(eventsAtStop);
    expect(server!.connects).toHaveLength(1);
    expect(h.stream.snapshot().connected).toBe(false);
    h.stream.stop(); // idempotent
  });

  it("a connection that delivered a frame resets the backoff: the redial after it is prompt", async () => {
    // Wide enough apart that scheduler noise on a loaded runner cannot blur them:
    // after five fruitless attempts an un-reset delay would be ≥ 800 ms, a reset one ~50 ms.
    const backoff = { initialMs: 50, maxMs: 5_000 };
    server = await startServer("404");
    const h = open(server.endpoint, { backoff });
    await server.waitForConnect(5, 5_000);
    server.mode = "serve";
    await until(() => opened(h) >= 1, "finally opened", 5_000);
    server.send(rawLiveCandleFrame());
    await until(() => h.frames.length === 1, "frame");

    const before = Date.now();
    server.closeClients(1000, "bye");
    await until(() => opened(h) >= 2, "prompt redial", 5_000);
    expect(Date.now() - before).toBeLessThan(500);
  });
});

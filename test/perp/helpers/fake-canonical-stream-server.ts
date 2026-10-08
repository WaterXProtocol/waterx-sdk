/**
 * A REAL WebSocket server on a loopback port standing in for the quote-center's
 * `/v1/canonical/stream`. Reconnect, the ordering guard and frame validation
 * are transport behaviour, and a mocked socket would only certify the mock —
 * the same reasoning as the backend's `quote-center-price-stream.spec.ts`,
 * whose fake this ports. `ws` is a devDependency for exactly this: Node ships a
 * WebSocket CLIENT but no server.
 */
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";

import { CANONICAL_STREAM_ROUTE } from "../../../src/oracle/canonical/frame.ts";

export interface FakeConnect {
  path: string;
  symbols: string | null;
  headers: IncomingHttpHeaders;
}

export interface FakeCanonicalStreamServer {
  /** `http://127.0.0.1:<port>` — the client derives `ws://` from it. */
  endpoint: string;
  /**
   * `serve`: upgrade the stream route. `404`: answer every upgrade with HTTP
   * 404, as a gateway that does not carry the route would. `hang`: accept the
   * TCP connection and never answer the handshake. Mutable mid-test.
   */
  mode: "serve" | "404" | "hang";
  /** Every upgrade request seen, in order, whatever the mode answered. */
  connects: FakeConnect[];
  /** Server-side sockets of upgraded connections, oldest first. */
  sockets: WebSocket[];
  /** Send one frame to every open socket: a string verbatim, anything else `JSON.stringify`-ed. */
  send(frame: unknown): void;
  /** Send raw bytes as a BINARY frame. */
  sendBinary(bytes: Uint8Array): void;
  /** Close every open socket from the server side with a code + reason. */
  closeClients(code?: number, reason?: string): void;
  /** Resolves once `connects.length >= count`, or rejects after `timeoutMs`. */
  waitForConnect(count: number, timeoutMs?: number): Promise<void>;
  close(): Promise<void>;
}

/** Derived from the module under test, so a route edit cannot leave the fake serving the old path. */
const STREAM_PATH = `/${CANONICAL_STREAM_ROUTE}`;

/** Poll `predicate` every 5 ms until it holds, or fail naming `what` after `timeoutMs`. */
export async function until(
  predicate: () => boolean,
  what: string,
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

export async function startFakeCanonicalStreamServer(
  mode: FakeCanonicalStreamServer["mode"] = "serve",
): Promise<FakeCanonicalStreamServer> {
  const wss = new WebSocketServer({ noServer: true });
  const hung: Duplex[] = [];
  const server: Server = createServer((_req, res) => {
    res.statusCode = 404;
    res.end();
  });

  const forEachOpen = (fn: (ws: WebSocket) => void): void => {
    for (const ws of fake.sockets) if (ws.readyState === ws.OPEN) fn(ws);
  };
  const fake: FakeCanonicalStreamServer = {
    endpoint: "",
    mode,
    connects: [],
    sockets: [],
    send(frame) {
      const text = typeof frame === "string" ? frame : JSON.stringify(frame);
      forEachOpen((ws) => ws.send(text));
    },
    sendBinary(bytes) {
      forEachOpen((ws) => ws.send(bytes, { binary: true }));
    },
    closeClients(code = 1000, reason = "") {
      forEachOpen((ws) => ws.close(code, reason));
    },
    waitForConnect(count, timeoutMs) {
      return until(
        () => fake.connects.length >= count,
        `${String(count)} connect(s) at the fake quote-center`,
        timeoutMs,
      );
    },
    async close() {
      for (const ws of fake.sockets) ws.terminate();
      for (const socket of hung) socket.destroy();
      wss.close();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    fake.connects.push({
      path: url.pathname,
      symbols: url.searchParams.get("symbols"),
      headers: req.headers,
    });
    if (fake.mode === "hang") {
      hung.push(socket);
      return;
    }
    if (url.pathname !== STREAM_PATH || fake.mode === "404") {
      socket.end("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      fake.sockets.push(ws);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  fake.endpoint = `http://127.0.0.1:${String(address.port)}`;
  return fake;
}

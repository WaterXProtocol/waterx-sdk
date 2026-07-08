/**
 * E2E simulate client: async config load + optional gRPC retry wrapper.
 *
 * Network precedence:
 *   1. `--testnet` / `--mainnet` in `process.argv` (from `scripts/run-e2e.ts`)
 *   2. `WATERX_E2E_NETWORK`
 *   3. **testnet** (default; use `--mainnet` / env when canonical mainnet.json is ready)
 */
import { PerpClient } from "../../../../src/perp/client.ts";
import type { Network } from "../../../../src/perp/constants.ts";
import { resolveE2eNetwork, type E2eNetwork } from "./e2e-network.ts";
import { isGrpcTransientError } from "./transient-rpc.ts";

// Re-export the pure network resolver so existing `e2e-client` importers keep
// working; pure helpers should import it from `./e2e-network.ts` directly to
// avoid dragging in the eager `clientInit` below.
export { resolveE2eNetwork, type E2eNetwork };

const GRPC_RETRY_MAX_ATTEMPTS = (() => {
  const raw = process.env.WATERX_E2E_GRPC_RETRY_ATTEMPTS;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : 8;
})();

export function resolveE2eGrpcUrlOverride(): string | undefined {
  const raw = process.env.WATERX_E2E_GRPC_URL?.trim();
  return raw || undefined;
}

async function withGrpcRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < GRPC_RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isGrpcTransientError(e) || attempt === GRPC_RETRY_MAX_ATTEMPTS - 1) throw e;
      const base = Math.min(500 * 2 ** attempt, 15_000);
      const jitter = Math.floor(Math.random() * Math.min(base, 2_000));
      await new Promise((r) => setTimeout(r, base + jitter));
    }
  }
  throw new Error("withGrpcRateLimitRetry: unreachable");
}

export function wrapGrpcClientForE2eRetry<T extends object>(grpc: T): T {
  return new Proxy(grpc, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) =>
        withGrpcRateLimitRetry(async () => {
          const raw = Reflect.apply(value as (...a: unknown[]) => unknown, target, args);
          return await raw;
        });
    },
  }) as T;
}

export const e2eNetwork: E2eNetwork = resolveE2eNetwork();

function networkToClientKey(network: E2eNetwork): Network {
  return network === "mainnet" ? "MAINNET" : "TESTNET";
}

/** Shared client — assigned when {@link clientInit} completes. */
export let client!: PerpClient;

/** @alias client */
export let clientTxBuildersSimulate!: PerpClient;

let clientInitPromise: Promise<PerpClient> | undefined;

/**
 * Lazily build (once) the shared e2e client and resolve when it is ready
 * (Vitest e2e setup awaits this). Kept lazy — as a function, not an eager
 * top-level IIFE — so that merely importing this module has NO side effects:
 * pure helpers can pull in `resolveE2eGrpcUrlOverride` / `pythFeedIdsForE2e`
 * etc. without triggering a `PerpClient.create` (and its `loadConfig`, which
 * now requires a config URL). The config load happens only on first call.
 */
export function clientInit(): Promise<PerpClient> {
  if (!clientInitPromise) {
    clientInitPromise = (async () => {
      const grpcUrl = resolveE2eGrpcUrlOverride();
      const c = await PerpClient.create(networkToClientKey(e2eNetwork), {
        cache: true,
        ...(grpcUrl ? { grpcUrl } : {}),
      });
      c.grpcClient = wrapGrpcClientForE2eRetry(c.grpcClient);
      client = c;
      clientTxBuildersSimulate = c;
      return c;
    })();
  }
  return clientInitPromise;
}

export async function getE2eClient(): Promise<PerpClient> {
  return client ?? clientInit();
}

export function pythFeedIdsForE2e(c = client): Record<string, string> {
  const feeds = c.config.packages.pyth_rule?.feeds ?? {};
  const out: Record<string, string> = {};
  for (const [ticker, row] of Object.entries(feeds)) {
    if (row?.feed_id) out[ticker] = row.feed_id;
  }
  return out;
}

export function rawPrice(usd: number): bigint {
  return BigInt(Math.round(usd * 1e9));
}

export const DUMMY_SENDER = "0x1111111111111111111111111111111111111111111111111111111111111111";

export const PROBE_MIN_ACCOUNT_USDC: bigint = (() => {
  const raw = process.env.WATERX_E2E_PROBE_MIN_ACCOUNT_USDC;
  if (raw && /^\d+$/.test(raw)) return BigInt(raw);
  return 20_000_000n;
})();

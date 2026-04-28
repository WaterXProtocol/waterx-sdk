/**
 * E2E simulate client: resolve the target network for the current run.
 *
 * Precedence (highest → lowest):
 *   1. CLI flag passed through `process.argv` (`--testnet` / `--mainnet`) —
 *      set by `scripts/run-e2e.ts` and also honoured when someone runs the
 *      raw `vitest` binary with a trailing `-- --testnet`.
 *   2. `WATERX_E2E_NETWORK=testnet|mainnet` env var.
 *   3. **mainnet** (default — matches `scripts/run-e2e.ts`).
 */
import { PYTH_PRICE_FEED_IDS, PYTH_TESTNET_FEED_IDS, WaterXClient } from "@waterx/perp-sdk";

import { isGrpcTransientError } from "./transient-rpc.ts";

export type E2eNetwork = "testnet" | "mainnet";

const GRPC_RETRY_MAX_ATTEMPTS = (() => {
  const raw = process.env.WATERX_E2E_GRPC_RETRY_ATTEMPTS;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : 8;
})();

/**
 * Retry with exponential backoff + jitter so multiple vitest forks don't
 * resynchronise and re-hit the rate limit in lock-step.
 */
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

/**
 * Wrap the Mysten gRPC client so CI / long e2e runs survive transient
 * `RESOURCE_EXHAUSTED` on **any** method (not only `simulateTransaction` — e.g.
 * `BatchGetObjects`, `GetObject`, …).
 */
function wrapGrpcClientForE2eRetry<T extends object>(grpc: T): T {
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

export function resolveE2eNetwork(): E2eNetwork {
  const argv = process.argv ?? [];
  if (argv.includes("--testnet")) return "testnet";
  if (argv.includes("--mainnet")) return "mainnet";
  const raw = process.env.WATERX_E2E_NETWORK?.trim().toLowerCase();
  if (raw === "testnet") return "testnet";
  if (raw === "mainnet") return "mainnet";
  return "mainnet";
}

export const e2eNetwork: E2eNetwork = resolveE2eNetwork();

const clientBase = e2eNetwork === "mainnet" ? WaterXClient.mainnet() : WaterXClient.testnet();

clientBase.grpcClient = wrapGrpcClientForE2eRetry(clientBase.grpcClient);

export const client = clientBase;

/** @alias client */
export const clientTxBuildersSimulate = client;

/** Pyth Hermes feed id table for the active e2e network. */
export function pythFeedIdsForE2e(network: E2eNetwork = e2eNetwork): Record<string, string> {
  return network === "mainnet" ? PYTH_PRICE_FEED_IDS : PYTH_TESTNET_FEED_IDS;
}

/** Convert a human-readable USD price to 1e9-scaled bigint for test convenience. */
export function rawPrice(usd: number): bigint {
  return BigInt(Math.round(usd * 1e9));
}

/** Well-formed Sui address for `tx.setSender()` in dry-runs / PTB experiments (not a real custodial key). */
export const DUMMY_SENDER = "0x1111111111111111111111111111111111111111111111111111111111111111";

/**
 * Minimum account-object USDC balance required to pick a probe for
 * `buildOpenPositionTx` / `buildPlaceOrderTx` / compound `open + increase`
 * dry-runs.
 *
 * Rationale:
 * - `LIFECYCLE_TEST_MARKETS[*].simulateOpenCollateral` — majors 10 USDC; alt/xStocks often 5 USDC (see lifecycle table).
 * - Compound `open + increase` uses 10 + 5 = 15 USDC from the same account.
 * - Add small headroom to cope with mainnet accounts where balance is split
 *   across multiple TTO coin objects (PTB `coinWithBalance` selection).
 *
 * Override via env `WATERX_E2E_PROBE_MIN_ACCOUNT_USDC` (raw USDC, 6dp).
 */
export const PROBE_MIN_ACCOUNT_USDC: bigint = (() => {
  const raw = process.env.WATERX_E2E_PROBE_MIN_ACCOUNT_USDC;
  if (raw && /^\d+$/.test(raw)) return BigInt(raw);
  return 20_000_000n;
})();

/**
 * Wormhole / Wormholescan integration for the cross-chain credit bridge.
 *
 * Single source of truth for VAA discovery + (de)serialization — mirrors
 * `oracle/pyth.ts`'s role for Pyth's Hermes endpoint. Two directions:
 *
 *   - Mint (EVM → Sui): fetch the signed VAA for an EVM `Deposit` by
 *     (emitter chain, emitter address, sequence); the raw bytes feed
 *     `wormhole_bridge::redeem_vaa`.
 *   - Withdraw (Sui → EVM): list recent VAAs emitted by the bridge's
 *     `EmitterCap` to submit on the EVM side.
 *
 * Endpoints / chain ids come from `client.wormhole` (network defaults in
 * `WORMHOLE_DEFAULTS`, overridable via `WaterXConfig.wormhole`).
 */

import { fromBase64, toBase64, toHex } from "@mysten/bcs";

import type { PerpClient } from "../perp/client.ts";

// ============================================================================
// Emitter address formatting
// ============================================================================

/**
 * Normalize an emitter id to Wormholescan's `emitter` path segment:
 * 64-char lowercase hex, no `0x`. Accepts a 0x EVM address (left-padded to
 * 32 bytes) or a 32-byte Sui object id (the bridge `EmitterCap` id).
 */
export function toWormholescanEmitter(idOrAddress: string): string {
  const raw = idOrAddress.startsWith("0x") ? idOrAddress.slice(2) : idOrAddress;
  return raw.toLowerCase().padStart(64, "0");
}

/** EVM-side naming alias of {@link toWormholescanEmitter}. */
export const padEvmEmitter = toWormholescanEmitter;

// ============================================================================
// Wormholescan REST
// ============================================================================

export interface VaaResponse {
  /** Base64-encoded signed VAA. */
  vaa: string;
  sequence: number;
  emitterAddr: string;
  guardianSetIndex: number;
}

export interface VaaListItem {
  /** Wormholescan returns u64 as a string — keep it that way to avoid `number` precision loss. */
  sequence: string;
  /** Base64 VAA; absent until guardians have signed. */
  vaa?: string;
  emitterAddr?: string;
}

export interface WormholescanOptions {
  /** Override `fetch` (tests / non-global-fetch environments). */
  fetchImpl?: typeof fetch;
  /** Request timeout in ms. Default 10_000. */
  timeoutMs?: number;
}

async function doFetch(
  url: string,
  opts: (WormholescanOptions & { signal?: AbortSignal }) | undefined,
): Promise<Response> {
  const fetchImpl = opts?.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
  if (!fetchImpl) {
    throw new Error("wormhole: no global `fetch` available; pass opts.fetchImpl");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 10_000);
  const onOuterAbort = () => controller.abort();
  opts?.signal?.addEventListener("abort", onOuterAbort, { once: true });
  try {
    return await fetchImpl(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
    opts?.signal?.removeEventListener("abort", onOuterAbort);
  }
}

/**
 * Fetch a single signed VAA. Returns `null` while guardians haven't signed
 * it yet (HTTP 404 or no `vaa` field) so callers can retry on the next tick.
 */
export async function fetchVaa(
  apiBase: string,
  chainId: number,
  emitter: string,
  sequence: number | string | bigint,
  opts?: WormholescanOptions,
): Promise<VaaResponse | null> {
  const url = `${apiBase}/vaas/${chainId}/${emitter}/${sequence}`;
  const res = await doFetch(url, opts);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Wormholescan ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: VaaResponse };
  if (!json?.data?.vaa) return null;
  return json.data;
}

/**
 * List recent VAAs emitted by `emitter` on `chainId`, newest first. Used by
 * the burn relayer to discover Sui→EVM `WithdrawalInitiated` messages
 * (Wormholescan only returns guardian-signed VAAs, so the await is implicit).
 */
export async function listVaasByEmitter(
  apiBase: string,
  chainId: number,
  emitter: string,
  opts?: WormholescanOptions & { page?: number; pageSize?: number },
): Promise<VaaListItem[]> {
  const page = opts?.page ?? 0;
  const pageSize = opts?.pageSize ?? 20;
  const url = `${apiBase}/vaas/${chainId}/${emitter}?page=${page}&pageSize=${pageSize}`;
  const res = await doFetch(url, opts);
  if (!res.ok) {
    throw new Error(`Wormholescan list ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: VaaListItem[] };
  return json.data ?? [];
}

/** Poll {@link fetchVaa} until the VAA is signed or `timeoutMs` elapses. */
export async function waitForVaa(
  apiBase: string,
  chainId: number,
  emitter: string,
  sequence: number | string | bigint,
  opts: WormholescanOptions & {
    intervalMs?: number;
    timeoutMs?: number;
    onTick?: (attempt: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<VaaResponse> {
  const intervalMs = opts.intervalMs ?? 30_000;
  const timeoutMs = opts.timeoutMs ?? 25 * 60_000;
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < timeoutMs) {
    if (opts.signal?.aborted) throw new Error("waitForVaa: aborted");
    attempt++;
    opts.onTick?.(attempt);
    const vaa = await fetchVaa(apiBase, chainId, emitter, sequence, opts);
    if (vaa) return vaa;
    await abortableSleep(intervalMs, opts.signal);
  }
  throw new Error("waitForVaa: timeout");
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("waitForVaa: aborted"));
    };
    if (signal?.aborted) {
      clearTimeout(timer);
      reject(new Error("waitForVaa: aborted"));
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// ============================================================================
// VAA (de)serialization — portable (Node + edge/browser)
// ============================================================================

/** Base64 VAA → raw bytes (the form Sui `redeem_vaa(vector<u8>)` expects). */
export function vaaBase64ToBytes(b64: string): Uint8Array {
  return fromBase64(b64);
}

/** Raw bytes → base64 (round-trips a VAA pulled off-chain). */
export function vaaBytesToBase64(bytes: Uint8Array): string {
  return toBase64(bytes);
}

/** Base64 VAA → `0x`-prefixed hex (the form EVM `submitWithdrawalVAA(bytes)` expects). */
export function vaaBase64ToHex(b64: string): `0x${string}` {
  return `0x${toHex(fromBase64(b64))}` as `0x${string}`;
}

// ============================================================================
// Client-aware convenience
// ============================================================================

/**
 * Fetch the signed VAA for an inbound EVM `Deposit` using the client's
 * configured Wormholescan endpoint. `emitter` is the EVM-side bridge
 * address (0x form accepted — left-padded automatically); `chainId` is the
 * source EVM chain's Wormhole chain id.
 */
export function fetchDepositVaa(
  client: PerpClient,
  evmWormholeChainId: number,
  evmEmitter: string,
  sequence: number | string | bigint,
  opts?: WormholescanOptions,
): Promise<VaaResponse | null> {
  return fetchVaa(
    client.wormhole.wormholescan_api,
    evmWormholeChainId,
    toWormholescanEmitter(evmEmitter),
    sequence,
    opts,
  );
}

/**
 * List recent Sui→EVM VAAs from the configured bridge `EmitterCap` (burn
 * relayer). Requires `packages.wormhole_bridge.emitter_cap` in config.
 */
export function listBridgeWithdrawalVaas(
  client: PerpClient,
  opts?: WormholescanOptions & { page?: number; pageSize?: number },
): Promise<VaaListItem[]> {
  const emitterCap = client.config.packages.wormhole_bridge?.emitter_cap;
  if (!emitterCap) {
    throw new Error("wormhole_bridge.emitter_cap missing from config");
  }
  return listVaasByEmitter(
    client.wormhole.wormholescan_api,
    client.wormhole.sui_chain_id,
    toWormholescanEmitter(emitterCap),
    opts,
  );
}

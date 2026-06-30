import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PredictClient } from "~predict/client.ts";
import {
  getAccountData,
  getAccountOrderIds,
  getAccountOrderIdsByMarketId,
  getAccountPositionIdsByMarketId,
  getMarketById,
  getMarketByKey,
  getOrder,
  getOrderCursor,
  getPosition,
  getPositionCursor,
  getRegistry,
  getResolvedMarketCursor,
  getUnresolvedMarketCursor,
} from "~predict/fetch.ts";
import type { CursorView, OrderView, PositionView } from "~predict/types.ts";
import { toBigInt } from "~predict/utils.ts";

import { E2E_DEFAULT_ACCOUNT_ID } from "../fixtures/e2e-fixtures.ts";
import { readFixtureOverrides } from "./e2e-env.ts";
import { resolveAccountOwner } from "./simulate.ts";
import {
  discoverBestWalletCoin,
  type DiscoveredWalletCoin,
  type WalletCoinSource,
} from "./wallet-coin-discovery.ts";

/** Where each fixture field was resolved (for skip messages and debugging). */
export interface E2eDiscoveryMeta {
  accountId: string;
  accountReady: string;
  orderId?: string;
  positionId?: string;
  marketKey?: string;
  marketId?: string;
  usdCoinObjectId?: string;
  walletCoinSource?: WalletCoinSource;
  openPositionId?: string;
  pendingClosePositionId?: string;
  claimMarketId?: string;
  claimablePositionId?: string;
}

export interface E2eFixtures {
  /** Best account id for PTB args (discovered or default). */
  accountId: string;
  /** True when `getAccountData` reports `hasData` for the active account. */
  accountReady: boolean;
  /** Legacy: an order id (any OPEN order belonging to the active account). Prefer `openOrderId`. */
  orderId?: bigint;
  /** Legacy: a position id (any position belonging to the active account). Prefer the specific fields below. */
  positionId?: bigint;
  /** Legacy: market key from cursor / order / position view. Prefer `openMarketIdHex` / `claimMarketIdHex`. */
  marketKey?: bigint;
  /** Legacy: market id hex (matches `marketKey`). Prefer the specific fields below. */
  marketIdHex?: string;
  /** Legacy: market id bytes (matches `marketIdHex`). */
  marketIdBytes?: Uint8Array;
  /** Settlement coin object for deposit / payment PTBs (discovered via `listCoins` when possible). */
  usdCoinObjectId?: string;
  /** Rich wallet coin discovery (settlement USD or MOCK_USDC + coin type). */
  walletCoin?: DiscoveredWalletCoin;

  /** Order id that is currently OPEN on an unresolved market (selfCancelOrder, keeper-style sims). */
  openOrderId?: bigint;
  /** Position id with status=OPEN (requestClose target). */
  openPositionId?: bigint;
  /** Position id with status=PENDING_CLOSE (selfCancelClose target). */
  pendingClosePositionId?: bigint;
  /** Position id on a resolved market with non-null outcome (claim target). */
  claimablePositionId?: bigint;
  /** Unresolved market id hex (placeOrder / requestClose target). */
  openMarketIdHex?: string;
  openMarketIdBytes?: Uint8Array;
  /** Resolved market id hex (claim target). */
  claimMarketIdHex?: string;
  claimMarketIdBytes?: Uint8Array;
  /** OPEN order whose expiry + cooldown have BOTH elapsed (selfCancelOrder rescue precondition). */
  expiredOpenOrderId?: bigint;
  /** PENDING_CLOSE position whose close-order expiry + cooldown have elapsed (selfCancelClose rescue). */
  expiredPendingClosePositionId?: bigint;
  /** A settlement coin object **owned by the AdminCap holder** — used by depositSettlement / adminPlaceOrderFor dry-run. */
  adminUsdCoinObjectId?: string;
  /** AdminCap-holder wallet coin (settlement USD only — admin PTBs require `Coin<::usd::USD>`). */
  adminWalletCoin?: DiscoveredWalletCoin;

  meta: E2eDiscoveryMeta;
}

const SEED_FIXTURE_PATH = resolve(process.cwd(), "test/prediction/fixtures/testnet-seeded.json");

interface SeedFixtureFile {
  owner?: string;
  keeper?: string;
  accountId?: string;
  openMarketIdHex?: string;
  openOrderId?: string;
  openPositionId?: string;
  pendingClosePositionId?: string;
  claimMarketIdHex?: string;
  claimPositionId?: string;
  claimMarketOutcome?: string;
  expiredOpenOrderId?: string;
  expiredPendingClosePositionId?: string;
}

function readSeedFixture(): SeedFixtureFile | undefined {
  if (!existsSync(SEED_FIXTURE_PATH)) return undefined;
  try {
    return JSON.parse(readFileSync(SEED_FIXTURE_PATH, "utf8")) as SeedFixtureFile;
  } catch {
    return undefined;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function sampleIdsFromCursor(cursor: CursorView, maxSamples = 8): bigint[] {
  if (cursor.count === 0n || cursor.front == null) return [];
  const ids: bigint[] = [];
  const back = cursor.back ?? cursor.front;
  for (let id = cursor.front; id <= back && ids.length < maxSamples; id += 1n) {
    ids.push(id);
  }
  if (cursor.back != null && !ids.includes(cursor.back)) {
    ids.push(cursor.back);
  }
  return ids.slice(0, maxSamples);
}

async function loadOrder(client: PredictClient, orderId: bigint): Promise<OrderView | undefined> {
  try {
    return await getOrder(client, { orderId });
  } catch {
    return undefined;
  }
}

async function loadPosition(
  client: PredictClient,
  positionId: bigint,
): Promise<PositionView | undefined> {
  try {
    return await getPosition(client, { positionId });
  } catch {
    return undefined;
  }
}

async function accountHasData(client: PredictClient, accountId: string): Promise<boolean> {
  try {
    const data = await getAccountData(client, { accountId });
    return data.hasData;
  } catch {
    return false;
  }
}

async function isMarketResolved(
  client: PredictClient,
  marketIdBytes: Uint8Array,
): Promise<boolean> {
  try {
    const m = await getMarketById(client, { marketId: marketIdBytes });
    return m.resolved;
  } catch {
    return false;
  }
}

async function discoverAnyOrderId(client: PredictClient): Promise<bigint | undefined> {
  const cursor = await getOrderCursor(client);
  if (cursor.count === 0n || cursor.front == null) return undefined;
  const back = cursor.back ?? cursor.front;
  const fromBack = await loadOrder(client, back);
  if (fromBack) return back;
  for (const id of sampleIdsFromCursor(cursor, 32)) {
    const o = await loadOrder(client, id);
    if (o) return id;
  }
  const stop = back - 32n > cursor.front ? back - 32n : cursor.front;
  for (let id = back; id >= stop; id -= 1n) {
    const o = await loadOrder(client, id);
    if (o) return id;
    if (id === 0n) break;
  }
  return undefined;
}

/** Any order id belonging to `accountId` (OPEN or historical — for fetch read tests). */
async function discoverAnyOrderIdForAccount(
  client: PredictClient,
  accountId: string,
  marketKey?: bigint,
): Promise<bigint | undefined> {
  if (marketKey !== undefined) {
    try {
      const ids = await getAccountOrderIds(client, { accountId, marketKey });
      if (ids.length > 0) {
        const last = ids[ids.length - 1]!;
        if (await loadOrder(client, last)) return last;
      }
    } catch {
      /* ignore */
    }
  }
  const cursor = await getOrderCursor(client);
  if (cursor.count === 0n || cursor.front == null) return undefined;
  const back = cursor.back ?? cursor.front;
  const stop = back - 64n > cursor.front ? back - 64n : cursor.front;
  for (let id = back; id >= stop; id -= 1n) {
    const o = await loadOrder(client, id);
    if (o && o.accountId === accountId) return id;
    if (id === 0n) break;
  }
  return undefined;
}

async function discoverWalletCoinForAccount(
  client: PredictClient,
  accountId: string,
): Promise<DiscoveredWalletCoin | undefined> {
  try {
    const owner = await resolveAccountOwner(client, accountId);
    return discoverBestWalletCoin(client, owner);
  } catch {
    return undefined;
  }
}

/** Look up a settlement `Coin<USD>` or MOCK_USDC owned by the AdminCap holder. */
async function discoverAdminWalletCoin(
  client: PredictClient,
): Promise<DiscoveredWalletCoin | undefined> {
  try {
    const cap = client.predictionAdminCap();
    const res = await client.grpcClient.getObject({ objectId: cap });
    const owner = res.object?.owner;
    if (!owner || owner.$kind !== "AddressOwner") return undefined;
    return discoverBestWalletCoin(client, owner.AddressOwner);
  } catch {
    return undefined;
  }
}

function settlementPaymentCoinId(coin: DiscoveredWalletCoin | undefined): string | undefined {
  if (!coin) return undefined;
  if (coin.source === "mock-usdc") return undefined;
  return coin.objectId;
}

/** Scan up to `maxSamples` recent positions for the active account, bucketed by status. */
async function scanAccountPositions(
  client: PredictClient,
  accountId: string,
  maxSamples = 16,
): Promise<{
  open: PositionView[];
  pendingClose: PositionView[];
  /** Positions on resolved markets — eligible for `claim`. */
  claimable: PositionView[];
}> {
  const cursor = await getPositionCursor(client);
  const out = {
    open: [] as PositionView[],
    pendingClose: [] as PositionView[],
    claimable: [] as PositionView[],
  };
  if (cursor.count === 0n || cursor.front == null) return out;
  // Walk back-to-front so we hit the most recently seeded positions first.
  const back = cursor.back ?? cursor.front;
  const stop = back - BigInt(maxSamples) > cursor.front ? back - BigInt(maxSamples) : cursor.front;
  for (let id = back; id >= stop; id -= 1n) {
    const p = await loadPosition(client, id);
    if (!p || p.accountId !== accountId) {
      if (id === 0n) break;
      continue;
    }
    if (p.status === "PENDING_CLOSE") out.pendingClose.push(p);
    else if (p.status === "OPEN") {
      const resolved = await isMarketResolved(client, p.marketId);
      if (resolved) out.claimable.push(p);
      else out.open.push(p);
    }
    if (id === 0n) break;
  }
  return out;
}

/** Scan up to `maxSamples` recent orders; return any OPEN orders for the account. */
async function scanAccountOpenOrders(
  client: PredictClient,
  accountId: string,
  maxSamples = 16,
): Promise<OrderView[]> {
  const cursor = await getOrderCursor(client);
  if (cursor.count === 0n || cursor.front == null) return [];
  const out: OrderView[] = [];
  const back = cursor.back ?? cursor.front;
  const stop = back - BigInt(maxSamples) > cursor.front ? back - BigInt(maxSamples) : cursor.front;
  for (let id = back; id >= stop; id -= 1n) {
    const o = await loadOrder(client, id);
    if (o && o.accountId === accountId && o.kind === "OPEN") out.push(o);
    if (id === 0n) break;
  }
  return out;
}

/**
 * Discovery v2: prefers fixtures from `test/prediction/fixtures/testnet-seeded.json` when available,
 * falls back to walking the registry cursors. Returns rich per-state fixtures so tests can
 * pick the exact slot they need without re-walking the chain.
 */
/**
 * Process-level cache keyed by the client config — when vitest runs e2e files in a single fork
 * (see `vitest.config.ts`), all 11 test files share this cache and only one discovery actually
 * hits the public testnet RPC. Without this, parallel `beforeAll` calls would burst the RPC and
 * trip its 429 rate limit. Stored as an in-flight Promise so concurrent callers de-duplicate.
 */
const discoveryCache = new Map<string, Promise<E2eFixtures>>();

function cacheKey(client: PredictClient): string {
  return [
    client.network,
    client.config.grpcUrl ?? "",
    client.packageId(),
    client.marketRegistry(),
    client.accountRegistry(),
    client.settlementCoinType(),
  ].join("|");
}

export async function discoverFixtures(client: PredictClient): Promise<E2eFixtures> {
  const key = cacheKey(client);
  const cached = discoveryCache.get(key);
  if (cached) return cached;
  const promise = discoverFixturesUncached(client).catch((err) => {
    // Don't poison the cache with a failed discovery — let the next call retry.
    discoveryCache.delete(key);
    throw err;
  });
  discoveryCache.set(key, promise);
  return promise;
}

/** Test-only — let suites force a fresh on-chain scan instead of reusing the cached result. */
export function clearDiscoveryCache(): void {
  discoveryCache.clear();
}

async function discoverFixturesUncached(client: PredictClient): Promise<E2eFixtures> {
  const env = readFixtureOverrides();
  const seed = readSeedFixture();
  await getRegistry(client);

  // ----- Resolve accountId ---------------------------------------------------
  const accountId =
    env.accountId ??
    seed?.accountId ??
    (await discoverAccountFromOrders(client)) ??
    E2E_DEFAULT_ACCOUNT_ID;

  const accountReady = await accountHasData(client, accountId);

  // ----- Resolve markets (open + claim) --------------------------------------
  let openMarketIdHex: string | undefined;
  let openMarketIdBytes: Uint8Array | undefined;
  let claimMarketIdHex: string | undefined;
  let claimMarketIdBytes: Uint8Array | undefined;

  if (seed?.openMarketIdHex) {
    openMarketIdHex = seed.openMarketIdHex;
    openMarketIdBytes = hexToBytes(seed.openMarketIdHex);
  }
  if (seed?.claimMarketIdHex) {
    const bytes = hexToBytes(seed.claimMarketIdHex);
    if (await isMarketResolved(client, bytes)) {
      claimMarketIdHex = seed.claimMarketIdHex;
      claimMarketIdBytes = bytes;
    }
  }

  // Legacy fallbacks (any unresolved/resolved market from cursors).
  if (!openMarketIdHex) {
    const unresolved = await getUnresolvedMarketCursor(client);
    for (const key of sampleIdsFromCursor(unresolved, 4)) {
      try {
        const m = await getMarketByKey(client, { marketKey: key });
        openMarketIdHex = m.marketIdHex;
        openMarketIdBytes = m.marketId;
        break;
      } catch {
        /* ignore */
      }
    }
  }
  if (!claimMarketIdHex) {
    const resolved = await getResolvedMarketCursor(client);
    for (const key of sampleIdsFromCursor(resolved, 4)) {
      try {
        const m = await getMarketByKey(client, { marketKey: key });
        claimMarketIdHex = m.marketIdHex;
        claimMarketIdBytes = m.marketId;
        break;
      } catch {
        /* ignore */
      }
    }
  }

  // ----- Account-scoped state ------------------------------------------------
  let openOrderId: bigint | undefined;
  let openPositionId: bigint | undefined;
  let pendingClosePositionId: bigint | undefined;
  let claimablePositionId: bigint | undefined;
  let expiredOpenOrderId: bigint | undefined;
  let expiredPendingClosePositionId: bigint | undefined;

  if (accountReady) {
    // Try seed-pinned ids first (cheap path).
    if (seed?.openOrderId) {
      const o = await loadOrder(client, BigInt(seed.openOrderId));
      if (o && o.accountId === accountId && o.kind === "OPEN") openOrderId = o.orderId;
    }
    if (seed?.openPositionId) {
      const p = await loadPosition(client, BigInt(seed.openPositionId));
      if (p && p.accountId === accountId && p.status === "OPEN") openPositionId = p.positionId;
    }
    if (seed?.pendingClosePositionId) {
      const p = await loadPosition(client, BigInt(seed.pendingClosePositionId));
      if (p && p.accountId === accountId && p.status === "PENDING_CLOSE")
        pendingClosePositionId = p.positionId;
    }
    if (seed?.claimPositionId) {
      const p = await loadPosition(client, BigInt(seed.claimPositionId));
      if (p && p.accountId === accountId && p.status === "OPEN") {
        if (await isMarketResolved(client, p.marketId)) claimablePositionId = p.positionId;
      }
    }
    const nowMs = BigInt(Date.now());
    if (seed?.expiredOpenOrderId) {
      const o = await loadOrder(client, BigInt(seed.expiredOpenOrderId));
      if (
        o &&
        o.accountId === accountId &&
        o.kind === "OPEN" &&
        o.expiryTs < nowMs &&
        o.selfCancelAfterTs < nowMs
      ) {
        expiredOpenOrderId = o.orderId;
      }
    }
    if (seed?.expiredPendingClosePositionId) {
      const p = await loadPosition(client, BigInt(seed.expiredPendingClosePositionId));
      if (
        p &&
        p.accountId === accountId &&
        p.status === "PENDING_CLOSE" &&
        p.closeExpiryTs < nowMs &&
        p.closeSelfCancelAfterTs < nowMs
      ) {
        expiredPendingClosePositionId = p.positionId;
      }
    }

    // Cursor scan to fill in any gaps (idempotent — cheap on small testnets).
    const needsCursorScan =
      openOrderId === undefined ||
      openPositionId === undefined ||
      pendingClosePositionId === undefined ||
      claimablePositionId === undefined ||
      expiredOpenOrderId === undefined ||
      expiredPendingClosePositionId === undefined;
    if (needsCursorScan) {
      const positions = await scanAccountPositions(client, accountId);
      if (openPositionId === undefined && positions.open.length > 0) {
        const preferred = positions.open.find((p) => p.filledShares >= 2n) ?? positions.open[0]!;
        openPositionId = preferred.positionId;
      } else if (openPositionId !== undefined && positions.open.length > 0) {
        const current = await loadPosition(client, openPositionId);
        const preferred = positions.open.find((p) => p.filledShares >= 2n);
        if (current && current.filledShares < 2n && preferred && preferred.filledShares >= 2n) {
          openPositionId = preferred.positionId;
        }
      }
      if (pendingClosePositionId === undefined && positions.pendingClose[0])
        pendingClosePositionId = positions.pendingClose[0].positionId;
      if (claimablePositionId === undefined && positions.claimable[0]) {
        claimablePositionId = positions.claimable[0].positionId;
        if (!claimMarketIdHex) {
          claimMarketIdHex = positions.claimable[0].marketIdHex;
          claimMarketIdBytes = positions.claimable[0].marketId;
        }
      }
      if (openOrderId === undefined) {
        const orders = await scanAccountOpenOrders(client, accountId);
        if (orders[0]) {
          openOrderId = orders[0].orderId;
          if (!openMarketIdHex) {
            openMarketIdHex = orders[0].marketIdHex;
            openMarketIdBytes = orders[0].marketId;
          }
        }
      }
      if (expiredOpenOrderId === undefined) {
        const nowMs = BigInt(Date.now());
        const cursor = await getOrderCursor(client);
        const back = cursor.back ?? cursor.front;
        if (back != null && cursor.front != null) {
          const stop = back - 32n > cursor.front ? back - 32n : cursor.front;
          for (let id = back; id >= stop; id -= 1n) {
            const o = await loadOrder(client, id);
            if (
              o &&
              o.accountId === accountId &&
              o.kind === "OPEN" &&
              o.expiryTs < nowMs &&
              o.selfCancelAfterTs < nowMs
            ) {
              expiredOpenOrderId = o.orderId;
              break;
            }
            if (id === 0n) break;
          }
        }
      }
      if (expiredPendingClosePositionId === undefined) {
        const nowMs = BigInt(Date.now());
        for (const p of positions.pendingClose) {
          if (p.closeExpiryTs < nowMs && p.closeSelfCancelAfterTs < nowMs) {
            expiredPendingClosePositionId = p.positionId;
            break;
          }
        }
      }
    }
  }

  // env overrides (highest priority for legacy compat)
  const envOrderId = env.orderId !== undefined ? toBigInt(env.orderId) : undefined;
  const envPositionId = env.positionId !== undefined ? toBigInt(env.positionId) : undefined;
  const envMarketKey = env.marketKey !== undefined ? toBigInt(env.marketKey) : undefined;
  let orderId = envOrderId ?? openOrderId;
  if (orderId === undefined && seed?.openOrderId) {
    const seeded = await loadOrder(client, BigInt(seed.openOrderId));
    if (seeded) orderId = seeded.orderId;
  }
  const positionId =
    envPositionId ?? openPositionId ?? pendingClosePositionId ?? claimablePositionId;

  // Legacy market fields point at the open market by default.
  let marketKey = envMarketKey;
  let marketIdHex = openMarketIdHex ?? claimMarketIdHex;
  let marketIdBytes = openMarketIdBytes ?? claimMarketIdBytes;
  if (marketIdBytes && marketKey === undefined) {
    try {
      const m = await getMarketById(client, { marketId: marketIdBytes });
      marketKey = m.marketKey;
    } catch {
      /* ignore */
    }
  }
  if (env.marketId !== undefined) {
    try {
      const m = await getMarketById(client, { marketId: env.marketId });
      marketIdHex = m.marketIdHex;
      marketIdBytes = m.marketId;
      marketKey = m.marketKey;
    } catch {
      /* ignore */
    }
  }

  if (orderId === undefined) {
    orderId = await discoverAnyOrderIdForAccount(client, accountId, marketKey);
  }
  if (orderId === undefined) {
    orderId = await discoverAnyOrderId(client);
  }

  // ----- Wallet coins (settlement USD, else MOCK_USDC for PSM deposit) ---------
  let walletCoin: DiscoveredWalletCoin | undefined;
  if (env.usdCoinObjectId) {
    walletCoin = await discoverWalletCoinForAccount(client, accountId);
    if (!walletCoin || walletCoin.objectId !== env.usdCoinObjectId) {
      walletCoin = {
        objectId: env.usdCoinObjectId,
        coinType: client.settlementCoinType(),
        source: "env-override",
        balance: 1_000_000n,
      };
    }
  } else {
    walletCoin = await discoverWalletCoinForAccount(client, accountId);
  }
  const usdCoinObjectId = walletCoin?.objectId;
  const adminWalletCoin = await discoverAdminWalletCoin(client);
  const adminUsdCoinObjectId = settlementPaymentCoinId(adminWalletCoin);

  // ----- Fallback for accounts with pinned env but unscanned content --------
  if (env.accountId && marketIdBytes) {
    if (orderId === undefined && openOrderId === undefined) {
      try {
        const ids = await getAccountOrderIdsByMarketId(client, {
          accountId,
          marketId: marketIdBytes,
        });
        if (ids.length > 0) openOrderId = ids[0];
      } catch {
        /* ignore */
      }
    }
    if (positionId === undefined && openPositionId === undefined) {
      try {
        const ids = await getAccountPositionIdsByMarketId(client, {
          accountId,
          marketId: marketIdBytes,
        });
        if (ids.length > 0) openPositionId = ids[0];
      } catch {
        /* ignore */
      }
    }
  }

  const meta: E2eDiscoveryMeta = {
    accountId: env.accountId
      ? "override:E2E_ACCOUNT_ID"
      : seed?.accountId
        ? "seed-fixture"
        : "discovered:chain",
    accountReady: accountReady ? "hasData=true" : "hasData=false",
    orderId: env.orderId
      ? "override:E2E_ORDER_ID"
      : openOrderId !== undefined
        ? seed?.openOrderId
          ? "seed-fixture"
          : "discovered:order_cursor"
        : undefined,
    positionId: env.positionId
      ? "override:E2E_POSITION_ID"
      : openPositionId !== undefined || pendingClosePositionId !== undefined
        ? seed?.openPositionId || seed?.pendingClosePositionId
          ? "seed-fixture"
          : "discovered:position_cursor"
        : undefined,
    marketKey: env.marketKey
      ? "override:E2E_MARKET_KEY"
      : marketKey !== undefined
        ? "discovered:market_cursor"
        : undefined,
    marketId: env.marketId
      ? "override:E2E_MARKET_ID"
      : marketIdBytes !== undefined
        ? "discovered:market_view"
        : undefined,
    usdCoinObjectId: env.usdCoinObjectId
      ? "override:E2E_USD_COIN_OBJECT_ID"
      : walletCoin !== undefined
        ? walletCoin.source === "mock-usdc"
          ? "discovered:listCoins:mock-usdc"
          : "discovered:listCoins:settlement-usd"
        : undefined,
    walletCoinSource: walletCoin?.source,
    openPositionId:
      openPositionId !== undefined
        ? seed?.openPositionId
          ? "seed-fixture"
          : "discovered:position_cursor"
        : undefined,
    pendingClosePositionId:
      pendingClosePositionId !== undefined
        ? seed?.pendingClosePositionId
          ? "seed-fixture"
          : "discovered:position_cursor"
        : undefined,
    claimMarketId:
      claimMarketIdHex !== undefined
        ? seed?.claimMarketIdHex
          ? "seed-fixture"
          : "discovered:resolved_market_cursor"
        : undefined,
    claimablePositionId:
      claimablePositionId !== undefined
        ? seed?.claimPositionId
          ? "seed-fixture"
          : "discovered:resolved+open"
        : undefined,
  };

  return {
    accountId,
    accountReady,
    orderId,
    positionId,
    marketKey,
    marketIdHex,
    marketIdBytes,
    usdCoinObjectId,
    walletCoin,
    openOrderId,
    openPositionId,
    pendingClosePositionId,
    claimablePositionId,
    openMarketIdHex,
    openMarketIdBytes,
    claimMarketIdHex,
    claimMarketIdBytes,
    expiredOpenOrderId,
    expiredPendingClosePositionId,
    adminUsdCoinObjectId,
    adminWalletCoin,
    meta,
  };
}

/** Best-effort: walk the order cursor and use the first OPEN order's accountId. */
async function discoverAccountFromOrders(client: PredictClient): Promise<string | undefined> {
  const cursor = await getOrderCursor(client);
  for (const id of sampleIdsFromCursor(cursor, 4)) {
    const o = await loadOrder(client, id);
    if (o) return o.accountId;
  }
  const posCursor = await getPositionCursor(client);
  for (const id of sampleIdsFromCursor(posCursor, 4)) {
    const p = await loadPosition(client, id);
    if (p) return p.accountId;
  }
  return undefined;
}

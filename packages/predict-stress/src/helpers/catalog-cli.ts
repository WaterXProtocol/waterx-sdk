/**
 * Vitest-free catalog place + fill for tsx CLI scripts.
 */
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "@waterx/sdk/prediction/client";
import { getOrder } from "@waterx/sdk/prediction/fetch";
import { fillOrder, placeOrder } from "@waterx/sdk/prediction/prediction";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { INTEGRATION_MIN_FILL } from "../fixtures/ptb-params.ts";
import {
  buildPlaceBetRequest,
  type PlaceBetCredentials,
  type PlaceBetRequestBody,
  type TradeableCatalogMarket,
  type TxBuildResponseData,
} from "./api-catalog-pure.ts";
import { apiPost } from "./api-client.ts";
import type { ApiEnvironment } from "./api-env.ts";
import {
  BrokerFillTimeoutError,
  CatalogBrokerFillTimeoutError,
  catalogFillBrokerOnly,
  DEFAULT_CATALOG_BROKER_ONLY_WAIT_MS,
  DEFAULT_CATALOG_KEEPER_FALLBACK_WAIT_MS,
} from "./catalog-fill-policy.ts";
import { eventsFromResult, findEvent } from "./events-core.ts";
import {
  keeperFillTargetCost,
  placeCapsFromOrderPlacedEvent,
  type PlaceCaps,
} from "./fill-economics-core.ts";
import { executeAndFetch, type IntegrationCtx } from "./integration-setup.ts";
import { findChainEventByOrderId } from "./query-prediction-events.ts";
import {
  readBrokerFriendlyPlaceOptions,
  readStagingMaxSpend,
  readStagingMaxSpendBase,
} from "./staging-amounts.ts";
import { assertSuccessfulExecution, transactionDigest } from "./tx-result.ts";

export {
  BrokerFillTimeoutError,
  catalogFillBrokerOnly,
  CatalogBrokerFillTimeoutError,
  DEFAULT_CATALOG_BROKER_ONLY_WAIT_MS,
  DEFAULT_CATALOG_KEEPER_FALLBACK_WAIT_MS,
  hasCatalogKeeperFallbackEnabled,
  isCatalogBrokerFillTimeout,
} from "./catalog-fill-policy.ts";

/** @deprecated Prefer {@link DEFAULT_CATALOG_KEEPER_FALLBACK_WAIT_MS} when keeper fallback is on. */
export const DEFAULT_CATALOG_BROKER_WAIT_MS = DEFAULT_CATALOG_KEEPER_FALLBACK_WAIT_MS;

export type CatalogFillSource = "bypass" | "broker" | "keeper";

/** Segmented wall-clock for one catalog bet (POST /place → fill observed). */
export interface CatalogBetTiming {
  /** `POST /predict/bets/place` round-trip. */
  buildMs: number;
  /** Sign + execute place tx until `OrderPlaced` confirmed. */
  placeTxMs: number;
  /** Place tx confirmed → first `OrderFilled` seen (broker wall + poll granularity). */
  fillDetectMs: number;
  /** Keeper `fillOrder` execute only — set when local keeper fallback runs. */
  keeperFillMs?: number;
  /** Full flow from POST /place start. */
  totalMs: number;
  fillPolls?: number;
  fillPollIntervalMs?: number;
}

export interface CatalogMarketBetOutcome {
  segment: string;
  marketSlug: string;
  sideKey?: string;
  orderId: bigint;
  positionId: bigint;
  placeDigest?: string;
  fillDigest?: string;
  brokerFilled: boolean;
  /** Ms from place tx confirmed → OrderFilled observed (same as `timing.fillDetectMs`). */
  fillLatencyMs: number;
  fillSource: CatalogFillSource;
  timing?: CatalogBetTiming;
}

/** Place only — leave order OPEN for backend broker / frontend watch. */
export interface CatalogPlaceOnlyOutcome {
  segment: string;
  marketSlug: string;
  sideKey?: string;
  orderId: bigint;
  placeDigest?: string;
  maxSpend: string;
  /** Set when place tx already included OrderFilled (bypass). */
  positionId?: bigint;
  alreadyFilled: boolean;
}

export function formatFillLatency(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1_000).toFixed(2)}s`;
}

export function formatCatalogBetTiming(t: CatalogBetTiming): string {
  const parts = [
    `build=${formatFillLatency(t.buildMs)}`,
    `placeTx=${formatFillLatency(t.placeTxMs)}`,
    `fill=${formatFillLatency(t.fillDetectMs)}`,
    `total=${formatFillLatency(t.totalMs)}`,
  ];
  if (t.keeperFillMs != null) parts.push(`keeperFill=${formatFillLatency(t.keeperFillMs)}`);
  if (t.fillPolls != null) parts.push(`polls=${t.fillPolls}`);
  if (t.fillPollIntervalMs != null) parts.push(`pollEvery=${t.fillPollIntervalMs}ms`);
  return parts.join(" ");
}

/** Shorten Sui execute errors for CLI (avoid URL-encoded object-lock spam). */
export function formatCatalogCliError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  let msg = raw;
  try {
    msg = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  const lockIdx = msg.indexOf("already locked by a different transaction");
  if (lockIdx >= 0) {
    return "Sui object lock conflict — same wallet cannot place txs in parallel; use sequential place (default) or lower E2E_PLACE_ALL_CONCURRENCY";
  }
  if (msg.length > 280) return `${msg.slice(0, 277)}…`;
  return msg;
}

export interface CatalogPlacePending {
  segment: string;
  marketSlug: string;
  sideKey?: string;
  orderId: bigint;
  placeDigest?: string;
  placeCaps: PlaceCaps;
  placeDoneAt: number;
  flowStartedAt: number;
  timing: Pick<CatalogBetTiming, "buildMs" | "placeTxMs">;
}

function marketIdHexToBytes(marketId: string): Uint8Array {
  const clean = marketId.startsWith("0x") ? marketId.slice(2) : marketId;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function executePlaceTxBytes(
  client: PredictClient,
  signer: Ed25519Keypair,
  txBytes: string,
): Promise<unknown> {
  const tx = Transaction.from(txBytes);
  const result = await client.signAndExecuteTransaction({
    signer,
    transaction: tx,
    include: { effects: true, objectTypes: true, events: true },
  });
  assertSuccessfulExecution(result);
  const digest = transactionDigest(result);
  if (digest) {
    await client.waitForTransaction(digest);
    return await client.grpcClient.getTransaction({ digest, include: { events: true } });
  }
  return result;
}

export async function executeCatalogPlace(
  ctx: IntegrationCtx,
  body: PlaceBetRequestBody,
  txBytes: string,
  sponsored: boolean | undefined,
): Promise<unknown> {
  if (sponsored) {
    return executeAndFetch(ctx.client, ctx.signer, (tx) => {
      placeOrder(ctx.client, tx, {
        accountId: body.accountId,
        marketId: marketIdHexToBytes(body.marketId),
        selection: body.selection,
        maxSpend: BigInt(body.maxSpend),
        minShares: BigInt(body.minShares),
        priceCapBps: BigInt(body.priceCapBps),
        expiryTs: BigInt(body.expiryTs),
      });
    });
  }
  return executePlaceTxBytes(ctx.client, ctx.signer, txBytes);
}

async function tryLoadOpenOrder(client: PredictClient, orderId: bigint): Promise<boolean> {
  try {
    const order = await getOrder(client, { orderId });
    return order.kind === "OPEN";
  } catch {
    return false;
  }
}

async function waitForCatalogFill(
  ctx: IntegrationCtx,
  orderId: bigint,
  options?: {
    brokerWaitMs?: number;
    placeCaps?: PlaceCaps;
    placeDoneAt?: number;
    /** When true, only poll for backend broker fill — never call local `fillOrder`. */
    brokerOnly?: boolean;
  },
): Promise<{
  positionId: bigint;
  brokerFilled: boolean;
  fillResult?: unknown;
  fillLatencyMs: number;
  fillSource: CatalogFillSource;
  fillPolls: number;
  fillPollIntervalMs: number;
  keeperFillMs?: number;
}> {
  const brokerOnly = catalogFillBrokerOnly(options?.brokerOnly);
  const brokerWaitMs =
    options?.brokerWaitMs ??
    (brokerOnly ? DEFAULT_CATALOG_BROKER_ONLY_WAIT_MS : DEFAULT_CATALOG_KEEPER_FALLBACK_WAIT_MS);
  const placeDoneAt = options?.placeDoneAt ?? Date.now();
  const deadline = Date.now() + brokerWaitMs;
  const pollIntervalMs = Math.min(1_000, Math.max(250, Math.floor(brokerWaitMs / 6)));
  let fillPolls = 0;

  const brokerFill = (positionId: bigint, keeperFillMs?: number) => ({
    positionId,
    brokerFilled: true,
    fillLatencyMs: Date.now() - placeDoneAt,
    fillSource: "broker" as const,
    fillPolls,
    fillPollIntervalMs: pollIntervalMs,
    keeperFillMs,
  });

  while (Date.now() < deadline) {
    fillPolls += 1;
    const filled = await findChainEventByOrderId(ctx.client, EVENT_CONTRACT.OrderFilled, orderId);
    if (filled) {
      return brokerFill(BigInt(String(filled.json.position_id)));
    }
    const stillOpen = await tryLoadOpenOrder(ctx.client, orderId);
    if (!stillOpen) {
      const late = await findChainEventByOrderId(ctx.client, EVENT_CONTRACT.OrderFilled, orderId);
      if (late) {
        return brokerFill(BigInt(String(late.json.position_id)));
      }
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  if (brokerOnly) {
    throw new CatalogBrokerFillTimeoutError(orderId, brokerWaitMs);
  }

  if (!ctx.keeper) {
    throw new Error(
      `order ${orderId} still OPEN after ${brokerWaitMs}ms and no keeper signer — broker may be down`,
    );
  }

  const fillArgs = options?.placeCaps
    ? keeperFillTargetCost(options.placeCaps, readStagingMaxSpendBase())
    : INTEGRATION_MIN_FILL;

  let fillResult: unknown;
  const keeperFillStart = Date.now();
  try {
    fillResult = await executeAndFetch(ctx.client, ctx.keeper, (tx) => {
      fillOrder(ctx.client, tx, { orderId, ...fillArgs });
    });
  } catch (err) {
    const late = await findChainEventByOrderId(ctx.client, EVENT_CONTRACT.OrderFilled, orderId);
    if (late) {
      return brokerFill(BigInt(String(late.json.position_id)));
    }
    throw err;
  }
  const keeperFillMs = Date.now() - keeperFillStart;

  const ev = findEvent(eventsFromResult(fillResult), EVENT_CONTRACT.OrderFilled.suffix);
  if (!ev) {
    throw new Error(`keeper fill for order ${orderId} did not emit OrderFilled`);
  }
  return {
    positionId: BigInt(String(ev.json.position_id)),
    brokerFilled: false,
    fillResult,
    fillLatencyMs: Date.now() - placeDoneAt,
    fillSource: "keeper",
    fillPolls,
    fillPollIntervalMs: pollIntervalMs,
    keeperFillMs,
  };
}

function assertTxBuildSuccess(envelope: {
  success: boolean;
  data?: TxBuildResponseData;
  error?: { message?: string };
}): asserts envelope is { success: true; data: TxBuildResponseData } {
  if (!envelope.success || !envelope.data?.txBytes) {
    throw new Error(
      `POST /predict/bets/place failed: ${envelope.error?.message ?? "missing txBytes"}`,
    );
  }
}

/** Place one catalog bet and exit — no fill wait, no local keeper fallback. */
export async function placeCatalogMarketOnly(
  ctx: IntegrationCtx,
  apiEnv: ApiEnvironment,
  market: TradeableCatalogMarket,
  creds: PlaceBetCredentials,
  options?: { maxSpend?: string },
): Promise<CatalogPlaceOnlyOutcome> {
  const { target } = market;
  const body = buildPlaceBetRequest(
    creds,
    target.side,
    readBrokerFriendlyPlaceOptions({ maxSpend: options?.maxSpend }),
  );
  const { status, envelope } = await apiPost<TxBuildResponseData>(
    apiEnv,
    "/predict/bets/place",
    body,
  );
  const sideLabel = target.side.key ?? target.side.trade?.selection ?? "?";
  if (status < 200 || status >= 300) {
    throw new Error(`POST /predict/bets/place ${market.marketSlug} (${sideLabel}): HTTP ${status}`);
  }
  assertTxBuildSuccess(envelope);

  const placeResult = await executeCatalogPlace(
    ctx,
    body,
    envelope.data.txBytes,
    envelope.data.sponsored,
  );
  const placed = findEvent(eventsFromResult(placeResult), EVENT_CONTRACT.OrderPlaced.suffix);
  if (!placed) {
    throw new Error(`place tx for ${market.marketSlug} (${sideLabel}) did not emit OrderPlaced`);
  }
  const orderId = BigInt(String(placed.json.order_id));
  const bypassFill = findEvent(eventsFromResult(placeResult), EVENT_CONTRACT.OrderFilled.suffix);

  return {
    segment: market.segment,
    marketSlug: market.marketSlug,
    sideKey: target.side.key,
    orderId,
    placeDigest: transactionDigest(placeResult),
    maxSpend: body.maxSpend,
    positionId: bypassFill ? BigInt(String(bypassFill.json.position_id)) : undefined,
    alreadyFilled: Boolean(bypassFill),
  };
}

/**
 * Place one catalog market on-chain. Returns bypass outcome or pending wait state.
 * Same wallet must call this sequentially — parallel sign+execute causes Sui object locks.
 */
export async function placeCatalogMarketTx(
  ctx: IntegrationCtx,
  apiEnv: ApiEnvironment,
  market: TradeableCatalogMarket,
  creds: PlaceBetCredentials,
  options?: { maxSpend?: string },
): Promise<CatalogMarketBetOutcome | CatalogPlacePending> {
  const flowStartedAt = Date.now();
  const { target } = market;
  const body = buildPlaceBetRequest(
    creds,
    target.side,
    readBrokerFriendlyPlaceOptions({ maxSpend: options?.maxSpend }),
  );
  const buildStart = Date.now();
  const { status, envelope } = await apiPost<TxBuildResponseData>(
    apiEnv,
    "/predict/bets/place",
    body,
  );
  const buildMs = Date.now() - buildStart;
  const sideLabel = target.side.key ?? target.side.trade?.selection ?? "?";
  if (status < 200 || status >= 300) {
    throw new Error(`POST /predict/bets/place ${market.marketSlug} (${sideLabel}): HTTP ${status}`);
  }
  assertTxBuildSuccess(envelope);

  const placeTxStart = Date.now();
  const placeResult = await executeCatalogPlace(
    ctx,
    body,
    envelope.data.txBytes,
    envelope.data.sponsored,
  );
  const placeTxMs = Date.now() - placeTxStart;
  const placeDoneAt = Date.now();
  const placed = findEvent(eventsFromResult(placeResult), EVENT_CONTRACT.OrderPlaced.suffix);
  if (!placed) {
    throw new Error(`place tx for ${market.marketSlug} (${sideLabel}) did not emit OrderPlaced`);
  }
  const orderId = BigInt(String(placed.json.order_id));

  const bypassFill = findEvent(eventsFromResult(placeResult), EVENT_CONTRACT.OrderFilled.suffix);
  if (bypassFill) {
    const totalMs = Date.now() - flowStartedAt;
    return {
      segment: market.segment,
      marketSlug: market.marketSlug,
      sideKey: target.side.key,
      orderId,
      positionId: BigInt(String(bypassFill.json.position_id)),
      placeDigest: transactionDigest(placeResult),
      brokerFilled: true,
      fillLatencyMs: 0,
      fillSource: "bypass",
      timing: { buildMs, placeTxMs, fillDetectMs: 0, totalMs },
    };
  }

  return {
    segment: market.segment,
    marketSlug: market.marketSlug,
    sideKey: target.side.key,
    orderId,
    placeDigest: transactionDigest(placeResult),
    placeCaps: placeCapsFromOrderPlacedEvent(placed),
    placeDoneAt,
    flowStartedAt,
    timing: { buildMs, placeTxMs },
  };
}

/** Poll broker (or keeper fallback) for a resting order placed via `placeCatalogMarketTx`. */
export async function completeCatalogMarketFill(
  ctx: IntegrationCtx,
  pending: CatalogPlacePending,
  options?: { brokerWaitMs?: number; brokerOnly?: boolean },
): Promise<CatalogMarketBetOutcome> {
  const fill = await waitForCatalogFill(ctx, pending.orderId, {
    placeCaps: pending.placeCaps,
    brokerWaitMs: options?.brokerWaitMs,
    placeDoneAt: pending.placeDoneAt,
    brokerOnly: options?.brokerOnly,
  });

  const fillDetectMs = fill.fillLatencyMs;
  return {
    segment: pending.segment,
    marketSlug: pending.marketSlug,
    sideKey: pending.sideKey,
    orderId: pending.orderId,
    positionId: fill.positionId,
    placeDigest: pending.placeDigest,
    fillDigest: fill.fillResult ? transactionDigest(fill.fillResult) : undefined,
    brokerFilled: fill.brokerFilled,
    fillLatencyMs: fillDetectMs,
    fillSource: fill.fillSource,
    timing: {
      buildMs: pending.timing.buildMs,
      placeTxMs: pending.timing.placeTxMs,
      fillDetectMs,
      keeperFillMs: fill.keeperFillMs,
      totalMs: Date.now() - pending.flowStartedAt,
      fillPolls: fill.fillPolls,
      fillPollIntervalMs: fill.fillPollIntervalMs,
    },
  };
}

/** Place + fill one catalog market at staging bet amount (default $1.11). */
export async function placeAndFillCatalogMarket(
  ctx: IntegrationCtx,
  apiEnv: ApiEnvironment,
  market: TradeableCatalogMarket,
  creds: PlaceBetCredentials,
  options?: { maxSpend?: string; brokerWaitMs?: number; brokerOnly?: boolean },
): Promise<CatalogMarketBetOutcome> {
  const placed = await placeCatalogMarketTx(ctx, apiEnv, market, creds, options);
  if ("positionId" in placed) return placed;
  return completeCatalogMarketFill(ctx, placed, options);
}

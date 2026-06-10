/**
 * Staging refund probe: tight `priceCapBps` → OrderCancelled + full wxa refund.
 */
import { getOrder } from "~predict/fetch.ts";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { formatSettlementBase, getAccountSettlementBalance } from "./account-balance.ts";
import {
  buildPlaceBetRequest,
  formatCatalogPlaceFailures,
  listTradeableCatalogBets,
  oddsCentsToUnfillablePriceCapBps,
  type CatalogPlaceFailure,
  type PlaceBetCredentials,
  type PlaceBetRequestBody,
  type TradeableCatalogMarket,
  type TxBuildResponseData,
} from "./api-catalog-pure.ts";
import { apiPost } from "./api-client.ts";
import type { ApiEnvironment } from "./api-env.ts";
import { executeCatalogPlace } from "./catalog-cli.ts";
import { optionalEnv } from "./e2e-env.ts";
import { eventsFromResult, findEvent } from "./events-core.ts";
import type { IntegrationCtx } from "./integration-setup.ts";
import { findChainEventByOrderId } from "./query-prediction-events.ts";
import { readBrokerFriendlyPlaceOptions, readStagingMaxSpend } from "./staging-amounts.ts";
import { transactionDigest } from "./tx-result.ts";

export function hasCatalogRefundEnabled(): boolean {
  const v = optionalEnv("E2E_CATALOG_REFUND");
  return v === "1" || v === "true";
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = optionalEnv(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const CATALOG_REFUND_WAIT_MS = () =>
  readPositiveIntEnv("E2E_CATALOG_REFUND_WAIT_MS", 90_000);

export interface CatalogRefundBalanceSnapshot {
  beforePlace: bigint;
  afterPlace: bigint;
  afterRefund: bigint;
}

export interface CatalogRefundProbeOutcome {
  market: TradeableCatalogMarket;
  orderId: bigint;
  maxSpend: bigint;
  priceCapBps: string;
  quoteBps: number;
  placeDigest?: string;
  refundAmount: bigint;
  cancelWaitMs: number;
  balances: CatalogRefundBalanceSnapshot;
}

function placeCredentials(ctx: IntegrationCtx): PlaceBetCredentials {
  return { accountId: ctx.accountId, sender: ctx.ownerAddress };
}

function quoteBpsFromMarket(market: TradeableCatalogMarket): number {
  const odds =
    typeof market.target.side.oddsCents === "string"
      ? Number(market.target.side.oddsCents)
      : (market.target.side.oddsCents ?? 0);
  return Math.round(odds * 100);
}

function buildUnfillablePlaceBody(
  ctx: IntegrationCtx,
  market: TradeableCatalogMarket,
  maxSpend: string,
): PlaceBetRequestBody {
  const odds =
    typeof market.target.side.oddsCents === "string"
      ? Number(market.target.side.oddsCents)
      : (market.target.side.oddsCents ?? 50);
  return buildPlaceBetRequest(placeCredentials(ctx), market.target.side, {
    ...readBrokerFriendlyPlaceOptions({ maxSpend }),
    priceCapBps: oddsCentsToUnfillablePriceCapBps(odds),
  });
}

function assertPlaceTxBytes(
  data: TxBuildResponseData | undefined,
): asserts data is TxBuildResponseData {
  if (!data?.txBytes || data.txBytes.length === 0) {
    throw new Error("POST /predict/bets/place missing txBytes");
  }
}

async function waitForOrderCancelled(
  ctx: IntegrationCtx,
  orderId: bigint,
  deadlineMs: number,
): Promise<{ refundAmount: bigint; waitMs: number }> {
  const started = Date.now();
  const deadline = started + deadlineMs;
  const pollMs = 1_000;

  while (Date.now() < deadline) {
    const filled = await findChainEventByOrderId(ctx.client, EVENT_CONTRACT.OrderFilled, orderId);
    if (filled) {
      throw new Error(
        `order ${orderId} filled unexpectedly — tighten priceCapBps or pick a lower-odds side`,
      );
    }
    const ev = await findChainEventByOrderId(ctx.client, EVENT_CONTRACT.OrderCancelled, orderId);
    if (ev) {
      return {
        refundAmount: BigInt(String(ev.json.refund_amount)),
        waitMs: Date.now() - started,
      };
    }
    try {
      const order = await getOrder(ctx.client, { orderId });
      if (order.kind !== "OPEN") {
        const late = await findChainEventByOrderId(
          ctx.client,
          EVENT_CONTRACT.OrderCancelled,
          orderId,
        );
        if (late) {
          return {
            refundAmount: BigInt(String(late.json.refund_amount)),
            waitMs: Date.now() - started,
          };
        }
      }
    } catch {
      const late = await findChainEventByOrderId(
        ctx.client,
        EVENT_CONTRACT.OrderCancelled,
        orderId,
      );
      if (late) {
        return {
          refundAmount: BigInt(String(late.json.refund_amount)),
          waitMs: Date.now() - started,
        };
      }
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    `order ${orderId} did not emit OrderCancelled within ${deadlineMs}ms (tight priceCap refund probe)`,
  );
}

/**
 * Place with unfillable cap, wait for keeper cancel, assert wxa balance restored.
 */
export async function runCatalogRefundProbe(
  ctx: IntegrationCtx,
  apiEnv: ApiEnvironment,
  options?: { placeFailures?: CatalogPlaceFailure[]; refundWaitMs?: number },
): Promise<CatalogRefundProbeOutcome | null> {
  const placeFailures = options?.placeFailures ?? [];
  const maxSpend = readStagingMaxSpend();
  const markets = await listTradeableCatalogBets(apiEnv, {
    bothSides: true,
    failures: placeFailures,
  });
  if (markets.length === 0) return null;
  const market = [...markets].sort((a, b) => quoteBpsFromMarket(a) - quoteBpsFromMarket(b))[0]!;

  const body = buildUnfillablePlaceBody(ctx, market, maxSpend);
  const quoteBps = quoteBpsFromMarket(market);

  const buildRes = await apiPost<TxBuildResponseData>(apiEnv, "/predict/bets/place", body);
  if (buildRes.status < 200 || buildRes.status >= 300 || !buildRes.envelope.success) {
    placeFailures.push({
      segment: market.segment,
      marketSlug: market.marketSlug,
      reason: `refund probe place HTTP ${buildRes.status}`,
    });
    return null;
  }
  assertPlaceTxBytes(buildRes.envelope.data);

  const balanceBefore = await getAccountSettlementBalance(ctx.client, ctx.accountId);

  const placeResult = await executeCatalogPlace(
    ctx,
    body,
    buildRes.envelope.data.txBytes,
    buildRes.envelope.data.sponsored,
  );
  const placed = findEvent(eventsFromResult(placeResult), EVENT_CONTRACT.OrderPlaced.suffix);
  if (!placed) {
    throw new Error("refund probe place tx did not emit OrderPlaced");
  }
  const orderId = BigInt(String(placed.json.order_id));

  const balanceAfterPlace = await getAccountSettlementBalance(ctx.client, ctx.accountId);
  const maxSpendBase = BigInt(body.maxSpend);

  const { refundAmount, waitMs } = await waitForOrderCancelled(
    ctx,
    orderId,
    options?.refundWaitMs ?? CATALOG_REFUND_WAIT_MS(),
  );

  const balanceAfterRefund = await getAccountSettlementBalance(ctx.client, ctx.accountId);

  if (balanceAfterPlace !== balanceBefore - maxSpendBase) {
    throw new Error(
      `wxa balance after place expected ${balanceBefore - maxSpendBase}, got ${balanceAfterPlace} ` +
        `(before=${formatSettlementBase(balanceBefore)} afterPlace=${formatSettlementBase(balanceAfterPlace)})`,
    );
  }
  if (refundAmount !== maxSpendBase) {
    throw new Error(`OrderCancelled refund_amount ${refundAmount} !== maxSpend ${maxSpendBase}`);
  }
  if (balanceAfterRefund !== balanceBefore) {
    throw new Error(
      `wxa balance after refund expected ${balanceBefore}, got ${balanceAfterRefund} ` +
        `(delta=${balanceAfterRefund - balanceBefore})`,
    );
  }

  return {
    market,
    orderId,
    maxSpend: maxSpendBase,
    priceCapBps: body.priceCapBps,
    quoteBps,
    placeDigest: transactionDigest(placeResult),
    refundAmount,
    cancelWaitMs: waitMs,
    balances: {
      beforePlace: balanceBefore,
      afterPlace: balanceAfterPlace,
      afterRefund: balanceAfterRefund,
    },
  };
}

export { formatCatalogPlaceFailures };

export function logCatalogRefundProbe(outcome: CatalogRefundProbeOutcome): void {
  const slug = outcome.market.marketSlug;
  const side = outcome.market.target.side.key ?? outcome.market.target.side.trade?.selection ?? "?";
  console.log(`market:      ${outcome.market.segment}/${slug} (${side})`);
  console.log(`orderId:     ${outcome.orderId}`);
  console.log(
    `maxSpend:    ${outcome.maxSpend} (priceCapBps=${outcome.priceCapBps} quoteBps=${outcome.quoteBps})`,
  );
  console.log(`cancelWait:  ${(outcome.cancelWaitMs / 1000).toFixed(2)}s`);
  console.log(`refund:      ${outcome.refundAmount} (full)`);
  console.log("wxa balance:");
  console.log(`  before:     ${formatSettlementBase(outcome.balances.beforePlace)}`);
  console.log(`  afterPlace: ${formatSettlementBase(outcome.balances.afterPlace)}`);
  console.log(`  afterRefund:${formatSettlementBase(outcome.balances.afterRefund)}`);
  if (outcome.placeDigest) {
    console.log(`placeTx:     https://suiscan.xyz/testnet/tx/${outcome.placeDigest}`);
  }
}

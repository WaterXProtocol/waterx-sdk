import type { PredictClient } from "~predict/client.ts";
import { getOrder, getPosition } from "~predict/fetch.ts";
import type { OrderView, PositionView } from "~predict/types.ts";
import { expect } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import type { BetWire } from "./api-contract.ts";
import { betListIncludesOrderId, betListIncludesPositionId } from "./api-contract.ts";
import { normalizeEventMarketIdHex } from "./event-market-id.ts";
import { expectEventShape, normalizeEnumField, type SuiEventEnvelope } from "./events.ts";
import { findChainEventByOrderId, findChainEventByPositionId } from "./query-prediction-events.ts";

export { normalizeEventMarketIdHex } from "./event-market-id.ts";

export function assertEventMarketIdMatchesEventJson(
  marketIdJson: unknown,
  marketIdHex: string,
): void {
  expect(normalizeEventMarketIdHex(marketIdJson)).toBe(marketIdHex.toLowerCase());
}

export function assertOrderPlacedEventMatchesOrderView(
  event: SuiEventEnvelope,
  order: OrderView,
): void {
  expectEventShape(event, EVENT_CONTRACT.OrderPlaced);
  expect(event.json.account_id).toBe(order.accountId);
  expect(event.json.receiver_account_id).toBe(order.accountId);
  expect(BigInt(String(event.json.order_id))).toBe(order.orderId);
  expect(normalizeEnumField(event.json.selection)).toBe(order.selection);
  expect(BigInt(String(event.json.max_spend))).toBe(order.maxSpend);
  expect(BigInt(String(event.json.min_shares))).toBe(order.minShares);
  expect(BigInt(String(event.json.price_cap))).toBe(order.priceCapBps);
  expect(BigInt(String(event.json.expiry_ts))).toBe(order.expiryTs);
  expect(Boolean(event.json.by_admin)).toBe(order.byAdmin);
  assertEventMarketIdMatchesEventJson(event.json.market_id, order.marketIdHex);
}

/**
 * `OrderFilled` must align with the position view. When `order` is provided, also checks order_id
 * (bypass testnet may emit a different order_id than the position cursor).
 */
export function assertOrderFilledEventMatchesPositionView(
  event: SuiEventEnvelope,
  position: PositionView,
  order?: OrderView,
): void {
  expectEventShape(event, EVENT_CONTRACT.OrderFilled);
  expect(BigInt(String(event.json.position_id))).toBe(position.positionId);
  expect(BigInt(String(event.json.filled_shares))).toBe(position.filledShares);
  expect(BigInt(String(event.json.filled_cost))).toBe(position.filledCost);
  if (order !== undefined) {
    expect(BigInt(String(event.json.order_id))).toBe(order.orderId);
  }
}

export function assertCloseRequestedEventMatchesPositionView(
  event: SuiEventEnvelope,
  position: PositionView,
): void {
  expectEventShape(event, EVENT_CONTRACT.CloseRequested);
  expect(BigInt(String(event.json.position_id))).toBe(position.positionId);
  expect(BigInt(String(event.json.order_id))).not.toBe(BigInt(String(position.positionId)));
  expect(BigInt(String(event.json.min_proceeds))).toBe(position.closeMinProceeds);
  expect(BigInt(String(event.json.expiry_ts))).toBe(position.closeExpiryTs);
}

export function assertCloseConfirmedEventMatchesPositionView(
  event: SuiEventEnvelope,
  position: PositionView,
  proceeds: bigint,
): void {
  expectEventShape(event, EVENT_CONTRACT.CloseConfirmed);
  expect(BigInt(String(event.json.position_id))).toBe(position.positionId);
  expect(BigInt(String(event.json.proceeds))).toBe(proceeds);
}

/** API bet row should reference the same ids as the on-chain event (indexer wire). */
export function assertBetWireMatchesChainEvent(
  bet: BetWire,
  event: SuiEventEnvelope,
  opts: { orderId?: bigint; positionId?: bigint },
): void {
  if (opts.orderId !== undefined) {
    const hasOrderWire = bet.orderId !== undefined || bet.order_id !== undefined;
    if (hasOrderWire) {
      expect(betListIncludesOrderId([bet], opts.orderId)).toBe(true);
      if (event.json.order_id !== undefined) {
        expect(betOrderIdFromBet(bet)).toBe(String(event.json.order_id));
      }
    }
    // Catalog `bets/me` rows are often keyed by `positionId` only (`betId = account:position`).
  }
  if (opts.positionId !== undefined) {
    const betPos = bet.positionId ?? bet.position_id;
    const matchesChainPosition = betListIncludesPositionId([bet], opts.positionId);
    const matchesBypassOrderKey =
      opts.orderId !== undefined && betPos !== undefined && String(betPos) === String(opts.orderId);
    expect(matchesChainPosition || matchesBypassOrderKey).toBe(true);
    if (event.json.position_id !== undefined && matchesChainPosition) {
      expect(String(betPos)).toBe(String(event.json.position_id));
    }
  }
  if (event.json.selection !== undefined && bet.selection !== undefined) {
    expect(bet.selection!.toUpperCase()).toBe(normalizeEnumField(event.json.selection));
  }
}

function betOrderIdFromBet(bet: BetWire): string | undefined {
  const raw = bet.orderId ?? bet.order_id;
  return raw === undefined ? undefined : String(raw);
}

export async function assertOrderPlacedEventOnChain(
  client: PredictClient,
  orderId: bigint,
): Promise<{ event: SuiEventEnvelope; order: OrderView }> {
  const order = await getOrder(client, { orderId });
  const event = await findChainEventByOrderId(client, EVENT_CONTRACT.OrderPlaced, orderId);
  expect(event, `OrderPlaced event for order_id=${orderId}`).toBeDefined();
  assertOrderPlacedEventMatchesOrderView(event!, order);
  return { event: event!, order };
}

export async function assertOrderFilledEventOnChain(
  client: PredictClient,
  positionId: bigint,
  orderId?: bigint,
): Promise<{ event: SuiEventEnvelope; position: PositionView; order?: OrderView }> {
  const position = await getPosition(client, { positionId });
  const order = orderId !== undefined ? await getOrder(client, { orderId }) : undefined;
  const event = await findChainEventByPositionId(client, EVENT_CONTRACT.OrderFilled, positionId);
  expect(event, `OrderFilled event for position_id=${positionId}`).toBeDefined();
  assertOrderFilledEventMatchesPositionView(event!, position, order);
  return { event: event!, position, order };
}

export async function assertCloseRequestedEventOnChain(
  client: PredictClient,
  positionId: bigint,
): Promise<{ event: SuiEventEnvelope; position: PositionView }> {
  const position = await getPosition(client, { positionId });
  const event = await findChainEventByPositionId(client, EVENT_CONTRACT.CloseRequested, positionId);
  expect(event, `CloseRequested event for position_id=${positionId}`).toBeDefined();
  assertCloseRequestedEventMatchesPositionView(event!, position);
  return { event: event!, position };
}

export async function assertCloseConfirmedEventOnChain(
  client: PredictClient,
  positionId: bigint,
  proceeds: bigint,
): Promise<{ event: SuiEventEnvelope; position: PositionView }> {
  const position = await getPosition(client, { positionId });
  const event = await findChainEventByPositionId(client, EVENT_CONTRACT.CloseConfirmed, positionId);
  expect(event, `CloseConfirmed event for position_id=${positionId}`).toBeDefined();
  assertCloseConfirmedEventMatchesPositionView(event!, position, proceeds);
  return { event: event!, position };
}

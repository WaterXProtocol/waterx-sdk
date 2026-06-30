import { bcs } from "@mysten/sui/bcs";

import type {
  AccountDataView,
  CursorView,
  MarketExposure,
  MarketView,
  OrderKind,
  OrderView,
  Outcome,
  PositionStatus,
  PositionView,
  RegistryView,
  Selection,
} from "./types.ts";
import { bytesToHex, marketIdBytesFromUnknown } from "./utils.ts";

export const OrderKindBcs: any = bcs.enum("OrderKind", {
  Open: null,
  Close: null,
});

export const SelectionBcs: any = bcs.enum("Selection", {
  No: null,
  Yes: null,
});

export const StatusBcs: any = bcs.enum("Status", {
  Open: null,
  PendingClose: null,
});

export const OutcomeBcs: any = bcs.enum("Outcome", {
  No: null,
  Yes: null,
  Invalid: null,
});

export const RegistryViewBcs: any = bcs.struct("RegistryView", {
  balance: bcs.u64(),
  min_reserve: bcs.u64(),
  order_cancel_cooldown_ms: bcs.u64(),
  next_order_id: bcs.u64(),
  next_position_id: bcs.u64(),
  order_count: bcs.u64(),
  position_count: bcs.u64(),
  unresolved_market_count: bcs.u64(),
  resolved_market_count: bcs.u64(),
});

export const OrderViewBcs: any = bcs.struct("OrderView", {
  order_id: bcs.u64(),
  kind: OrderKindBcs,
  account_id: bcs.Address,
  receiver_account_id: bcs.Address,
  market_id: bcs.vector(bcs.u8()),
  selection: SelectionBcs,
  position_id: bcs.option(bcs.u64()),
  max_spend: bcs.u64(),
  min_shares: bcs.u64(),
  price_cap: bcs.u64(),
  min_proceeds: bcs.u64(),
  expiry_ts: bcs.u64(),
  self_cancel_after_ts: bcs.u64(),
  created_ts: bcs.u64(),
  by_admin: bcs.bool(),
});

export const PositionViewBcs: any = bcs.struct("PositionView", {
  position_id: bcs.u64(),
  account_id: bcs.Address,
  market_id: bcs.vector(bcs.u8()),
  selection: SelectionBcs,
  status: StatusBcs,
  filled_shares: bcs.u64(),
  filled_cost: bcs.u64(),
  opened_ts: bcs.u64(),
  payout: bcs.u64(),
  close_order_id: bcs.option(bcs.u64()),
  close_min_proceeds: bcs.u64(),
  close_expiry_ts: bcs.u64(),
  close_self_cancel_after_ts: bcs.u64(),
});

export const MarketViewBcs: any = bcs.struct("MarketView", {
  market_key: bcs.u64(),
  market_id: bcs.vector(bcs.u8()),
  resolved: bcs.bool(),
  paused: bcs.bool(),
  outcome: bcs.option(OutcomeBcs),
  unclaimed_count: bcs.u64(),
  yes_shares: bcs.u64(),
  yes_cost: bcs.u64(),
  no_shares: bcs.u64(),
  no_cost: bcs.u64(),
});

export const AccountDataViewBcs: any = bcs.struct("AccountDataView", {
  account_id: bcs.Address,
  has_data: bcs.bool(),
  order_count: bcs.u64(),
  position_count: bcs.u64(),
  order_front: bcs.option(bcs.u64()),
  order_back: bcs.option(bcs.u64()),
  position_front: bcs.option(bcs.u64()),
  position_back: bcs.option(bcs.u64()),
});

export function decodeEnumVariant(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (typeof record.$kind === "string") return record.$kind;
    const variant = record["@variant"];
    if (typeof variant === "string") return variant;
    if (variant && typeof variant === "object") {
      const innerKey = Object.keys(variant as Record<string, unknown>)[0];
      if (innerKey) return innerKey;
    }
    const key = Object.keys(record).find((k) => k !== "$kind" && k !== "@variant");
    if (key) return key;
  }
  throw new Error(`Unable to decode enum variant: ${JSON.stringify(raw)}`);
}

function enumKind(raw: unknown): string {
  return decodeEnumVariant(raw);
}

export function mapSelection(raw: unknown): Selection {
  const kind = enumKind(raw).toLowerCase();
  if (kind === "yes") return "YES";
  if (kind === "no") return "NO";
  throw new Error(`Unknown Selection variant: ${kind}`);
}

export function mapOutcome(raw: unknown): Outcome {
  const kind = enumKind(raw).toLowerCase();
  if (kind === "yes") return "YES";
  if (kind === "no") return "NO";
  if (kind === "invalid") return "INVALID";
  throw new Error(`Unknown Outcome variant: ${kind}`);
}

export function mapOrderKind(raw: unknown): OrderKind {
  const kind = enumKind(raw).toLowerCase();
  if (kind === "open") return "OPEN";
  if (kind === "close") return "CLOSE";
  throw new Error(`Unknown OrderKind variant: ${kind}`);
}

export function mapStatus(raw: unknown): PositionStatus {
  const kind = enumKind(raw).toLowerCase();
  if (kind === "open") return "OPEN";
  if (kind === "pendingclose" || kind === "pending_close") return "PENDING_CLOSE";
  throw new Error(`Unknown Status variant: ${kind}`);
}

function mapOptionalU64(raw: unknown): bigint | null {
  return raw == null ? null : BigInt(raw as bigint | number | string);
}

function asBytes(raw: unknown): Uint8Array {
  return marketIdBytesFromUnknown(raw);
}

export function mapRegistryView(raw: any): RegistryView {
  return {
    balance: BigInt(raw.balance),
    minReserve: BigInt(raw.min_reserve),
    orderCancelCooldownMs: BigInt(raw.order_cancel_cooldown_ms),
    nextOrderId: BigInt(raw.next_order_id),
    nextPositionId: BigInt(raw.next_position_id),
    orderCount: BigInt(raw.order_count),
    positionCount: BigInt(raw.position_count),
    unresolvedMarketCount: BigInt(raw.unresolved_market_count),
    resolvedMarketCount: BigInt(raw.resolved_market_count),
  };
}

export function mapOrderView(raw: any): OrderView {
  const marketId = asBytes(raw.market_id);
  return {
    orderId: BigInt(raw.order_id),
    kind: mapOrderKind(raw.kind),
    accountId: raw.account_id,
    receiverAccountId: raw.receiver_account_id,
    marketId,
    marketIdHex: bytesToHex(marketId),
    selection: mapSelection(raw.selection),
    positionId: mapOptionalU64(raw.position_id),
    maxSpend: BigInt(raw.max_spend),
    minShares: BigInt(raw.min_shares),
    priceCapBps: BigInt(raw.price_cap),
    minProceeds: BigInt(raw.min_proceeds),
    expiryTs: BigInt(raw.expiry_ts),
    selfCancelAfterTs: BigInt(raw.self_cancel_after_ts),
    createdTs: BigInt(raw.created_ts),
    byAdmin: raw.by_admin,
  };
}

export function mapPositionView(raw: any): PositionView {
  const marketId = asBytes(raw.market_id);
  return {
    positionId: BigInt(raw.position_id),
    accountId: raw.account_id,
    marketId,
    marketIdHex: bytesToHex(marketId),
    selection: mapSelection(raw.selection),
    status: mapStatus(raw.status),
    filledShares: BigInt(raw.filled_shares),
    filledCost: BigInt(raw.filled_cost),
    openedTs: BigInt(raw.opened_ts),
    payout: BigInt(raw.payout),
    closeOrderId: mapOptionalU64(raw.close_order_id),
    closeMinProceeds: BigInt(raw.close_min_proceeds),
    closeExpiryTs: BigInt(raw.close_expiry_ts),
    closeSelfCancelAfterTs: BigInt(raw.close_self_cancel_after_ts),
  };
}

export function mapMarketView(raw: any): MarketView {
  const marketId = asBytes(raw.market_id);
  return {
    marketKey: BigInt(raw.market_key),
    marketId,
    marketIdHex: bytesToHex(marketId),
    resolved: raw.resolved,
    paused: raw.paused,
    outcome: raw.outcome == null ? null : mapOutcome(raw.outcome),
    unclaimedCount: BigInt(raw.unclaimed_count),
    yesShares: BigInt(raw.yes_shares),
    yesCost: BigInt(raw.yes_cost),
    noShares: BigInt(raw.no_shares),
    noCost: BigInt(raw.no_cost),
  };
}

export function mapMarketExposure(
  yesShares: unknown,
  yesCost: unknown,
  noShares: unknown,
  noCost: unknown,
): MarketExposure {
  return {
    yesShares: BigInt(yesShares as bigint | number | string),
    yesCost: BigInt(yesCost as bigint | number | string),
    noShares: BigInt(noShares as bigint | number | string),
    noCost: BigInt(noCost as bigint | number | string),
  };
}

export function mapAccountDataView(raw: any): AccountDataView {
  return {
    accountId: raw.account_id,
    hasData: raw.has_data,
    orderCount: BigInt(raw.order_count),
    positionCount: BigInt(raw.position_count),
    orderFront: mapOptionalU64(raw.order_front),
    orderBack: mapOptionalU64(raw.order_back),
    positionFront: mapOptionalU64(raw.position_front),
    positionBack: mapOptionalU64(raw.position_back),
  };
}

export function mapCursorView(count: unknown, front: unknown, back: unknown): CursorView {
  return {
    count: BigInt(count as bigint | number | string),
    front: mapOptionalU64(front),
    back: mapOptionalU64(back),
  };
}

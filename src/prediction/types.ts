import type { TransactionArgument } from "@mysten/sui/transactions";

export type ObjectArgument = string | TransactionArgument;
export type IdArgument = string | TransactionArgument;
export type Selection = "NO" | "YES";
export type Outcome = "NO" | "YES" | "INVALID";
export type OrderKind = "OPEN" | "CLOSE";
export type PositionStatus = "OPEN" | "PENDING_CLOSE";
export type MarketIdInput = string | Uint8Array | number[];

export interface AccountIdentityParams {
  bucketAccount?: ObjectArgument;
}

export interface RegistryView {
  balance: bigint;
  minReserve: bigint;
  orderCancelCooldownMs: bigint;
  nextOrderId: bigint;
  nextPositionId: bigint;
  orderCount: bigint;
  positionCount: bigint;
  unresolvedMarketCount: bigint;
  resolvedMarketCount: bigint;
}

export interface OrderView {
  orderId: bigint;
  kind: OrderKind;
  accountId: string;
  receiverAccountId: string;
  marketId: Uint8Array;
  marketIdHex: string;
  selection: Selection;
  positionId: bigint | null;
  maxSpend: bigint;
  minShares: bigint;
  priceCapBps: bigint;
  minProceeds: bigint;
  expiryTs: bigint;
  selfCancelAfterTs: bigint;
  createdTs: bigint;
  byAdmin: boolean;
}

export interface PositionView {
  positionId: bigint;
  accountId: string;
  marketId: Uint8Array;
  marketIdHex: string;
  selection: Selection;
  status: PositionStatus;
  filledShares: bigint;
  filledCost: bigint;
  openedTs: bigint;
  payout: bigint;
  closeOrderId: bigint | null;
  closeMinProceeds: bigint;
  closeExpiryTs: bigint;
  closeSelfCancelAfterTs: bigint;
}

export interface MarketView {
  marketKey: bigint;
  marketId: Uint8Array;
  marketIdHex: string;
  resolved: boolean;
  paused: boolean;
  outcome: Outcome | null;
  unclaimedCount: bigint;
  yesShares: bigint;
  yesCost: bigint;
  noShares: bigint;
  noCost: bigint;
}

export interface MarketExposure {
  yesShares: bigint;
  yesCost: bigint;
  noShares: bigint;
  noCost: bigint;
}

export interface AccountDataView {
  accountId: string;
  hasData: boolean;
  orderCount: bigint;
  positionCount: bigint;
  orderFront: bigint | null;
  orderBack: bigint | null;
  positionFront: bigint | null;
  positionBack: bigint | null;
}

export interface CursorView {
  count: bigint;
  front: bigint | null;
  back: bigint | null;
}

export interface CoinRef {
  objectId: string;
  version: string | bigint | number;
  digest: string;
}

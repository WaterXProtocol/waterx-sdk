/**
 * Canonical on-chain field contract for `waterx_prediction::events::*`.
 *
 * Source of truth for Integration tests — mirrors:
 * - `src/generated/waterx_prediction/events.ts` (Move BCS layout)
 * - `data-infra/waterx-predict-indexer` anti-corruption + ClickHouse DDL
 *
 * Indexer may rename on write (e.g. Move `price_cap` → CH `price_cap_bps`); this
 * file documents **parsed JSON field names** as emitted on-chain.
 */

export type JsonFieldKind = "address" | "u64" | "bytes" | "bool" | "enum";

export interface EventFieldContract {
  /** Move event suffix, e.g. `::events::OrderPlaced`. */
  suffix: string;
  /** Fields that must be present in parsed JSON. */
  required: readonly string[];
  /** Expected JSON shapes (loose — u64 often arrives as string). */
  kinds?: Partial<Record<string, JsonFieldKind>>;
  /** Cross-repo notes for reviewers / sibling PRs. */
  notes?: readonly string[];
}

/** All Move event payloads (15 types; indexer maps KeeperAdded/KeeperRemoved to one handler). */
export const EVENT_CONTRACT = {
  OrderPlaced: {
    suffix: "::events::OrderPlaced",
    required: [
      "market_registry_id",
      "order_id",
      "account_id",
      "market_id",
      "selection",
      "max_spend",
      "min_shares",
      "price_cap",
      "expiry_ts",
      "self_cancel_after_ts",
      "by_admin",
    ],
    kinds: {
      market_registry_id: "address",
      order_id: "u64",
      account_id: "address",
      max_spend: "u64",
      min_shares: "u64",
      price_cap: "u64",
      by_admin: "bool",
      selection: "enum",
    },
    notes: [
      "account_id is the registry account object id (not the wallet owner address).",
      "Indexer CH column price_cap_bps maps from Move price_cap.",
    ],
  },
  OrderFilled: {
    suffix: "::events::OrderFilled",
    required: ["market_registry_id", "order_id", "position_id", "filled_shares", "filled_cost"],
    kinds: {
      order_id: "u64",
      position_id: "u64",
      filled_shares: "u64",
      filled_cost: "u64",
    },
    notes: [
      "position_id equals the originating open order_id (ChBetSource joins close/claim via this).",
    ],
  },
  OrderCancelled: {
    suffix: "::events::OrderCancelled",
    required: ["market_registry_id", "order_id", "refund_amount"],
    kinds: { order_id: "u64", refund_amount: "u64" },
  },
  CloseRequested: {
    suffix: "::events::CloseRequested",
    required: [
      "market_registry_id",
      "order_id",
      "position_id",
      "min_proceeds",
      "expiry_ts",
      "self_cancel_after_ts",
    ],
    kinds: { order_id: "u64", position_id: "u64", min_proceeds: "u64" },
    notes: ["order_id is the NEW close-order id, distinct from position_id."],
  },
  CloseConfirmed: {
    suffix: "::events::CloseConfirmed",
    required: ["market_registry_id", "order_id", "position_id", "proceeds"],
    kinds: { position_id: "u64", proceeds: "u64" },
  },
  CloseCancelled: {
    suffix: "::events::CloseCancelled",
    required: ["market_registry_id", "order_id", "position_id", "by_self"],
    kinds: { position_id: "u64", by_self: "bool" },
  },
  PositionClaimed: {
    suffix: "::events::PositionClaimed",
    required: ["market_registry_id", "position_id", "payout"],
    kinds: { position_id: "u64", payout: "u64" },
    notes: ["payout=0 is valid (losing side / force_claim cleanup)."],
  },
  MarketResolved: {
    suffix: "::events::MarketResolved",
    required: ["market_registry_id", "market_id", "outcome"],
    kinds: { outcome: "enum" },
  },
  MarketPaused: {
    suffix: "::events::MarketPaused",
    required: ["market_registry_id", "market_key", "market_id"],
    kinds: { market_key: "u64" },
  },
  MarketUnpaused: {
    suffix: "::events::MarketUnpaused",
    required: ["market_registry_id", "market_key", "market_id"],
    kinds: { market_key: "u64" },
  },
  MarketRegistryWithdrawn: {
    suffix: "::events::MarketRegistryWithdrawn",
    required: ["market_registry_id", "amount", "recipient", "new_balance"],
    kinds: { amount: "u64", new_balance: "u64", recipient: "address" },
  },
  MinReserveUpdated: {
    suffix: "::events::MinReserveUpdated",
    required: ["market_registry_id", "old_reserve", "new_reserve"],
    kinds: { old_reserve: "u64", new_reserve: "u64" },
  },
  OrderCancelCooldownUpdated: {
    suffix: "::events::OrderCancelCooldownUpdated",
    required: ["market_registry_id", "old_cooldown_ms", "new_cooldown_ms"],
    kinds: { old_cooldown_ms: "u64", new_cooldown_ms: "u64" },
  },
  KeeperAdded: {
    suffix: "::events::KeeperAdded",
    required: ["global_config_id", "keeper"],
    kinds: { global_config_id: "address", keeper: "address" },
  },
  KeeperRemoved: {
    suffix: "::events::KeeperRemoved",
    required: ["global_config_id", "keeper"],
    kinds: { global_config_id: "address", keeper: "address" },
  },
} as const satisfies Record<string, EventFieldContract>;

export type PredictionEventName = keyof typeof EVENT_CONTRACT;

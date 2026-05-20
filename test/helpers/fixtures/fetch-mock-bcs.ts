/**
 * BCS payloads for mocking `client.simulate` in fetch.ts unit tests.
 */
import { bcs } from "@mysten/sui/bcs";

import {
  AccountData,
  MarketData,
  OrderData,
  PoolData,
  PositionData,
  RedeemRequestData,
  TokenPoolData,
} from "../../../src/generated/waterx_perp_view/view.ts";
import { MOCK_USDC_TYPE } from "./mock-testnet-config.ts";
import { mockSuiAddress } from "./sui-mock-fixtures.ts";

const ADDR = mockSuiAddress("aa");
const MARKET = mockSuiAddress("bb");
const TYPE = { name: MOCK_USDC_TYPE };

export function accountDataBytes(): Uint8Array {
  return AccountData.serialize({
    account_id: ADDR,
    account_object_address: ADDR,
  }).toBytes();
}

/** `Option<AccountData>` BCS with `some` variant for `getAccountData`. */
export function accountDataSomeBytes(): Uint8Array {
  return bcs
    .option(AccountData)
    .serialize({
      account_id: ADDR,
      account_object_address: ADDR,
    })
    .toBytes();
}

export function accountDataNoneBytes(): Uint8Array {
  return bcs.option(AccountData).serialize(null).toBytes();
}

export function marketDataBytes(overrides: Partial<{ symbol: string; is_paused: boolean }> = {}) {
  return MarketData.serialize({
    market_id: MARKET,
    symbol: overrides.symbol ?? "BTCUSD",
    lp_token: TYPE,
    is_paused: overrides.is_paused ?? false,
    long_oi: 0n,
    short_oi: 0n,
    long_avg_entry_price: 0n,
    short_avg_entry_price: 0n,
    max_long_oi: 1_000_000n,
    max_short_oi: 1_000_000n,
    max_leverage_bps: 5000n,
    trading_fee: 5n,
    max_impact_fee: 10n,
    allocated_lp_exposure_bps: 2000n,
    impact_fee_curvature: 2n,
    impact_fee_scale: 1n,
    maintenance_margin: 100n,
    min_coll_value: 0n,
    cooldown_ms: 0n,
    basic_funding_rate: 0n,
    funding_interval_ms: 3600_000n,
    order_price_tick: 1n,
    cumulative_funding_sign: false,
    cumulative_funding_index: 0n,
    last_funding_timestamp: 0n,
    next_position_id: 1n,
    next_order_id: 1n,
  }).toBytes();
}

export function poolDataBytes() {
  return PoolData.serialize({
    lp_token: TYPE,
    is_active: true,
    lp_decimal: 6,
    total_lp_supply: 1_000_000n,
    tvl_usd: 100_000n,
    token_count: 1n,
  }).toBytes();
}

export function tokenPoolDataBytes() {
  return TokenPoolData.serialize({
    token_type: TYPE,
    token_decimal: 6,
    liquidity_amount: 1_000_000n,
    reserved_amount: 0n,
    value_usd: 1_000_000n,
    target_weight_bps: 10_000n,
    mint_fee_bps: 10n,
    burn_fee_bps: 10n,
    cumulative_borrow_rate: 0n,
    last_price_refresh_timestamp: 0n,
  }).toBytes();
}

export function positionDataBytes(
  overrides: Partial<{ position_id: bigint; is_long: boolean }> = {},
) {
  return PositionData.serialize({
    position_id: overrides.position_id ?? 1n,
    account_object_address: ADDR,
    market_id: MARKET,
    is_long: overrides.is_long ?? true,
    size: 1_000_000_000n,
    collateral_type: TYPE,
    collateral_amount: 10_000_000n,
    collateral_decimal: 6,
    average_price: 50_000_000_000_000n,
    oracle_price: 50_000_000_000_000n,
    collateral_price: 1_000_000_000n,
    est_liq_price: 40_000_000_000_000n,
    leverage_bps: 2000n,
    entry_borrow_index: 0n,
    entry_funding_sign: false,
    entry_funding_index: 0n,
    unrealized_trading_fee: 0n,
    unrealized_borrow_fee: 0n,
    unrealized_funding_fee: 0n,
    unrealized_funding_sign: false,
    pnl_positive: true,
    pnl: 0n,
    funding_fee_positive: false,
    funding_fee: 0n,
    borrow_fee: 0n,
    close_fee: 0n,
    linked_order_ids: [],
    linked_order_price_keys: [],
    create_timestamp: 1n,
    update_timestamp: 1n,
  }).toBytes();
}

export function orderDataBytes(
  overrides: Partial<{ order_id: bigint; has_linked_position: boolean }> = {},
) {
  return OrderData.serialize({
    order_id: overrides.order_id ?? 1n,
    account_object_address: ADDR,
    market_id: MARKET,
    is_long: true,
    reduce_only: false,
    is_stop_order: false,
    size: 500_000_000n,
    collateral_type: TYPE,
    collateral_amount: 5_000_000n,
    collateral_decimal: 6,
    trigger_price: 50_000_000_000_000n,
    oracle_price: 50_000_000_000_000n,
    order_type_tag: 0,
    has_linked_position: overrides.has_linked_position ?? false,
    linked_position_id: 0n,
    leverage_bps: 2000n,
    create_timestamp: 1n,
  }).toBytes();
}

export function redeemRequestDataBytes(requestId = 1n) {
  return RedeemRequestData.serialize({
    request_id: requestId,
    recipient_account_id: ADDR,
    lp_amount: 1_000_000n,
    token_type: TYPE,
    request_timestamp: 1n,
  }).toBytes();
}

export function vectorPositionBytes(count = 1): Uint8Array {
  const items = Array.from({ length: count }, (_, i) =>
    PositionData.parse(positionDataBytes({ position_id: BigInt(i + 1) })),
  );
  return bcs.vector(PositionData).serialize(items).toBytes();
}

export function vectorOrderBytes(count = 1): Uint8Array {
  const items = Array.from({ length: count }, (_, i) =>
    OrderData.parse(orderDataBytes({ order_id: BigInt(i + 1) })),
  );
  return bcs.vector(OrderData).serialize(items).toBytes();
}

export function vectorRedeemBytes(count = 1): Uint8Array {
  const items = Array.from({ length: count }, (_, i) =>
    RedeemRequestData.parse(redeemRequestDataBytes(BigInt(i + 1))),
  );
  return bcs.vector(RedeemRequestData).serialize(items).toBytes();
}

export function cursorSomeBytes(cursor = 42n): Uint8Array {
  return bcs.option(bcs.u64()).serialize(cursor).toBytes();
}

export function cursorNoneBytes(): Uint8Array {
  return bcs.option(bcs.u64()).serialize(null).toBytes();
}

export function boolBytes(value: boolean): Uint8Array {
  return bcs.bool().serialize(value).toBytes();
}

export function addressOptionBytes(addr?: string): Uint8Array {
  return bcs
    .option(bcs.Address)
    .serialize(addr ?? null)
    .toBytes();
}

/**
 * Minimal fixture payloads passed into map*View helpers (mirrors on-chain field names).
 */
export const registryFixture = {
  balance: 100n,
  min_reserve: 50n,
  order_cancel_cooldown_ms: 60n,
  next_order_id: 12n,
  order_count: 10n,
  position_count: 8n,
  unresolved_market_count: 3n,
  resolved_market_count: 4n,
};

export const orderFixture = {
  order_id: 11n,
  kind: "Open",
  account_id: "0xb036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc55",
  receiver_account_id: "0xb036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc55",
  market_id: new Uint8Array([1, 2, 3]),
  selection: "Yes",
  position_id: null,
  max_spend: 99n,
  min_shares: 10n,
  price_cap: 7000n,
  min_proceeds: 0n,
  expiry_ts: 1n,
  self_cancel_after_ts: 2n,
  created_ts: 3n,
  by_admin: false,
};

export const positionFixture = {
  position_id: 7n,
  account_id: "0xc036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc56",
  market_id: new Uint8Array([4, 5]),
  selection: "No",
  status: "Open",
  filled_shares: 20n,
  filled_cost: 30n,
  opened_ts: 4n,
  payout: 0n,
  close_order_id: null,
  close_min_proceeds: 0n,
  close_expiry_ts: 0n,
  close_self_cancel_after_ts: 0n,
};

export const marketFixture = {
  market_key: 42n,
  market_id: new Uint8Array([9]),
  resolved: false,
  paused: false,
  outcome: null,
  unclaimed_count: 0n,
  yes_shares: 11n,
  yes_cost: 12n,
  no_shares: 13n,
  no_cost: 14n,
};

export const accountDataFixture = {
  account_id: "0xd036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc57",
  has_data: true,
  order_count: 2n,
  position_count: 1n,
  order_front: 1n,
  order_back: 2n,
  position_front: 3n,
  position_back: null,
};

#!/usr/bin/env bash
set -euo pipefail

# Sets `min_coll_value` on every market's MarketConfig via the new
# `trading::update_market_config<BASE, WLP>` admin wrapper.
#
# One PTB per market (atomic; re-runnable per row). All other option<*>
# fields in `update_market_config` are passed as `none` so only
# `min_coll_value` is mutated. `min_coll_value` is a u64 in Float internal
# precision (1e9-scaled) — e.g. $10 = 10_000_000_000.
#
# Requires `sui client active-address` to own the `AdminCap`.
#
# Usage: ./scripts/set-min-coll-value.sh

# ── Package IDs ─────────────────────────────────────────────────────
# New waterx_perp upgrade that exposes the `trading::update_market_config` wrapper.
# Used ONLY as the moveCall target; the Market<B, L> type still resolves to the
# original waterx_perp id below.
WATERX_PERP_PKG_NEW="0x3dcfde130b8929a0a1c7b07d302dfb8f3d48e2d7f3a7221b049bf99cf565c7fb"
WATERX_PERP_PKG_ORIG="0x5d6d935e8a73c2df1c60135a798e404cc8545c3912236b8f82fe5554c539007a"
WLP_PKG="0x7d3c94df3644f025ec6dfe5ece2e2bd3d7d7eda8fee59697c0930bffad4123bc"
MARKET_SYMBOL_PKG="0xd08f5c03e1d5a87d411b39969e5294eb0e5d10560105a747aefa77c0b17facae"
BUCKET_FRAMEWORK_PKG="0x0cdfc09284014fd36bbb19da8ab1c60056ca207d4c866e78dc01ca8e51dac790"
STD_PKG="0x1"

# ── Shared / owned objects ──────────────────────────────────────────
ADMIN_CAP="0x44dede8e6dcc4175fe255355470df1d5e6f27d1d5603ace07beb2baac245b744"

# ── Types ───────────────────────────────────────────────────────────
WLP_TYPE="${WLP_PKG}::wlp::WLP"
FLOAT_TYPE="${BUCKET_FRAMEWORK_PKG}::float::Float"

# ── Markets ─────────────────────────────────────────────────────────
# Format: SYMBOL:MARKET_ID:MIN_COLL_VALUE (u64, 1e9-scaled USD)
#   $0.1  = 100000000
#   $1    = 1000000000
#   $10   = 10000000000
#   $100  = 100000000000
# Adjust per market as needed — conservative default = $10.
CRYPTO_MIN=90000000   # $0.09
XSTOCK_MIN=90000000   # $0.09

MARKETS=(
  # Crypto
  "BTC_USD:0x2e7fc12efaa46a7d0204ac995a93bb85d2c20cea03fa63948ef6fccc94f412de:${CRYPTO_MIN}"
  "ETH_USD:0x4ba6ac9899b6c8c46f6deac9df652ad47d138495f69ef931f1cc6a209668df99:${CRYPTO_MIN}"
  "SOL_USD:0xda58a8f95feac6e50718c700e9e8691d81cf84888964b796ef7dd55fc2602f52:${CRYPTO_MIN}"
  "SUI_USD:0xecd5fd7f562da477ccb20120253dde3c5f1339237431e82a16e7f5e084353c22:${CRYPTO_MIN}"
  "DEEP_USD:0xc77e6da2130e98644dd4edac7f691586829014fd46652500abf9861c6de562f0:${CRYPTO_MIN}"
  "WAL_USD:0x1b2b4fef4dc3a4ce65b7dd8edd2cb10cee9b70f3b91be1c72d6436fb78061efa:${CRYPTO_MIN}"
  # xStock
  "AAPLX_USD:0x1afd1ca441a0cf8ea7dcccd863f1130fca592ef0907b02275065e32273a6d00a:${XSTOCK_MIN}"
  "GOOGLX_USD:0xb41ff672b3ee8bfe6f67bb64e6ce8adfd93209dd27ca0d97c3f7f2ef59f47091:${XSTOCK_MIN}"
  "METAX_USD:0xf4deb8c2bbd50a424891ec6e13016a1481721a06ed5f70cae7c4c7e658a23a5b:${XSTOCK_MIN}"
  "NVDAX_USD:0x603bc50a022fb40b5d992bfc88364539ee59830e9d2b9655f56160041e2523ed:${XSTOCK_MIN}"
  "QQQX_USD:0x5d572cc431e90a2f6701773d8283ee72395490c63c890c00683af64cced5628c:${XSTOCK_MIN}"
  "SPYX_USD:0x7e00e6f59be38e6d79a7dda1d1a3225f58cf8f44357c5dd62693e8802281b6d7:${XSTOCK_MIN}"
  "TSLAX_USD:0xf80d6cd00490eece860307bf59d995bd2ccab26712374fa4f4066863a82f297c:${XSTOCK_MIN}"
)

GAS=200000000

set_min_coll_value() {
  local symbol="$1"
  local market_id="$2"
  local min_coll="$3"
  local base_type="${MARKET_SYMBOL_PKG}::market_symbol::${symbol}"

  echo ""
  echo "=== ${symbol}  min_coll_value = ${min_coll}  (market ${market_id:0:18}…) ==="

  # Build 14 option<...> args in one PTB:
  #   • 11× option::none<u64>
  #   •  2× option::none<u128>
  #   •  1× option::none<Float>
  #   •  1× option::some<u64>(min_coll) for min_coll_value (slot 2)
  # Then call trading::update_market_config<BASE, WLP>(...).
  sui client ptb \
    --move-call "${STD_PKG}::option::none" "<u64>" \
    --assign none_max_leverage \
    --move-call "${STD_PKG}::option::some" "<u64>" "${min_coll}" \
    --assign some_min_coll \
    --move-call "${STD_PKG}::option::none" "<u64>" \
    --assign none_trading_fee \
    --move-call "${STD_PKG}::option::none" "<u64>" \
    --assign none_max_impact_fee \
    --move-call "${STD_PKG}::option::none" "<u64>" \
    --assign none_alloc_lp \
    --move-call "${STD_PKG}::option::none" "<u64>" \
    --assign none_impact_curve \
    --move-call "${STD_PKG}::option::none" "<u64>" \
    --assign none_impact_scale \
    --move-call "${STD_PKG}::option::none" "<u64>" \
    --assign none_maint_margin \
    --move-call "${STD_PKG}::option::none" "<u128>" \
    --assign none_max_long_oi \
    --move-call "${STD_PKG}::option::none" "<u128>" \
    --assign none_max_short_oi \
    --move-call "${STD_PKG}::option::none" "<u64>" \
    --assign none_cooldown \
    --move-call "${STD_PKG}::option::none" "<${FLOAT_TYPE}>" \
    --assign none_order_tick \
    --move-call "${STD_PKG}::option::none" "<u64>" \
    --assign none_funding_rate \
    --move-call "${STD_PKG}::option::none" "<u64>" \
    --assign none_funding_interval \
    --move-call "${WATERX_PERP_PKG_NEW}::trading::update_market_config" "<${base_type},${WLP_TYPE}>" \
        "@${ADMIN_CAP}" \
        "@${market_id}" \
        none_max_leverage \
        some_min_coll \
        none_trading_fee \
        none_max_impact_fee \
        none_alloc_lp \
        none_impact_curve \
        none_impact_scale \
        none_maint_margin \
        none_max_long_oi \
        none_max_short_oi \
        none_cooldown \
        none_order_tick \
        none_funding_rate \
        none_funding_interval \
    --gas-budget ${GAS}

  sleep 1
}

for entry in "${MARKETS[@]}"; do
  # Parse "SYM:ID:VAL" — ID is hex-without-':' so simple split works.
  IFS=":" read -r symbol market_id min_coll <<< "$entry"
  set_min_coll_value "$symbol" "$market_id" "$min_coll"
done

echo ""
echo "Done — updated min_coll_value on ${#MARKETS[@]} markets."

#!/usr/bin/env bash
set -euo pipefail

# Drop the legacy SupraRule weight from the USDC + USDSUI collateral PriceAggregators
# so v2 (Pyth-only) `aggregate()` calls stop failing with err_missing_price_source (201).
#
# Setting `set_rule_weight<T, SupraRule>(weight=0)` removes the rule from the aggregator's
# weights map (see bucket_v2_oracle::aggregator::set_rule_weight).
#
# Requires `sui client active-address` to own the ListingCap.
#
# Usage: ./scripts/clear-supra-weights.sh

# ── Package IDs ─────────────────────────────────────────────────────
ORACLE_PKG="0xa00eb6c923368aef9aade69d75b348f53dc2ee344771ce3c3629dee05a0fb88c"
# Legacy supra_rule package (defines the SupraRule witness type — type identity persists on-chain).
SUPRA_RULE_PKG="0xde280cdb680998d632cca7a1972627854aae9b4acf4cf254fc541395e9471b6d"

# ── Owned objects ───────────────────────────────────────────────────
LISTING_CAP="0xa5d55065e5f4dda8d17213e425176198332ac639dee5b732c1892a4d8cc49854"

# ── Collateral types (TESTNET_COLLATERALS) ──────────────────────────
USDC_TYPE="0x7ccd477e884ec74f960b23a8b34b7d87999e4d7ee0dde738a0c25f46200f201a::mock_usdc::MOCK_USDC"
USDSUI_TYPE="0xc0fad30bc21babe3b8b51c6a4c380d27b61a47e34b26968daf20315da0e35016::mock_usdsui::MOCK_USDSUI"

# ── Collateral PriceAggregator IDs (TESTNET_COLLATERALS.aggregatorId) ──
USDC_AGG="0x6f9cd2133e7073376ac4de314873e625a8606bddb4daa33affd0a08933b8b2a7"
USDSUI_AGG="0x861d7fe0e5130ca818481f32eff768be1e097c897aa0c35ed9ae10d3f0553179"

SUPRA_WITNESS="${SUPRA_RULE_PKG}::supra_rule::SupraRule"
GAS=200000000

clear_supra() {
  local label="$1"
  local token_type="$2"
  local agg_id="$3"

  echo ""
  echo "=== ${label}: set_rule_weight<${label}, SupraRule>(0)  → drop from weights ==="

  sui client ptb \
    --move-call "${ORACLE_PKG}::aggregator::set_rule_weight" "<${token_type},${SUPRA_WITNESS}>" \
        "@${agg_id}" "@${LISTING_CAP}" "0u8" \
    --gas-budget ${GAS}
  sleep 1
}

clear_supra "USDC" "${USDC_TYPE}" "${USDC_AGG}"
clear_supra "USDSUI" "${USDSUI_TYPE}" "${USDSUI_AGG}"

echo ""
echo "Done. Both collateral aggregators are now Pyth-only."

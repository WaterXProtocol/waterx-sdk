#!/usr/bin/env bash
set -euo pipefail

# Register supported deposit tokens (USDC, USDSUI) on the WLP pool.
# Without this step `mint_wlp` aborts with `err_token_not_supported (401)`.
# Each token is added in one PTB; re-runnable per row by commenting/un-commenting.
#
# Requires `sui client active-address` to own the AdminCap.
#
# Usage: ./scripts/setup-wlp-tokens.sh

# ── Package IDs (waterx-contracts/*/Published.toml, testnet) ────────
WATERX_PERP_PKG="0x5d6d935e8a73c2df1c60135a798e404cc8545c3912236b8f82fe5554c539007a"
WLP_PKG="0x7d3c94df3644f025ec6dfe5ece2e2bd3d7d7eda8fee59697c0930bffad4123bc"
MOCK_USDC_PKG="0x7ccd477e884ec74f960b23a8b34b7d87999e4d7ee0dde738a0c25f46200f201a"
MOCK_USDSUI_PKG="0xc0fad30bc21babe3b8b51c6a4c380d27b61a47e34b26968daf20315da0e35016"

# ── Shared / owned objects ──────────────────────────────────────────
ADMIN_CAP="0x44dede8e6dcc4175fe255355470df1d5e6f27d1d5603ace07beb2baac245b744"
WLP_POOL="0x50167b112bc1d4dbe4907e22c11129074f8b2841519316b27f3405bef35c96a3"
CLOCK="0x6"

# ── Types ───────────────────────────────────────────────────────────
WLP_TYPE="${WLP_PKG}::wlp::WLP"
USDC_TYPE="${MOCK_USDC_PKG}::mock_usdc::MOCK_USDC"
USDSUI_TYPE="${MOCK_USDSUI_PKG}::mock_usdsui::MOCK_USDSUI"

# ── Common stablecoin pool params ───────────────────────────────────
TOKEN_DECIMAL=6                          # both MOCK_USDC and MOCK_USDSUI use 6 decimals
MINT_FEE_BPS=0                           # 0%
BURN_FEE_BPS=5                           # 0.05%
MAX_CAPACITY=1000000000000000            # ~$1B raw (6-dec USDC)
MIN_DEPOSIT=100000                       # $1 raw
BORROW_RATE_0=1                          # bps per BORROW_INTERVAL_MS (low util)
BORROW_RATE_1=5                          # mid util
BORROW_RATE_2=100                        # high util — discourage over-utilization
UTIL_THRESHOLD_0_BPS=5000                # 50%
UTIL_THRESHOLD_1_BPS=8000                # 80%
BORROW_INTERVAL_MS=3600000               # 1 hour
MAX_RESERVE_RATIO_BPS=9000               # 90%

GAS=300000000

# ── Tokens ──────────────────────────────────────────────────────────
# Format: LABEL:TYPE_VAR:TARGET_WEIGHT_BPS
# Sum of target weights across tokens should equal 10000 (100%).
TOKENS=(
  "USDC:USDC_TYPE:5000"
  "USDSUI:USDSUI_TYPE:5000"
)

setup_token() {
  local label="$1"
  local token_type="$2"
  local target_weight_bps="$3"

  echo ""
  echo "=== add_token<WLP, ${label}>  (target weight ${target_weight_bps} bps) ==="

  sui client ptb \
    --move-call "${WATERX_PERP_PKG}::lp_pool::add_token" "<${WLP_TYPE},${token_type}>" \
        "@${ADMIN_CAP}" \
        "@${WLP_POOL}" \
        "${TOKEN_DECIMAL}u8" \
        "${target_weight_bps}" \
        "${MINT_FEE_BPS}" \
        "${BURN_FEE_BPS}" \
        "${MAX_CAPACITY}" \
        "${MIN_DEPOSIT}" \
        "${BORROW_RATE_0}" \
        "${BORROW_RATE_1}" \
        "${BORROW_RATE_2}" \
        "${UTIL_THRESHOLD_0_BPS}" \
        "${UTIL_THRESHOLD_1_BPS}" \
        "${BORROW_INTERVAL_MS}" \
        "${MAX_RESERVE_RATIO_BPS}" \
        "@${CLOCK}" \
    --gas-budget ${GAS}

  sleep 1
}

for entry in "${TOKENS[@]}"; do
  IFS=":" read -r label type_var target_weight <<< "$entry"
  token_type="${!type_var}"
  setup_token "$label" "$token_type" "$target_weight"
done

echo ""
echo "Done. Verify with:"
echo "  sui client object ${WLP_POOL} --json | jq '.content.fields.token_types'"

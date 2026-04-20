#!/usr/bin/env bash
set -euo pipefail

# Collateral oracle setup (mainnet).
# For each collateral token (USDC, USDSUI), in one PTB:
#   1. aggregator::new<TOKEN>            → PriceAggregator<TOKEN>
#   2. aggregator::set_rule_weight<TOKEN, PythRule>(weight=1)
#   3. transfer::public_share_object(aggregator)
#   4. pyth_rule::set_identifier<TOKEN>(feed_bytes)
#
# One PTB per collateral — atomic, re-runnable per token by commenting/un-commenting.
# Aggregator object IDs are printed in tx output;
# copy them into src/constants.ts (MAINNET_COLLATERALS) afterwards.
#
# Requires `sui client active-address` to own the ListingCap.
#
# Usage: ./scripts/setup-collateral-aggregators.sh

# ── Package IDs (mainnet) ──────────────────────────────────────────
ORACLE_PKG="0xe23120dae1a64fb48f38f1fc9a6e9ab4dd5b8bc9e6c54b5bf02286e3fc622faa"
PYTH_RULE_PKG="0x98867517245a2833cc742c731d331133cf0eee221ea9db6950d567ad68950a3f"
PYTH_RULE_ORIGINAL="0x98867517245a2833cc742c731d331133cf0eee221ea9db6950d567ad68950a3f"

# ── Shared / owned objects ─────────────────────────────────────────
LISTING_CAP="0x39537645b23845acb16f80a4a38b27b904b6a019bc9328264e2db0bdf20eaf06"
PYTH_RULE_CONFIG="0x292239e3c42e7683203d66fa2e1c78ed74cdc813331736a22b8406bbf8fe0c33"

# ── Types ──────────────────────────────────────────────────────────
PYTH_WITNESS="${PYTH_RULE_ORIGINAL}::pyth_rule::PythRule"

# ── Aggregator config ─────────────────────────────────────────────
WEIGHT_THRESHOLD=1
OUTLIER_TOLERANCE_BPS=2000
PYTH_WEIGHT=1

GAS=500000000

# ── Collaterals ────────────────────────────────────────────────────
# Format: TOKEN_TYPE|PYTH_MAINNET_FEED_HEX  (pipe-delimited to avoid clashing with :: in types)
COLLATERALS=(
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC|eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"
  "0x44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1::usdsui::USDSUI|d510fcdb3a63f35d3bb118d5db3afc5815a3f13bc55d48abb893b63f0315902a"
)

# Convert hex string → PTB vector<u8> literal: "vector[0xabu8,0xcdu8,...]"
hex_to_ptb_vec() {
  local hex="$1"
  local out="vector["
  local i=0 sep=""
  while [ $i -lt ${#hex} ]; do
    out+="${sep}0x${hex:$i:2}u8"
    sep=","
    i=$((i + 2))
  done
  out+="]"
  printf '%s' "$out"
}

setup_collateral_aggregator() {
  local token_type="$1"
  local feed_hex="$2"
  local agg_type="${ORACLE_PKG}::aggregator::PriceAggregator<${token_type}>"
  local feed_vec
  feed_vec=$(hex_to_ptb_vec "$feed_hex")

  echo ""
  echo "=== ${token_type}  (Pyth feed 0x${feed_hex:0:16}…) ==="

  sui client ptb \
    --move-call "${ORACLE_PKG}::aggregator::new" "<${token_type}>" \
        "@${LISTING_CAP}" "${WEIGHT_THRESHOLD}" "${OUTLIER_TOLERANCE_BPS}" \
    --assign agg \
    --move-call "${ORACLE_PKG}::aggregator::set_rule_weight" "<${token_type},${PYTH_WITNESS}>" \
        agg "@${LISTING_CAP}" "${PYTH_WEIGHT}u8" \
    --move-call "sui::transfer::public_share_object" "<${agg_type}>" agg \
    --move-call "${PYTH_RULE_PKG}::pyth_rule::set_identifier" "<${token_type}>" \
        "@${PYTH_RULE_CONFIG}" "@${LISTING_CAP}" "${feed_vec}" \
    --gas-budget ${GAS}

  sleep 1
}

for entry in "${COLLATERALS[@]}"; do
  IFS="|" read -r token_type feed_hex <<< "$entry"
  setup_collateral_aggregator "$token_type" "$feed_hex"
done

echo ""
echo "Done. Note the new PriceAggregator<…> object IDs from each tx output above."
echo "Update src/constants.ts → MAINNET_COLLATERALS with the new aggregator IDs."

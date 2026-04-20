#!/usr/bin/env bash
set -euo pipefail

# Per-market oracle setup (mainnet).
# Markets are already created — this script sets up aggregators + Pyth identifiers.
# For each market_symbol::<SYM>_USD, in one PTB:
#   1. aggregator::new<SYM>            → PriceAggregator<SYM>
#   2. aggregator::set_rule_weight<SYM, PythRule>(weight=1)
#   3. transfer::public_share_object(aggregator)
#   4. pyth_rule::set_identifier<SYM>(feed_bytes)
#
# One PTB per market — atomic, re-runnable per market by commenting/un-commenting
# the MARKETS entries. Aggregator object IDs are printed in tx output;
# copy them into src/constants.ts (MAINNET_MARKETS) afterwards.
#
# Requires `sui client active-address` to own the ListingCap.
#
# Usage: ./scripts/setup-markets.sh

# ── Package IDs (waterx-contracts/*/Published.toml, mainnet) ────────
ORACLE_PKG="0xe23120dae1a64fb48f38f1fc9a6e9ab4dd5b8bc9e6c54b5bf02286e3fc622faa"
PYTH_RULE_PKG="0x98867517245a2833cc742c731d331133cf0eee221ea9db6950d567ad68950a3f"
PYTH_RULE_ORIGINAL="0x98867517245a2833cc742c731d331133cf0eee221ea9db6950d567ad68950a3f"  # v1 — original-id == published-at
MARKET_SYMBOL_PKG="0xe5a95e2eb52a8ea594d295db9f4930cf07cc84871a584bfc7569946a5408c998"

# ── Shared / owned objects (Published.toml) ──
LISTING_CAP="0x39537645b23845acb16f80a4a38b27b904b6a019bc9328264e2db0bdf20eaf06"
PYTH_RULE_CONFIG="0x292239e3c42e7683203d66fa2e1c78ed74cdc813331736a22b8406bbf8fe0c33"

# ── Types ───────────────────────────────────────────────────────────
PYTH_WITNESS="${PYTH_RULE_ORIGINAL}::pyth_rule::PythRule"

# ── Aggregator config ───────────────────────────────────────────────
WEIGHT_THRESHOLD=1                # Pyth alone meets the threshold
OUTLIER_TOLERANCE_BPS=2000        # 20% (only relevant once >1 source is added)
PYTH_WEIGHT=1

GAS=500000000

# ── Markets ─────────────────────────────────────────────────────────
# Format: SYMBOL:PYTH_MAINNET_FEED_HEX
# (Pyth mainnet feed IDs from src/constants.ts PYTH_PRICE_FEED_IDS)
MARKETS=(
  # "BTC_USD:e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
  # "ETH_USD:ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
  # "SOL_USD:ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
  "SUI_USD:23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744"
  # "DEEP_USD:29bdd5248234e33bd93d3b81100b5fa32eaa5997843847e2c2cb16d7c6d9f7ff"
  # "WAL_USD:eba0732395fae9dec4bae12e52760b35fc1c5671e2da8b449c9af4efe5d54341"

  # "AAPLX_USD:49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688"
  # "GOOGLX_USD:5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6"
  # "METAX_USD:78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe"
  # "NVDAX_USD:b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593"
  # "QQQX_USD:9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d"
  # "SPYX_USD:19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5"
  # "TSLAX_USD:16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1"
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

setup_aggregator() {
  local symbol="$1"
  local feed_hex="$2"
  local base_type="${MARKET_SYMBOL_PKG}::market_symbol::${symbol}"
  local agg_type="${ORACLE_PKG}::aggregator::PriceAggregator<${base_type}>"
  local feed_vec
  feed_vec=$(hex_to_ptb_vec "$feed_hex")

  echo ""
  echo "=== ${symbol}  (Pyth feed 0x${feed_hex:0:16}…) ==="

  sui client ptb \
    --move-call "${ORACLE_PKG}::aggregator::new" "<${base_type}>" \
        "@${LISTING_CAP}" "${WEIGHT_THRESHOLD}" "${OUTLIER_TOLERANCE_BPS}" \
    --assign agg \
    --move-call "${ORACLE_PKG}::aggregator::set_rule_weight" "<${base_type},${PYTH_WITNESS}>" \
        agg "@${LISTING_CAP}" "${PYTH_WEIGHT}u8" \
    --move-call "sui::transfer::public_share_object" "<${agg_type}>" agg \
    --move-call "${PYTH_RULE_PKG}::pyth_rule::set_identifier" "<${base_type}>" \
        "@${PYTH_RULE_CONFIG}" "@${LISTING_CAP}" "${feed_vec}" \
    --gas-budget ${GAS}

  sleep 1
}

for entry in "${MARKETS[@]}"; do
  IFS=":" read -r symbol feed_hex <<< "$entry"
  setup_aggregator "$symbol" "$feed_hex"
done

echo ""
echo "Done. Note the new PriceAggregator<…> object IDs from each tx output above."
echo "Update src/constants.ts → MAINNET_MARKETS with the new aggregator IDs."

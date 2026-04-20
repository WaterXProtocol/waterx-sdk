#!/usr/bin/env bash
set -euo pipefail

# Update pyth_rule::set_identifier for tokens whose Pyth feed ID has changed.
# Only calls set_identifier — does NOT create aggregators or set weights.
#
# Requires `sui client active-address` to own the ListingCap.
#
# Usage: ./scripts/setup-pyth-identifier.sh

# ── Package IDs (mainnet) ──────────────────────────────────────────
PYTH_RULE_PKG="0x98867517245a2833cc742c731d331133cf0eee221ea9db6950d567ad68950a3f"
MARKET_SYMBOL_PKG="0xe5a95e2eb52a8ea594d295db9f4930cf07cc84871a584bfc7569946a5408c998"

# ── Shared / owned objects ─────────────────────────────────────────
LISTING_CAP="0x39537645b23845acb16f80a4a38b27b904b6a019bc9328264e2db0bdf20eaf06"
PYTH_RULE_CONFIG="0x292239e3c42e7683203d66fa2e1c78ed74cdc813331736a22b8406bbf8fe0c33"

GAS=100000000

# ── Feeds to update ────────────────────────────────────────────────
# Format: TYPE|PYTH_FEED_HEX
# For market_symbol types use SYMBOL as shorthand (expanded to full type below).
# For collateral types use the full type string.
FEEDS=(
  # xStocks — switched from Equity.US to Crypto (24/7 synthetic)
  "AAPLX_USD|978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675"
  "GOOGLX_USD|b911b0329028cd0283e4259c33809d62942bd2716a58084e5f31d64c00b5424e"
  "METAX_USD|bf3e5871be3f80ab7a4d1f1fd039145179fb58569e159aee1ccd472868ea5900"
  "NVDAX_USD|4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f"
  "QQQX_USD|178a6f73a5aede9d0d682e86b0047c9f333ed0efe5c6537ca937565219c4054d"
  "SPYX_USD|2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14"
  "TSLAX_USD|47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362"
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

set_identifier() {
  local token_type="$1"
  local feed_hex="$2"
  local feed_vec
  feed_vec=$(hex_to_ptb_vec "$feed_hex")

  echo ""
  echo "=== ${token_type}  (Pyth feed 0x${feed_hex:0:16}…) ==="

  sui client ptb \
    --move-call "${PYTH_RULE_PKG}::pyth_rule::set_identifier" "<${token_type}>" \
        "@${PYTH_RULE_CONFIG}" "@${LISTING_CAP}" "${feed_vec}" \
    --gas-budget ${GAS}

  sleep 1
}

for entry in "${FEEDS[@]}"; do
  IFS="|" read -r symbol feed_hex <<< "$entry"
  # If it looks like a market symbol (no ::), expand to full type
  if [[ "$symbol" != *"::"* ]]; then
    token_type="${MARKET_SYMBOL_PKG}::market_symbol::${symbol}"
  else
    token_type="$symbol"
  fi
  set_identifier "$token_type" "$feed_hex"
done

echo ""
echo "Done. Pyth identifiers updated."
echo "Next: create PriceInfoObjects for the new feeds (if not yet on-chain),"
echo "then update priceInfoId in src/constants.ts."

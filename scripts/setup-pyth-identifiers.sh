#!/usr/bin/env bash
set -euo pipefail

# Set Pyth feed identifiers for all tokens on the PythRule Config.
# Uses `sui client call` — no secret key needed, uses active CLI address.
#
# Usage: ./scripts/setup-pyth-identifiers.sh

PYTH_RULE_PKG="0xecd0b3db574ac2ad6b1d6828e5643e7ffb9ff919d8b04843d411dd8b7e027e94"
PYTH_RULE_CONFIG="0xa4633aeb3c8a8f6a9cce50b767026e88db31e9364156949d1f4be9ce61d3ebb8"
LISTING_CAP="0xa5d55065e5f4dda8d17213e425176198332ac639dee5b732c1892a4d8cc49854"

GAS=200000000

# ── Token types ─────────────────────────────────────────────────────
BTC_TYPE="0x64158e48941d4c6e868b3ef0dad03ee587d3acafcb928cf139be42f5df8a9c36::waterx_btc::WATERX_BTC"
ETH_TYPE="0x64158e48941d4c6e868b3ef0dad03ee587d3acafcb928cf139be42f5df8a9c36::waterx_eth::WATERX_ETH"
SOL_TYPE="0xaa0fe78f01a91b6aaa27b78ad934cd78b3886d33dcabdb06633f481f377e19e4::waterx_sol::WATERX_SOL"
SUI_TYPE="0xaa0fe78f01a91b6aaa27b78ad934cd78b3886d33dcabdb06633f481f377e19e4::waterx_sui::WATERX_SUI"
DEEP_TYPE="0xaa0fe78f01a91b6aaa27b78ad934cd78b3886d33dcabdb06633f481f377e19e4::waterx_deep::WATERX_DEEP"
WAL_TYPE="0xaa0fe78f01a91b6aaa27b78ad934cd78b3886d33dcabdb06633f481f377e19e4::waterx_wal::WATERX_WAL"
USDC_TYPE="0x7ccd477e884ec74f960b23a8b34b7d87999e4d7ee0dde738a0c25f46200f201a::mock_usdc::MOCK_USDC"
USDSUI_TYPE="0xc0fad30bc21babe3b8b51c6a4c380d27b61a47e34b26968daf20315da0e35016::mock_usdsui::MOCK_USDSUI"

# ── Helper: hex string → JSON u8 array ─────────────────────────────
hex_to_u8_array() {
  local hex="$1"
  local arr="["
  local i=0
  while [ $i -lt ${#hex} ]; do
    [ $i -gt 0 ] && arr+=","
    arr+="$(printf '%d' "0x${hex:$i:2}")"
    i=$(( i + 2 ))
  done
  arr+="]"
  echo "$arr"
}

# ── Set identifiers ────────────────────────────────────────────────
# Format: LABEL:TYPE_VAR:FEED_HEX
# USDSUI uses USDC feed (~$1 peg)

echo "=== Setting Pyth feed identifiers ==="

for entry in \
  "BTC:BTC_TYPE:f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b" \
  "ETH:ETH_TYPE:ca80ba6dc32e08d06f1aa886011eed1d77c77be9eb761cc10d72b7d0a2fd57a6" \
  "SOL:SOL_TYPE:fe650f0367d4a7ef9815a593ea15d36593f0643aaaf0149bb04be67ab851decd" \
  "SUI:SUI_TYPE:50c67b3fd225db8912a424dd4baed60ffdde625ed2feaaf283724f9608fea266" \
  "DEEP:DEEP_TYPE:e18bf5fa857d5ca8af1f6a458b26e853ecdc78fc2f3dc17f4821374ad94d8327" \
  "WAL:WAL_TYPE:a6ba0195b5364be116059e401fb71484ed3400d4d9bfbdf46bd11eab4f9b7cea" \
  "USDC:USDC_TYPE:41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722" \
  "USDSUI:USDSUI_TYPE:41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722"; do
  LABEL="${entry%%:*}"
  REST="${entry#*:}"
  TYPE_VAR="${REST%%:*}"
  FEED_HEX="${REST#*:}"
  TOKEN_TYPE="${!TYPE_VAR}"
  FEED_BYTES=$(hex_to_u8_array "$FEED_HEX")
  echo "  $LABEL → ${FEED_HEX:0:16}..."
  sui client call \
    --package "$PYTH_RULE_PKG" --module pyth_rule --function set_identifier \
    --type-args "$TOKEN_TYPE" \
    --args "$PYTH_RULE_CONFIG" "$LISTING_CAP" "$FEED_BYTES" \
    --gas-budget $GAS
  sleep 1
done

echo ""
echo "Done. Pyth identifiers set for BTC, ETH, SOL, SUI, DEEP, WAL, USDC, USDSUI."

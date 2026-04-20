#!/usr/bin/env bash
set -euo pipefail

# Add SupraRule weight=1 to all PriceAggregators (base assets + collaterals).
# Uses `sui client call` — no secret key needed, uses active CLI address.
#
# Usage: ./scripts/setup-supra-oracle.sh

ORACLE_PKG="0xa00eb6c923368aef9aade69d75b348f53dc2ee344771ce3c3629dee05a0fb88c"
SUPRA_RULE_PKG="0xde280cdb680998d632cca7a1972627854aae9b4acf4cf254fc541395e9471b6d"
LISTING_CAP="0xa5d55065e5f4dda8d17213e425176198332ac639dee5b732c1892a4d8cc49854"
SUPRA_CONFIG="0x10c1b0ce0aba4b6ffbf4ef3047cdd8ebee9f445ad0cb8ed406fa4bba5aaedb62"

SUPRA_WITNESS="${SUPRA_RULE_PKG}::supra_rule::SupraRule"
WEIGHT=1
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

# ── Aggregator IDs ──────────────────────────────────────────────────
BTC_AGG="0x49b4ef44726620f8bc60fbaf721e3b5f84a7ddc2a8f7a4e55b396dff5cb77528"
ETH_AGG="0x7a54a6c68947fe1ed6c59ffe37fb03960863261993b2c556041e7944ae35c33c"
SOL_AGG="0xf9947f871cc67cb734a8a6b5f29368cce4753a93ba4c0d96516277475fa0e141"
SUI_AGG="0x6198facaceec8333930fa99108d809a43d2f31b3231424a082f6cbef227b7218"
DEEP_AGG="0xce7192008606def9cce51a7ab959170b4901eac570464e71f8494924120f548d"
WAL_AGG="0x7ef03c33d79898f805ec0e0c7082604c6dbf805f2bae1bfe77f20952f011628b"
USDC_AGG="0x6f9cd2133e7073376ac4de314873e625a8606bddb4daa33affd0a08933b8b2a7"
USDSUI_AGG="0x861d7fe0e5130ca818481f32eff768be1e097c897aa0c35ed9ae10d3f0553179"

# ── Supra pair IDs ──────────────────────────────────────────────────
# BTC=18, ETH=19, USDC=89, SUI=90, DEEP=491, WAL=534

# ── 1. Set Supra pair IDs (keyed by aggregator ID) ──────────────────
echo "=== Setting Supra pair IDs ==="

# Format: TYPE_VAR:AGG_VAR:PAIR_ID
for triple in \
  "BTC_TYPE:BTC_AGG:18" "ETH_TYPE:ETH_AGG:19" "SUI_TYPE:SUI_AGG:90" \
  "DEEP_TYPE:DEEP_AGG:491" "WAL_TYPE:WAL_AGG:534" "USDC_TYPE:USDC_AGG:89" "USDSUI_TYPE:USDSUI_AGG:89"; do  TYPE_VAR="${triple%%:*}"
  REST="${triple#*:}"
  AGG_VAR="${REST%%:*}"
  PAIR_ID="${REST##*:}"
  TOKEN_TYPE="${!TYPE_VAR}"
  AGG_ID="${!AGG_VAR}"
  LABEL="${TYPE_VAR%%_TYPE}"
  echo "  $LABEL (pair $PAIR_ID)..."
  sui client call \
    --package "$SUPRA_RULE_PKG" --module supra_rule --function set_pair_id \
    --type-args "$TOKEN_TYPE" \
    --args "$SUPRA_CONFIG" "$AGG_ID" "$LISTING_CAP" "$PAIR_ID" \
    --gas-budget $GAS
  sleep 1
done

# ── 2. Set SupraRule weight on all aggregators ──────────────────────
echo ""
echo "=== Setting SupraRule weight=$WEIGHT on all aggregators ==="

for entry in \
  "BTC_TYPE:BTC_AGG" "ETH_TYPE:ETH_AGG" "SOL_TYPE:SOL_AGG" "SUI_TYPE:SUI_AGG" \
  "DEEP_TYPE:DEEP_AGG" "WAL_TYPE:WAL_AGG" "USDC_TYPE:USDC_AGG" "USDSUI_TYPE:USDSUI_AGG"; do
  TYPE_VAR="${entry%%:*}"
  AGG_VAR="${entry##*:}"
  TOKEN_TYPE="${!TYPE_VAR}"
  AGG_ID="${!AGG_VAR}"
  LABEL="${TYPE_VAR%%_TYPE}"
  echo "  $LABEL aggregator..."
  sui client call \
    --package "$ORACLE_PKG" --module aggregator --function set_rule_weight \
    --type-args "$TOKEN_TYPE" "$SUPRA_WITNESS" \
    --args "$AGG_ID" "$LISTING_CAP" "$WEIGHT" \
    --gas-budget $GAS
  sleep 1
done

echo ""
echo "Done. SupraRule weight=$WEIGHT set for BTC, ETH, SOL, SUI, DEEP, WAL, USDC, USDSUI."

#!/usr/bin/env bash
set -euo pipefail

# Sets `pyth_rule::set_tolerance_sec<T>` for every supported token type
# (13 base assets + 2 collateral) in one atomic PTB.
#
# On-chain default is 30s (pyth_rule::DEFAULT_TOLERANCE_SEC) when no explicit
# tolerance is set — this script makes every value explicit so ops can tune
# each asset without redeploying.
#
# Recommended values:
#   - Crypto (BTC/ETH/SOL/SUI/DEEP/WAL):   30s   (Pyth testnet publishes ~1s)
#   - xStocks (AAPLX/GOOGLX/…):            600s  (market-hours only; stale off-hours)
#   - Stablecoins (USDC/USDSUI):           30s
#
# Requires `sui client active-address` to own the `ListingCap` (oracle listing admin).
#
# Usage: ./scripts/setup-pyth-tolerance.sh

# ── Package IDs (waterx-contracts/*/Published.toml, testnet) ────────
PYTH_RULE_PKG="0x884773e6a4fdf324ec158b863254386f907f89b2efa2773f2078cff0c5586383"
MARKET_SYMBOL_PKG="0xd08f5c03e1d5a87d411b39969e5294eb0e5d10560105a747aefa77c0b17facae"
MOCK_USDC_PKG="0x7ccd477e884ec74f960b23a8b34b7d87999e4d7ee0dde738a0c25f46200f201a"
MOCK_USDSUI_PKG="0xc0fad30bc21babe3b8b51c6a4c380d27b61a47e34b26968daf20315da0e35016"

# ── Shared / owned objects ──────────────────────────────────────────
PYTH_RULE_CONFIG="0xa4633aeb3c8a8f6a9cce50b767026e88db31e9364156949d1f4be9ce61d3ebb8"
LISTING_CAP="0xa5d55065e5f4dda8d17213e425176198332ac639dee5b732c1892a4d8cc49854"

# ── Tolerance defaults (seconds) ────────────────────────────────────
CRYPTO_TOLERANCE=30
XSTOCK_TOLERANCE=30
STABLE_TOLERANCE=31536000

# ── Token types to set tolerance for ────────────────────────────────
# Format: "FULL_MOVE_TYPE:TOLERANCE_SEC"
TOKENS=(
  # Crypto base assets
  "${MARKET_SYMBOL_PKG}::market_symbol::BTC_USD:${CRYPTO_TOLERANCE}"
  "${MARKET_SYMBOL_PKG}::market_symbol::ETH_USD:${CRYPTO_TOLERANCE}"
  "${MARKET_SYMBOL_PKG}::market_symbol::SOL_USD:${CRYPTO_TOLERANCE}"
  "${MARKET_SYMBOL_PKG}::market_symbol::SUI_USD:${CRYPTO_TOLERANCE}"
  "${MARKET_SYMBOL_PKG}::market_symbol::DEEP_USD:${CRYPTO_TOLERANCE}"
  "${MARKET_SYMBOL_PKG}::market_symbol::WAL_USD:${CRYPTO_TOLERANCE}"

  # xStock base assets (longer tolerance — Pyth publishes only during market hours)
  "${MARKET_SYMBOL_PKG}::market_symbol::AAPLX_USD:${XSTOCK_TOLERANCE}"
  "${MARKET_SYMBOL_PKG}::market_symbol::GOOGLX_USD:${XSTOCK_TOLERANCE}"
  "${MARKET_SYMBOL_PKG}::market_symbol::METAX_USD:${XSTOCK_TOLERANCE}"
  "${MARKET_SYMBOL_PKG}::market_symbol::NVDAX_USD:${XSTOCK_TOLERANCE}"
  "${MARKET_SYMBOL_PKG}::market_symbol::QQQX_USD:${XSTOCK_TOLERANCE}"
  "${MARKET_SYMBOL_PKG}::market_symbol::SPYX_USD:${XSTOCK_TOLERANCE}"
  "${MARKET_SYMBOL_PKG}::market_symbol::TSLAX_USD:${XSTOCK_TOLERANCE}"

  # Collateral
  "${MOCK_USDC_PKG}::mock_usdc::MOCK_USDC:${STABLE_TOLERANCE}"
  "${MOCK_USDSUI_PKG}::mock_usdsui::MOCK_USDSUI:${STABLE_TOLERANCE}"
)

GAS=200000000

# ── Build one PTB with every set_tolerance_sec call ─────────────────
PTB_ARGS=()
for entry in "${TOKENS[@]}"; do
  # Split off the last ':<number>' so ':' in the Move type doesn't break parsing.
  tol="${entry##*:}"
  type_tag="${entry%:*}"

  echo "  set_tolerance_sec<${type_tag}> = ${tol}s"

  PTB_ARGS+=(
    --move-call "${PYTH_RULE_PKG}::pyth_rule::set_tolerance_sec" "<${type_tag}>"
      "@${PYTH_RULE_CONFIG}" "@${LISTING_CAP}" "${tol}"
  )
done

echo ""
echo "Submitting PTB (${#TOKENS[@]} set_tolerance_sec calls)…"
sui client ptb "${PTB_ARGS[@]}" --gas-budget ${GAS}

echo ""
echo "Done."

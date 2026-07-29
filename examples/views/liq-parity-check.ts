/**
 * WL-2248 AC3 parity harness — for every live position on the network, compare
 * the deployed view's `est_liq_price` (chain-computed at a whole-dollar probe
 * price) against SDK `calcEstLiqPrice` fed with the view's exact fee semantics
 * (borrow + open fee; funding income credited via saturating-sub; NO close fee
 * — the view deliberately omits it, unlike `position::is_liquidatable`).
 *
 *   WATERX_CONFIG_URL=<waterx-config raw json> pnpm exec tsx examples/views/liq-parity-check.ts
 *
 * 2026-07-29 testnet run: 69 positions, maxΔ 1.05e-2 abs (~4e-8 rel), 0 failures.
 */
import { buildClient } from "../_shared.ts";
import { FLOAT_SCALE } from "../../src/constants.ts";
import { getMarketData, getMarketPositions } from "../../src/perp/fetch.ts";
import { calcEstLiqPrice } from "../../src/utils/math.ts";

const PROBE_PRICE_USD = 1000n; // whole-dollar u64 — any positive value is valid for parity

const client = await buildClient();
const tickers = Object.keys(
  (client.config as { packages: { waterx_perp: { markets?: Record<string, unknown> } } }).packages
    .waterx_perp.markets ?? {},
);
console.log(`markets in config: ${tickers.join(", ")}`);

let total = 0;
let maxAbsDelta = 0;
let failures = 0;
// A fetch failure means a market (or a page of its positions) was silently
// skipped — the "every live position" claim no longer holds, so the run must
// NOT report success. Tracked separately from numeric parity failures.
let fetchFailures = 0;

for (const ticker of tickers) {
  let md;
  try {
    md = await getMarketData(client, { ticker });
  } catch (e) {
    console.log(`  [${ticker}] getMarketData failed: ${(e as Error).message}`);
    fetchFailures += 1;
    continue;
  }
  const mmr = Number(md.maintenance_margin) / Number(FLOAT_SCALE);

  // Follow nextCursor until the market is exhausted — "every live position"
  // must mean every page, not the first 50.
  let cursor: bigint | undefined = 0n;
  while (cursor !== undefined) {
    let page;
    try {
      page = await getMarketPositions(client, {
        ticker,
        basePriceUsd: PROBE_PRICE_USD,
        collateralPriceUsd: 1n,
        cursor,
        pageSize: 50n,
      });
    } catch (e) {
      console.log(`  [${ticker}] getMarketPositions failed: ${(e as Error).message}`);
      fetchFailures += 1;
      break;
    }
    cursor = page.nextCursor;

    for (const p of page.positions) {
      total += 1;
      const dec = Number(p.collateral_decimal);
      const denom = 10 ** dec;
      const collateralUsd = Number(p.collateral_amount) / denom; // collPrice = $1
      const borrowOpenUsd = (Number(p.borrow_fee) + Number(p.unrealized_trading_fee)) / denom;
      const fundingUsd = Number(p.funding_fee) / denom;
      // View semantics: owed → add; income → saturating-sub. NO close fee.
      const totalFeesUsd = p.funding_fee_positive
        ? borrowOpenUsd + fundingUsd
        : Math.max(0, borrowOpenUsd - fundingUsd);

      const sdkLiq = calcEstLiqPrice({
        isLong: p.is_long,
        avgPrice: Number(p.average_price) / Number(FLOAT_SCALE),
        sizeInAsset: Number(p.size) / Number(FLOAT_SCALE),
        collateralUsd,
        maintenanceMarginRate: mmr,
        spotPrice: Number(PROBE_PRICE_USD),
        totalFeesUsd,
      });
      const chainLiq = Number(p.est_liq_price) / Number(FLOAT_SCALE);
      const delta = Math.abs(sdkLiq - chainLiq);
      maxAbsDelta = Math.max(maxAbsDelta, delta);
      // AC3 bound: well under 1 display tick. f64 vs Move 1e9 fixed-point makes
      // exact 1e-9-grid equality unattainable at 1e5 magnitudes; 1e-6 relative
      // (with a 1e-6 absolute floor) is ~4 orders tighter than any price tick.
      const tol = Math.max(1e-6, chainLiq * 1e-6);
      const ok = delta <= tol;
      if (!ok) failures += 1;
      console.log(
        `  [${ticker}] pos ${p.position_id} ${p.is_long ? "L" : "S"} avg=${(
          Number(p.average_price) / Number(FLOAT_SCALE)
        ).toFixed(4)} chain=${chainLiq.toFixed(6)} sdk=${sdkLiq.toFixed(6)} Δ=${delta.toExponential(
          2,
        )} ${ok ? "OK" : "FAIL"}`,
      );
    }
  }
}

console.log(
  `\nparity: ${total} positions checked, maxΔ=${maxAbsDelta.toExponential(3)}, failures=${failures}, fetchFailures=${fetchFailures}`,
);
if (total === 0) console.log("NOTE: no live positions found — parity not exercised.");
if (fetchFailures > 0) {
  console.log(
    `INCOMPLETE COVERAGE: ${fetchFailures} market/page fetch(es) failed — some live positions were NOT checked; this run does not verify AC3.`,
  );
}
process.exit(failures > 0 || fetchFailures > 0 ? 1 : 0);

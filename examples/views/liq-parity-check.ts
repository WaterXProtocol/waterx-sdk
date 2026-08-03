/**
 * WL-2248 AC3 parity harness — for every live position on the network, compare
 * the deployed view's `est_liq_price` (chain-computed at a whole-dollar probe
 * price) against the SDK's canonical `calcEstLiqPriceRaw` — reached through the
 * `calcEstLiqPriceRawFromView` adapter, so the row→params MAPPING is under test
 * too, not just the arithmetic — with NO Number conversion anywhere in the
 * comparison path. `calcEstLiqPriceRaw` mirrors the view op-for-op (Move Float
 * truncation at each step, borrow + open fee summed before conversion, funding
 * income via saturating-sub, NO close fee — the view deliberately omits it,
 * unlike `position::is_liquidatable`), so parity is EXACT: `sdkRaw === chainRaw`
 * bit-identical, zero tolerance.
 *
 *   WATERX_CONFIG_URL=<waterx-config raw json> pnpm exec tsx examples/views/liq-parity-check.ts
 *
 * 2026-07-30 testnet run: 69 positions across all markets, failures=0,
 * fetchFailures=0 — bit-identical on every position.
 */
import { buildClient } from "../_shared.ts";
import { FLOAT_SCALE } from "../../src/constants.ts";
import { getMarketData, getMarketPositions } from "../../src/perp/fetch.ts";
import { calcEstLiqPriceRawFromView } from "../../src/perp/liq-view.ts";

const PROBE_PRICE_USD = 1000n; // whole-dollar u64 — any positive value is valid for parity

const client = await buildClient();
const tickers = Object.keys(
  (client.config as { packages: { waterx_perp: { markets?: Record<string, unknown> } } }).packages
    .waterx_perp.markets ?? {},
);
console.log(`markets in config: ${tickers.join(", ")}`);

let total = 0;
// Largest |sdkRaw − chainRaw| AMONG FAILURES only. `sdkRaw === chainRaw` is the
// sole pass criterion, so a delta is computed exclusively to describe a failure
// — a passing position's delta is 0n by definition and never worth 69 bigint
// subtractions to restate.
let maxFailureDeltaRaw = 0n;
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
  const maintenanceMarginRaw = BigInt(md.maintenance_margin);

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
      // Through the SDK's own view→raw adapter, so this run proves the MAPPING
      // as well as the math: the same PROBE_PRICE_USD / 1n the page above was
      // fetched at are threaded in, satisfying the adapter's read-at-these-
      // prices invariant.
      const sdkRaw = calcEstLiqPriceRawFromView(p, {
        maintenanceMarginRaw,
        basePriceUsd: PROBE_PRICE_USD,
        collateralPriceUsd: 1n,
      });
      const chainRaw = BigInt(p.est_liq_price);
      // Exact raw parity — bit-identical or FAIL. No tolerance: both sides are
      // the same truncating u128 fixed-point pipeline, so any delta is a bug.
      const ok = sdkRaw === chainRaw;
      let deltaNote = "";
      if (!ok) {
        failures += 1;
        const deltaRaw = sdkRaw >= chainRaw ? sdkRaw - chainRaw : chainRaw - sdkRaw;
        if (deltaRaw > maxFailureDeltaRaw) maxFailureDeltaRaw = deltaRaw;
        deltaNote = ` Δraw=${deltaRaw}`;
      }
      // Display-only conversions below — never part of the comparison above.
      console.log(
        `  [${ticker}] pos ${p.position_id} ${p.is_long ? "L" : "S"} avg=${(
          Number(p.average_price) / Number(FLOAT_SCALE)
        ).toFixed(4)} chainRaw=${chainRaw} sdkRaw=${sdkRaw}${deltaNote} ${ok ? "OK" : "FAIL"}`,
      );
    }
  }
}

console.log(
  `\nparity: ${total} positions checked, failures=${failures}, fetchFailures=${fetchFailures}` +
    (failures > 0
      ? `, worst failing Δraw=${maxFailureDeltaRaw} (1e-9-price units)`
      : " — every checked position bit-identical"),
);
if (total === 0) console.log("NOTE: no live positions found — parity not exercised.");
if (fetchFailures > 0) {
  console.log(
    `INCOMPLETE COVERAGE: ${fetchFailures} market/page fetch(es) failed — some live positions were NOT checked; this run does not verify AC3.`,
  );
}
process.exit(failures > 0 || fetchFailures > 0 ? 1 : 0);

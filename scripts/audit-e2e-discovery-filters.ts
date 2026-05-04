#!/usr/bin/env tsx
/**
 * Compare raw on-chain positions (paginated `getMarketPositions`) with the same filters
 * used by `discoverActivePosition` / matrix tiers — whether skips are "no positions in scan depth"
 * vs "every candidate rejected by filters".
 *
 * Usage:
 *   pnpm audit:e2e-discovery
 *   pnpm audit:e2e-discovery -- --testnet
 *   pnpm audit:e2e-discovery -- --bases WAL,DEEP,SPYX
 *
 * Uses plain `WaterXClient` (not the Vitest e2e gRPC retry proxy); public RPC may return 429.
 */
import process from "node:process";

import type { BaseAsset } from "../src/constants.ts";
import {
  getMarketCooldownMs,
  getMarketPositions,
  getMarketSummary,
  WaterXClient,
} from "../src/index.ts";
import type { PositionDataView } from "../src/view-types.ts";
import {
  discoverActivePosition,
  discoverActivePositionFirstMatchingTiers,
  discoverActivePositionForNegativeOpen,
  discoveryTiersForStatefulMatrixForBase,
  evaluatePositionAgainstDiscoverOpts,
  type DiscoverActivePositionOpts,
  type DiscoverPositionGateCtx,
} from "../test/helpers/e2e/discover-on-chain-position.ts";
import { primeLifecycleOracleUsdPrices } from "../test/helpers/e2e/lifecycle-oracle-usd-prices.ts";
import {
  activeLifecycleTestBasesConfigured,
  activeLifecycleTestBasesForClient,
  lifecycleRow,
} from "../test/helpers/e2e/lifecycle-test-markets.ts";

function parseArgs(argv: string[]): { testnet: boolean; bases: BaseAsset[] | null } {
  let testnet = false;
  let basesArg: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--testnet") testnet = true;
    else if (a === "--mainnet") testnet = false;
    else if (a === "--bases" && argv[i + 1]) {
      basesArg = argv[++i]!;
    }
  }
  const all = activeLifecycleTestBasesConfigured();
  if (!basesArg) return { testnet, bases: null };
  const want = new Set(
    basesArg
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );
  const bases = all.filter((b) => want.has(b as string)) as BaseAsset[];
  const unknown = [...want].filter((w) => !all.includes(w as BaseAsset));
  if (unknown.length) {
    console.warn(`Unknown or disabled bases (no LIFECYCLE row): ${unknown.join(", ")}`);
  }
  return { testnet, bases: bases.length ? bases : all };
}

async function collectOpenPositions(
  client: WaterXClient,
  base: BaseAsset,
  maxPages: number,
  pageSize: number,
): Promise<PositionDataView[]> {
  const basePriceUsd = Math.max(1, Math.round(lifecycleRow(base).approxPrice));
  const out: PositionDataView[] = [];
  let cursor = 0;
  for (let page = 0; page < maxPages; page++) {
    const { positions, nextCursor } = await getMarketPositions(
      client,
      base,
      basePriceUsd,
      cursor,
      pageSize,
      1,
    );
    for (const p of positions) {
      if (p.size > 0n) out.push(p);
    }
    if (nextCursor === undefined) break;
    cursor = nextCursor;
  }
  return out;
}

async function histogramFirstFailure(
  client: WaterXClient,
  base: BaseAsset,
  positions: PositionDataView[],
  opts: DiscoverActivePositionOpts,
): Promise<Map<string, number>> {
  const m = client.getMarketEntry(base);
  let maxLevBpsForFilter: bigint | null = null;
  const utilPct = opts.maxLeverageUtilizationPercent;
  if (utilPct != null && utilPct >= 1 && utilPct <= 99) {
    try {
      const summary = await getMarketSummary(client, m.marketId, m.baseType);
      maxLevBpsForFilter = summary.maxLeverageBps;
    } catch {
      maxLevBpsForFilter = null;
    }
  }
  const cooldownMs = await getMarketCooldownMs(client, m.marketId);
  const usdcType = client.config.collaterals.USDC.type;
  const ctx: DiscoverPositionGateCtx = { maxLevBpsForFilter, cooldownMs, usdcType };
  const counts = new Map<string, number>();
  for (const p of positions) {
    const r = await evaluatePositionAgainstDiscoverOpts(client, p, opts, ctx, null);
    const key = r.ok ? "MATCH" : r.code;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

async function auditBase(
  client: WaterXClient,
  base: BaseAsset,
  scanPages: number,
  pageSize: number,
) {
  const row = lifecycleRow(base);
  console.log(`\n=== ${base} (simulateOpenCollateral raw = ${row.simulateOpenCollateral}) ===`);

  const open = await collectOpenPositions(client, base, scanPages, pageSize);
  if (open.length === 0) {
    console.log(
      `Raw open positions (size>0) within ${scanPages} pages x ${pageSize}: 0 — none in this scan depth.`,
    );
  } else {
    console.log(
      `Raw open positions (size>0) within ${scanPages} pages x ${pageSize}: ${open.length}`,
    );
  }

  const tiers = discoveryTiersForStatefulMatrixForBase(base);
  const matrixHit = await discoverActivePositionFirstMatchingTiers(client, base, tiers);
  const acctShort = matrixHit ? `${matrixHit.accountObjectAddress.slice(0, 18)}...` : "";
  console.log(
    `discoverActivePositionFirstMatchingTiers(matrix): ${matrixHit ? `HIT positionId=${matrixHit.positionId} account=${acctShort}` : "null"}`,
  );

  const negHit = await discoverActivePositionForNegativeOpen(client, base);
  console.log(
    `discoverActivePositionForNegativeOpen (min TTO USDC >= simulateOpenCollateral; no maxLeverageUtilizationPercent): ${negHit ? `HIT positionId=${negHit.positionId}` : "null"}`,
  );
  if (matrixHit == null && negHit != null) {
    console.log(
      "Note: matrix tiers apply maxLeverageUtilizationPercent; ForNegativeOpen does not — divergent results usually mean the leverage gate, not zero positions.",
    );
  }

  if (open.length === 0) {
    console.log(
      "Interpretation: skips are likely because there is no size>0 position in this scan window, not because filters are too strict.",
    );
    return;
  }

  console.log(`\nFirst-failure histogram per tier (same ${open.length} candidates):`);
  for (let i = 0; i < tiers.length; i++) {
    const h = await histogramFirstFailure(client, base, open, tiers[i]!);
    const parts = [...h.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`);
    console.log(`  tier ${i + 1}: ${parts.join(", ")}`);
    const matches = h.get("MATCH") ?? 0;
    if (matches === 0 && open.length > 0) {
      const top = [...h.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top && top[0] !== "MATCH") {
        console.log(
          `    tier ${i + 1}: no pass; top first-failure: ${top[0]} (${top[1]}/${open.length} rows)`,
        );
      }
    }
  }

  const relaxed = await discoverActivePosition(client, base, {
    maxPages: scanPages,
    requireCooldownElapsed: false,
    maxLeverageUtilizationPercent: undefined,
    minAccountBalanceForPositionCollateral: undefined,
    minAccountUsdcBalance: undefined,
    minPositionSize: undefined,
  });
  console.log(
    `\nUltra-relaxed discover (no cooldown / no lev util% / no min collateral / no min USDC, maxPages=${scanPages}): ${relaxed ? "HIT" : "null"}`,
  );
  if (!matrixHit && relaxed) {
    console.log(
      "Interpretation: on-chain positions exist, but every matrix tier rejected all candidates (check cooldown, leverage util%, min account collateral, minPositionSize).",
    );
  } else if (!matrixHit && !relaxed) {
    console.log(
      "Interpretation: even ultra-relaxed discovery found nothing in scanned pages (owner RPC failures, pagination depth, etc. still possible).",
    );
  } else {
    console.log("Interpretation: matrix discovery matches what stateful simulate tests expect.");
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const { testnet, bases } = parseArgs(argv);
  const client = testnet ? WaterXClient.testnet() : WaterXClient.mainnet();
  await primeLifecycleOracleUsdPrices(client);
  const network = testnet ? "testnet" : "mainnet";
  const list = bases ?? activeLifecycleTestBasesForClient(client);

  const scanPages = Math.max(
    20,
    ...list.flatMap((b) => discoveryTiersForStatefulMatrixForBase(b).map((t) => t.maxPages ?? 0)),
  );
  const pageSize = 40;

  console.log(`E2E discovery filter audit — ${network}`);
  console.log(`Scan depth: ${scanPages} pages x ${pageSize} (getMarketPositions / simulate)`);
  console.log(`Bases (${list.length}): ${list.join(", ")}`);

  for (const base of list) {
    try {
      await auditBase(client, base, scanPages, pageSize);
    } catch (e) {
      console.error("\n%s: ERROR", base, e instanceof Error ? e.message : e);
    }
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

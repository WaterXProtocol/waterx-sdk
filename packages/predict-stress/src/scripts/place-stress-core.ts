#!/usr/bin/env tsx
/**
 * Multi-wallet progressive broker stress (on-chain place + broker fill timing).
 *
 * Each phase runs N wallets in parallel (1 → 2 → 4 → 8 by default). One wallet
 * never signs two place txs at once; N wallets ⇒ N-way concurrent place.
 *
 * Setup:
 *   cp test/prediction/fixtures/stress-wallets.example.json test/prediction/fixtures/stress-wallets.json
 *   # fill 8 entries: privateKey + accountId per funded wxa wallet
 *
 * Preset modes (see test/prediction/scripts/README.md § Multi-wallet stress):
 *
 *   predict:place-stress-dry-run        catalog + wallet config, no txs
 *   predict:place-stress-smoke          1 wallet, place only
 *   predict:place-stress-smoke-fill     1 wallet, place + broker fill timing
 *   predict:place-stress-ramp             1→2→4→8 place + fill + 30s cooldown (default)
 *   predict:place-stress-timing         same as ramp (explicit alias)
 *   predict:place-stress-timing-max     8 parallel place + fill, no cooldown
 *   predict:place-stress-hammer-smoke   1 round × N parallel, place only
 *   predict:place-stress-hammer         10 rounds × N parallel, place only
 */
import {
  formatCatalogPlaceFailures,
  listTradeableCatalogBets,
  type TradeableCatalogMarket,
} from "../helpers/api-catalog-pure.ts";
import type { MarketSegment } from "../helpers/api-endpoints.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import {
  catalogFillBrokerOnly,
  DEFAULT_CATALOG_BROKER_ONLY_WAIT_MS,
  formatCatalogBetTiming,
  formatCatalogCliError,
  formatFillLatency,
  placeAndFillCatalogMarket,
  placeCatalogMarketOnly,
  type CatalogFillSource,
  type CatalogMarketBetOutcome,
} from "../helpers/catalog-cli.ts";
import { optionalEnv } from "../helpers/e2e-env.ts";
import type { IntegrationCtx } from "../helpers/integration-setup.ts";
import { resolveStressBetUsd, resolveStressMaxSpend } from "../helpers/staging-amounts.ts";
import {
  loadStressWallets,
  setupStressWallet,
  stressWalletLabel,
  type StressWalletEntry,
} from "../helpers/stress-wallets.ts";
import { loadPackageEnv } from "../load-env.ts";

loadPackageEnv();

const TESTNET_TX_EXPLORER = "https://suiscan.xyz/testnet/tx";

function readPositiveIntEnv(name: string, fallback?: number): number | undefined {
  const raw = optionalEnv(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readSegments(): MarketSegment[] {
  const raw = optionalEnv("E2E_STRESS_SEGMENTS") ?? optionalEnv("E2E_PLACE_ALL_SEGMENTS");
  if (!raw) return ["crypto", "sport"];
  const allowed = new Set<MarketSegment>(["crypto", "sport", "politics"]);
  const segments = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is MarketSegment => allowed.has(s as MarketSegment));
  return segments.length > 0 ? segments : ["crypto", "sport"];
}

function readPhases(walletCount: number): number[] {
  const raw = optionalEnv("E2E_STRESS_PHASES");
  if (raw) {
    const phases = raw
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (phases.length === 0) throw new Error("E2E_STRESS_PHASES parsed to empty list");
    return phases.map((p) => Math.min(p, walletCount));
  }
  return [1, 2, 4, 8].filter((p) => p <= walletCount);
}

function isTruthyEnv(name: string): boolean {
  const v = optionalEnv(name);
  return v === "1" || v === "true";
}

/** Repeat count for hammer / multi-round stress (default 1). */
function readStressRounds(): number {
  const n = readPositiveIntEnv("E2E_STRESS_ROUNDS", 1);
  return n != null && n > 0 ? n : 1;
}

/** Full parallel wave size for hammer mode (default: all wallets). */
function readHammerParallel(walletCount: number): number {
  const n = readPositiveIntEnv("E2E_STRESS_PARALLEL");
  if (n == null || n <= 0) return walletCount;
  return Math.min(n, walletCount);
}

function percentile(sorted: number[], p: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

interface StressSlotResult {
  round: number;
  phase: number;
  walletLabel: string;
  walletAddress: string;
  marketSlug: string;
  ok: boolean;
  error?: string;
  orderId?: bigint;
  positionId?: bigint;
  fillSource?: CatalogFillSource;
  buildMs?: number;
  placeTxMs?: number;
  fillDetectMs?: number;
  totalMs?: number;
  placeDigest?: string;
}

async function runStressSlot(params: {
  round: number;
  phase: number;
  ctx: IntegrationCtx;
  walletLabel: string;
  market: TradeableCatalogMarket;
  apiEnv: NonNullable<ReturnType<typeof resolveApiEnvironment>>;
  maxSpend: string;
  placeOnly: boolean;
  brokerWaitMs: number;
  brokerOnly: boolean;
}): Promise<StressSlotResult> {
  const creds = { accountId: params.ctx.accountId, sender: params.ctx.ownerAddress };
  const base = {
    round: params.round,
    phase: params.phase,
    walletLabel: params.walletLabel,
    walletAddress: params.ctx.ownerAddress,
    marketSlug: params.market.marketSlug,
  };

  try {
    if (params.placeOnly) {
      const placed = await placeCatalogMarketOnly(params.ctx, params.apiEnv, params.market, creds, {
        maxSpend: params.maxSpend,
      });
      return {
        ...base,
        ok: true,
        orderId: placed.orderId,
        positionId: placed.positionId,
        fillSource: placed.alreadyFilled ? "bypass" : undefined,
        fillDetectMs: placed.alreadyFilled ? 0 : undefined,
        totalMs: undefined,
        placeDigest: placed.placeDigest,
      };
    }

    const outcome = await placeAndFillCatalogMarket(
      params.ctx,
      params.apiEnv,
      params.market,
      creds,
      {
        maxSpend: params.maxSpend,
        brokerWaitMs: params.brokerWaitMs,
        brokerOnly: params.brokerOnly,
      },
    );
    return slotFromOutcome(base, outcome);
  } catch (err) {
    return { ...base, ok: false, error: formatCatalogCliError(err) };
  }
}

function slotFromOutcome(
  base: Pick<StressSlotResult, "round" | "phase" | "walletLabel" | "walletAddress" | "marketSlug">,
  outcome: CatalogMarketBetOutcome,
): StressSlotResult {
  return {
    ...base,
    ok: true,
    orderId: outcome.orderId,
    positionId: outcome.positionId,
    fillSource: outcome.fillSource,
    buildMs: outcome.timing?.buildMs,
    placeTxMs: outcome.timing?.placeTxMs,
    fillDetectMs: outcome.timing?.fillDetectMs ?? outcome.fillLatencyMs,
    totalMs: outcome.timing?.totalMs,
    placeDigest: outcome.placeDigest,
  };
}

function printPhaseSummary(
  round: number,
  phase: number,
  parallel: number,
  wallMs: number,
  slots: StressSlotResult[],
  roundsTotal: number,
) {
  const ok = slots.filter((s) => s.ok);
  const fail = slots.filter((s) => !s.ok);
  const fills = ok
    .map((s) => s.fillDetectMs)
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b);
  const totals = ok
    .map((s) => s.totalMs)
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b);
  const places = ok
    .map((s) => s.placeTxMs)
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b);

  console.log();
  console.log("─".repeat(72));
  const roundLabel = roundsTotal > 1 ? `Round ${round}/${roundsTotal} │ ` : "";
  console.log(
    `${roundLabel}Phase ${phase} │ parallel=${parallel} │ wall=${formatFillLatency(wallMs)} │ ok=${ok.length} fail=${fail.length}`,
  );
  for (const s of slots) {
    if (!s.ok) {
      console.log(`  ✗ ${s.walletLabel} @ ${s.marketSlug} — ${s.error}`);
      continue;
    }
    const timing =
      s.buildMs != null && s.placeTxMs != null && s.fillDetectMs != null && s.totalMs != null
        ? formatCatalogBetTiming({
            buildMs: s.buildMs,
            placeTxMs: s.placeTxMs,
            fillDetectMs: s.fillDetectMs,
            totalMs: s.totalMs,
          })
        : s.placeDigest
          ? `placed order=${s.orderId} ${TESTNET_TX_EXPLORER}/${s.placeDigest}`
          : `order=${s.orderId}`;
    console.log(`  ✓ ${s.walletLabel} @ ${s.marketSlug} — ${timing} fill=${s.fillSource ?? "n/a"}`);
  }
  if (fills.length > 0) {
    const p50 = percentile(fills, 50);
    const p95 = percentile(fills, 95);
    console.log(
      `  fill latency: min=${formatFillLatency(fills[0]!)} p50=${p50 != null ? formatFillLatency(p50) : "n/a"} p95=${p95 != null ? formatFillLatency(p95) : "n/a"} max=${formatFillLatency(fills[fills.length - 1]!)}`,
    );
  }
  if (totals.length > 0) {
    const p50 = percentile(totals, 50);
    console.log(
      `  end-to-end:   p50=${p50 != null ? formatFillLatency(p50) : "n/a"} (place+fill per wallet)`,
    );
  }
  if (places.length > 0 && fills.length === 0) {
    const p50 = percentile(places, 50);
    console.log(
      `  place tx:     p50=${p50 != null ? formatFillLatency(p50) : "n/a"} (no fill poll)`,
    );
  }
}

function takeMarkets(
  catalog: TradeableCatalogMarket[],
  count: number,
  cursor: { value: number },
): TradeableCatalogMarket[] {
  if (catalog.length === 0) return [];
  const out: TradeableCatalogMarket[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(catalog[cursor.value % catalog.length]!);
    cursor.value += 1;
  }
  return out;
}

async function main(): Promise<void> {
  const apiEnv = resolveApiEnvironment();
  if (!apiEnv) {
    console.error("No API env — set E2E_API_ENV=staging");
    process.exit(1);
  }

  let wallets: StressWalletEntry[];
  try {
    wallets = loadStressWallets();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
  if (wallets.length === 0) {
    console.error("stress wallets list is empty");
    process.exit(1);
  }

  const hammer = isTruthyEnv("E2E_STRESS_HAMMER");
  const dryRun =
    optionalEnv("E2E_STRESS_DRY_RUN") === "1" || optionalEnv("E2E_STRESS_DRY_RUN") === "true";
  const placeOnly = hammer || isTruthyEnv("E2E_STRESS_PLACE_ONLY");
  const brokerOnly = catalogFillBrokerOnly(true);
  const brokerWaitMs =
    readPositiveIntEnv("E2E_STRESS_BROKER_WAIT_MS") ?? DEFAULT_CATALOG_BROKER_ONLY_WAIT_MS;
  const rounds = readStressRounds();
  const cooldownMs = hammer
    ? (readPositiveIntEnv("E2E_STRESS_COOLDOWN_MS", 0) ?? 0)
    : (readPositiveIntEnv("E2E_STRESS_COOLDOWN_MS", 30_000) ?? 30_000);
  const pageLimit = readPositiveIntEnv("E2E_STRESS_FEED_LIMIT", 200) ?? 200;
  const phases = hammer ? [readHammerParallel(wallets.length)] : readPhases(wallets.length);
  const segments = readSegments();
  console.log("═".repeat(72));
  console.log(
    hammer
      ? "Multi-wallet place hammer (no fill poll)"
      : "Multi-wallet broker stress (progressive parallel place)",
  );
  console.log("═".repeat(72));
  console.log("API:         ", apiEnv.name, apiEnv.baseUrl);
  console.log(
    "Wallets:     ",
    wallets.length,
    `(file: ${optionalEnv("E2E_STRESS_WALLETS_FILE") ?? "config/wallets.json"})`,
  );
  if (hammer) {
    console.log("Hammer:      ", `${rounds} round(s) × ${phases[0]} parallel place`);
  } else {
    console.log("Phases:      ", phases.join(" → "), "concurrent");
    if (rounds > 1) console.log("Rounds:      ", rounds);
  }
  console.log("Segments:    ", segments.join(", "));
  console.log(
    "Stake:       ",
    "per-wallet (default $1.01 + $0.01/step — E2E_STRESS_BET_START_USD / E2E_STRESS_BET_STEP_USD / betUsd in JSON)",
  );
  console.log(
    "Mode:        ",
    placeOnly
      ? "PLACE ONLY (no broker wait)"
      : `place + broker fill (wait ${brokerWaitMs}ms, broker-only)`,
  );
  if (cooldownMs > 0) console.log("Cooldown:    ", `${cooldownMs}ms between phases`);
  if (dryRun) console.log("Dry run:     scan + wallet list only");
  console.log();

  const scanFailures: Parameters<typeof formatCatalogPlaceFailures>[0] = [];
  const catalog = await listTradeableCatalogBets(apiEnv, {
    segments,
    limit: pageLimit,
    includeBrowse: true,
    includeFeed: true,
    bothSides: false,
    failures: scanFailures,
  });
  if (catalog.length === 0) {
    console.error("No tradeable catalog markets:", formatCatalogPlaceFailures(scanFailures));
    process.exit(1);
  }
  console.log(`Catalog: ${catalog.length} tradeable slot(s)`);
  if (scanFailures.length > 0) {
    console.log("Scan skips:", formatCatalogPlaceFailures(scanFailures));
  }

  for (let i = 0; i < wallets.length; i += 1) {
    const w = wallets[i]!;
    const stakeUsd = resolveStressBetUsd(i, w.betUsd);
    const maxSpend = resolveStressMaxSpend(i, w.betUsd);
    console.log(
      `  ${stressWalletLabel(w, i)}: accountId=${w.accountId.slice(0, 10)}… stake=$${stakeUsd} maxSpend=${maxSpend}`,
    );
  }
  console.log();

  if (dryRun) {
    process.exit(0);
  }

  console.log("Setting up wallets (fund check per account)…");
  const contexts: IntegrationCtx[] = [];
  for (let i = 0; i < wallets.length; i += 1) {
    const label = stressWalletLabel(wallets[i]!, i);
    process.stdout.write(`  ${label} … `);
    try {
      contexts.push(await setupStressWallet(wallets[i]!));
      console.log(contexts[i]!.ownerAddress.slice(0, 10) + "…");
    } catch (err) {
      console.log("FAIL");
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }
  console.log();

  const allResults: StressSlotResult[] = [];
  const marketCursor = { value: 0 };

  for (let ri = 0; ri < rounds; ri += 1) {
    const round = ri + 1;
    if (rounds > 1) {
      console.log(`══ Round ${round}/${rounds} ══`);
    }

    for (let pi = 0; pi < phases.length; pi += 1) {
      const parallel = phases[pi]!;
      const phaseWallets = contexts.slice(0, parallel);
      const phaseWalletEntries = wallets.slice(0, parallel);
      const markets = takeMarkets(catalog, parallel, marketCursor);

      const waveLabel =
        rounds > 1
          ? `round ${round}/${rounds}, phase ${parallel}`
          : `phase ${parallel} (${parallel} parallel place)`;
      console.log(`Starting ${waveLabel}…`);
      const waveStart = Date.now();

      const slots = await Promise.all(
        phaseWallets.map((ctx, i) => {
          const market = markets[i]!;
          const entry = phaseWalletEntries[i]!;
          const label = stressWalletLabel(entry, i);
          const maxSpend = resolveStressMaxSpend(i, entry.betUsd);
          const slotParams = {
            round,
            phase: parallel,
            ctx,
            walletLabel: label,
            market,
            apiEnv,
            maxSpend,
            placeOnly,
            brokerWaitMs,
            brokerOnly,
          };
          return runStressSlot(slotParams);
        }),
      );

      const wallMs = Date.now() - waveStart;
      printPhaseSummary(round, parallel, parallel, wallMs, slots, rounds);
      allResults.push(...slots);

      const isLastWave = ri === rounds - 1 && pi === phases.length - 1;
      if (!isLastWave && cooldownMs > 0) {
        console.log(`Cooldown ${cooldownMs}ms before next wave…`);
        await sleep(cooldownMs);
      }
    }
  }

  const ok = allResults.filter((r) => r.ok);
  const fail = allResults.filter((r) => !r.ok);
  console.log();
  console.log("═".repeat(72));
  console.log(
    `Stress complete: ${ok.length} ok, ${fail.length} failed (${allResults.length} slots)`,
  );
  console.log("═".repeat(72));

  process.exit(fail.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

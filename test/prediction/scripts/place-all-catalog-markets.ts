#!/usr/bin/env tsx
/**
 * Scan staging catalog (feed + browse) and place + fill $1.11 on every tradeable side
 * (default: both sides per market — up+down, teamA+teamB).
 *
 * Usage:
 *   pnpm predict:place-all-markets
 *   E2E_PLACE_ALL_DRY_RUN=1 pnpm predict:place-all-markets   # list only (crypto+sport+politics)
 *   E2E_PLACE_ALL_LIMIT=5 pnpm predict:place-all-markets      # first N markets (× sides)
 *   E2E_PLACE_ALL_ONE_SIDE=1 pnpm predict:place-all-markets    # first side only per market
 *   E2E_CATALOG_KEEPER_FALLBACK=1 …  # opt-in local fillOrder when broker is down (default: broker-only)
 *   E2E_PLACE_ALL_BROKER_ONLY=1 …    # force broker-only even if keeper fallback is on
 *   E2E_PLACE_ALL_PLACE_ONLY=1 pnpm predict:place-all-markets   # place and exit — watch fill on frontend
 *   E2E_PLACE_ALL_CONCURRENCY=5 …  # parallel broker wait only (place txs stay sequential per wallet)
 *   E2E_PLACE_ALL_CRYPTO_EPOCHS=1 …  # also probe crypto upcoming time windows (?epoch=<endsAt>)
 *   E2E_PLACE_ALL_CRYPTO_EPOCH_LIMIT=3  # max upcoming windows per crypto slug (default 3)
 */
import { loadRepoEnvFiles } from "../../../scripts/load-repo-env.ts";
import {
  buildPlaceBetRequest,
  catalogBetKey,
  DEFAULT_CRYPTO_EPOCH_LIMIT,
  formatCatalogBetLabel,
  formatCatalogPlaceFailures,
  limitCatalogBetsByMarket,
  listTradeableCatalogBets,
} from "../helpers/api-catalog-pure.ts";
import type { MarketSegment } from "../helpers/api-endpoints.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import {
  BrokerFillTimeoutError,
  catalogFillBrokerOnly,
  completeCatalogMarketFill,
  DEFAULT_CATALOG_BROKER_ONLY_WAIT_MS,
  DEFAULT_CATALOG_KEEPER_FALLBACK_WAIT_MS,
  formatCatalogBetTiming,
  formatCatalogCliError,
  formatFillLatency,
  placeAndFillCatalogMarket,
  placeCatalogMarketOnly,
  placeCatalogMarketTx,
  type CatalogMarketBetOutcome,
  type CatalogPlaceOnlyOutcome,
  type CatalogPlacePending,
} from "../helpers/catalog-cli.ts";
import { optionalEnv } from "../helpers/e2e-env.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { setupIntegration } from "../helpers/integration-setup.ts";
import {
  readBrokerFriendlyPlaceOptions,
  readStagingBetUsd,
  readStagingMaxSpend,
} from "../helpers/staging-amounts.ts";

loadRepoEnvFiles();

const TESTNET_TX_EXPLORER = "https://suiscan.xyz/testnet/tx";

function readPositiveIntEnv(name: string): number | undefined {
  const raw = optionalEnv(name);
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function readSegments(): MarketSegment[] {
  const raw = optionalEnv("E2E_PLACE_ALL_SEGMENTS");
  if (!raw) return ["crypto", "sport"];
  const allowed = new Set<MarketSegment>(["crypto", "sport", "politics"]);
  const segments = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is MarketSegment => allowed.has(s as MarketSegment));
  return segments.length > 0 ? segments : ["crypto", "sport"];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Run `fn` over `items` with at most `concurrency` in flight. */
async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const workers = Math.min(Math.max(1, concurrency), items.length);
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function readBothSides(): boolean {
  const v = optionalEnv("E2E_PLACE_ALL_ONE_SIDE");
  return v !== "1" && v !== "true";
}

function readPlaceAllBrokerOnlyOverride(): boolean | undefined {
  const v = optionalEnv("E2E_PLACE_ALL_BROKER_ONLY");
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return undefined;
}

function readPlaceOnly(): boolean {
  const v = optionalEnv("E2E_PLACE_ALL_PLACE_ONLY");
  return v === "1" || v === "true";
}

function readIncludeCryptoEpochs(): boolean {
  const v = optionalEnv("E2E_PLACE_ALL_CRYPTO_EPOCHS");
  return v === "1" || v === "true";
}

function printPlaceOnlyWatchCard(params: {
  wallet: string;
  accountId: string;
  stakeUsd: number;
  placed: CatalogPlaceOnlyOutcome;
}): void {
  const { placed } = params;
  const side = placed.sideKey ?? "?";
  const lines = [
    "",
    "── place-only · watch on frontend ──",
    `orderId:    ${placed.orderId}`,
    `marketSlug: ${placed.marketSlug}`,
    `segment:    ${placed.segment}`,
    `side:       ${side}`,
    `stake:      $${params.stakeUsd} (maxSpend=${placed.maxSpend})`,
    `wallet:     ${params.wallet}`,
    `accountId:  ${params.accountId}`,
    placed.placeDigest ? `placeTx:    ${TESTNET_TX_EXPLORER}/${placed.placeDigest}` : "",
    placed.alreadyFilled
      ? `status:     already filled in place tx (positionId=${placed.positionId})`
      : "status:     OPEN — no local fill; waiting for backend broker",
    "──────────────────────────────────",
    "",
  ].filter(Boolean);
  console.log(lines.join("\n"));
}

async function main(): Promise<void> {
  const apiEnv = resolveApiEnvironment();
  if (!apiEnv) {
    console.error("No API env — set E2E_API_ENV=staging");
    process.exit(1);
  }
  if (!hasWriteCredentials()) {
    console.error("SUI_PRIVATE_KEY not set");
    process.exit(1);
  }

  const dryRun =
    optionalEnv("E2E_PLACE_ALL_DRY_RUN") === "1" || optionalEnv("E2E_PLACE_ALL_DRY_RUN") === "true";
  const limit = readPositiveIntEnv("E2E_PLACE_ALL_LIMIT");
  const delayMs = readPositiveIntEnv("E2E_PLACE_ALL_DELAY_MS") ?? 1_500;
  const concurrency = readPositiveIntEnv("E2E_PLACE_ALL_CONCURRENCY") ?? 1;
  const pageLimit = readPositiveIntEnv("E2E_PLACE_ALL_FEED_LIMIT") ?? 500;
  const includeFeed =
    optionalEnv("E2E_PLACE_ALL_INCLUDE_FEED") === "1" ||
    optionalEnv("E2E_PLACE_ALL_INCLUDE_FEED") === "true";
  const placeOnly = readPlaceOnly();
  const brokerOnly = !placeOnly && catalogFillBrokerOnly(readPlaceAllBrokerOnlyOverride());
  const brokerWaitMs =
    readPositiveIntEnv("E2E_PLACE_ALL_BROKER_WAIT_MS") ??
    (brokerOnly ? DEFAULT_CATALOG_BROKER_ONLY_WAIT_MS : DEFAULT_CATALOG_KEEPER_FALLBACK_WAIT_MS);
  const segments = readSegments();
  const stakeUsd = readStagingBetUsd();
  const maxSpend = readStagingMaxSpend();
  const bothSides = readBothSides();
  const includeCryptoEpochs = readIncludeCryptoEpochs();
  const cryptoEpochLimit =
    readPositiveIntEnv("E2E_PLACE_ALL_CRYPTO_EPOCH_LIMIT") ?? DEFAULT_CRYPTO_EPOCH_LIMIT;

  console.log("═".repeat(72));
  console.log("Place all tradeable catalog markets");
  console.log("═".repeat(72));
  console.log("API:        ", apiEnv.name, apiEnv.baseUrl);
  console.log("Segments:   ", segments.join(", "));
  console.log("Stake:      ", `$${stakeUsd} per side (maxSpend=${maxSpend})`);
  console.log("Sides:      ", bothSides ? "all tradeable (both sides)" : "first side only");
  console.log("Catalog:    ", includeFeed ? "browse + feed" : "browse only (sort=trending)");
  console.log("Page limit: ", pageLimit);
  if (placeOnly) {
    console.log("Mode:       PLACE ONLY (no wait — watch fill on frontend)");
  } else {
    console.log(
      "Broker wait:",
      brokerWaitMs,
      "ms",
      brokerOnly
        ? "(broker-only — no local fillOrder fallback)"
        : "before keeper fillOrder fallback",
    );
  }
  if (includeCryptoEpochs) {
    console.log("Crypto:     include upcoming time windows (max", cryptoEpochLimit, "per slug)");
  }
  if (limit) console.log("Limit:      ", limit, "markets");
  if (concurrency > 1) {
    console.log(
      "Concurrency:",
      concurrency,
      placeOnly
        ? "(ignored for place-only — on-chain place must be sequential)"
        : "parallel broker waits (place txs sequential per wallet)",
    );
  }
  if (dryRun) console.log("Mode:       DRY RUN (scan only)");
  console.log();

  const scanFailures: Parameters<typeof formatCatalogPlaceFailures>[0] = [];
  const allBets = await listTradeableCatalogBets(apiEnv, {
    segments,
    limit: pageLimit,
    includeBrowse: true,
    includeFeed,
    bothSides,
    includeCryptoEpochs,
    cryptoEpochLimit,
    failures: scanFailures,
  });

  const batch = limit ? limitCatalogBetsByMarket(allBets, limit) : allBets;
  const marketCount = new Set(batch.map(catalogBetKey)).size;

  console.log(
    `Found ${marketCount} market(s), ${allBets.length} bet slot(s) (${scanFailures.length} skipped in scan)`,
  );
  const placePreviewOpts = readBrokerFriendlyPlaceOptions({ maxSpend });
  const previewCreds = { accountId: "0x0", sender: "0x0" };
  for (const m of batch) {
    const preview = buildPlaceBetRequest(previewCreds, m.target.side, placePreviewOpts);
    console.log(
      `  • ${formatCatalogBetLabel(m)} — side=${m.target.side.key ?? m.target.side.trade?.selection} odds=${m.target.side.oddsCents}¢ priceCapBps=${preview.priceCapBps} maxSpend=${preview.maxSpend}`,
    );
  }
  if (scanFailures.length > 0) {
    console.log("\nScan skips:", formatCatalogPlaceFailures(scanFailures));
  }
  console.log();

  if (dryRun || batch.length === 0) {
    process.exit(batch.length === 0 ? 1 : 0);
  }

  const ctx = await setupIntegration();
  const creds = { accountId: ctx.accountId, sender: ctx.ownerAddress };
  console.log("Wallet:    ", ctx.ownerAddress);
  console.log("AccountId: ", ctx.accountId);
  console.log("Keeper:    ", ctx.keeperAddress ?? "(none)");
  console.log();

  const ok: CatalogMarketBetOutcome[] = [];
  const placedOnly: CatalogPlaceOnlyOutcome[] = [];
  const failed: Array<{ marketSlug: string; sideKey?: string; error: string }> = [];
  const brokerTimeouts: Array<{ marketSlug: string; sideKey?: string; orderId: bigint }> = [];

  type SlotResult =
    | { kind: "ok"; result: CatalogMarketBetOutcome }
    | { kind: "placed"; result: CatalogPlaceOnlyOutcome }
    | {
        kind: "unfilled";
        marketSlug: string;
        sideKey: string;
        orderId: bigint;
        brokerWaitMs: number;
      }
    | { kind: "fail"; marketSlug: string; sideKey: string; error: string };

  function slotLabel(market: (typeof batch)[number], i: number): string {
    const sideLabel = market.target.side.key ?? market.target.side.trade?.selection ?? "?";
    return `[${i + 1}/${batch.length}] ${formatCatalogBetLabel(market)} (${sideLabel})`;
  }

  function logCatalogBetSuccess(label: string, result: CatalogMarketBetOutcome): void {
    console.log(
      `${label} … ok order=${result.orderId} pos=${result.positionId} fill=${result.fillSource}` +
        (result.placeDigest ? ` place=${TESTNET_TX_EXPLORER}/${result.placeDigest}` : ""),
    );
    if (result.timing) {
      console.log(`         └ timing: ${formatCatalogBetTiming(result.timing)}`);
    } else {
      console.log(`         └ fillDetect: ${formatFillLatency(result.fillLatencyMs)}`);
    }
  }

  function handleFillError(
    market: (typeof batch)[number],
    label: string,
    err: unknown,
  ): SlotResult {
    const sideLabel = market.target.side.key ?? market.target.side.trade?.selection ?? "?";
    if (err instanceof BrokerFillTimeoutError) {
      console.log(
        `${label} … UNFILLED — backend broker did not fill within ${err.brokerWaitMs}ms (order=${err.orderId})`,
      );
      return {
        kind: "unfilled",
        marketSlug: market.marketSlug,
        sideKey: sideLabel,
        orderId: err.orderId,
        brokerWaitMs: err.brokerWaitMs,
      };
    }
    const msg = formatCatalogCliError(err);
    console.log(`${label} … FAIL — ${msg}`);
    return { kind: "fail", marketSlug: market.marketSlug, sideKey: sideLabel, error: msg };
  }

  const slotResults: SlotResult[] = [];

  if (placeOnly || concurrency === 1) {
    for (let i = 0; i < batch.length; i++) {
      const market = batch[i]!;
      const label = slotLabel(market, i);
      try {
        if (placeOnly) {
          const result = await placeCatalogMarketOnly(ctx, apiEnv, market, creds, { maxSpend });
          console.log(
            `${label} … placed order=${result.orderId}${result.alreadyFilled ? " (bypass fill)" : ""}`,
          );
          slotResults.push({ kind: "placed", result });
        } else {
          const result = await placeAndFillCatalogMarket(ctx, apiEnv, market, creds, {
            maxSpend,
            brokerWaitMs,
            brokerOnly,
          });
          logCatalogBetSuccess(label, result);
          slotResults.push({ kind: "ok", result });
        }
      } catch (err) {
        slotResults.push(handleFillError(market, label, err));
      }
      if (i < batch.length - 1 && delayMs > 0) await sleep(delayMs);
    }
  } else {
    type PendingSlot = {
      market: (typeof batch)[number];
      index: number;
      pending: CatalogPlacePending;
    };
    const pendingSlots: PendingSlot[] = [];

    console.log("Phase 1: sequential place …");
    for (let i = 0; i < batch.length; i++) {
      const market = batch[i]!;
      const label = slotLabel(market, i);
      try {
        const placed = await placeCatalogMarketTx(ctx, apiEnv, market, creds, { maxSpend });
        if ("positionId" in placed) {
          logCatalogBetSuccess(label, placed);
          slotResults.push({ kind: "ok", result: placed });
        } else {
          console.log(`${label} … placed order=${placed.orderId}`);
          pendingSlots.push({ market, index: i, pending: placed });
        }
      } catch (err) {
        slotResults.push(handleFillError(market, label, err));
      }
      if (i < batch.length - 1 && delayMs > 0) await sleep(delayMs);
    }

    if (pendingSlots.length > 0) {
      console.log(
        `Phase 2: parallel broker wait (${concurrency} workers, ${pendingSlots.length} order(s)) …`,
      );
      const fillResults = await runWithConcurrency(pendingSlots, concurrency, async (slot) => {
        const label = slotLabel(slot.market, slot.index);
        try {
          const result = await completeCatalogMarketFill(ctx, slot.pending, {
            brokerWaitMs,
            brokerOnly,
          });
          logCatalogBetSuccess(label, result);
          return { kind: "ok" as const, result };
        } catch (err) {
          return handleFillError(slot.market, label, err);
        }
      });
      slotResults.push(...fillResults);
    }
  }

  for (const slot of slotResults) {
    if (slot.kind === "ok") ok.push(slot.result);
    else if (slot.kind === "placed") {
      placedOnly.push(slot.result);
      printPlaceOnlyWatchCard({
        wallet: ctx.ownerAddress,
        accountId: ctx.accountId,
        stakeUsd,
        placed: slot.result,
      });
    } else if (slot.kind === "unfilled") {
      brokerTimeouts.push({
        marketSlug: slot.marketSlug,
        sideKey: slot.sideKey,
        orderId: slot.orderId,
      });
    } else failed.push({ marketSlug: slot.marketSlug, sideKey: slot.sideKey, error: slot.error });
  }

  console.log();
  console.log("═".repeat(72));
  if (placeOnly) {
    console.log(
      `Done: ${placedOnly.length} placed (left OPEN for frontend watch), ${failed.length} failed`,
    );
  } else {
    console.log(
      `Done: ${ok.length} filled, ${brokerTimeouts.length} unfilled (broker timeout), ${failed.length} failed`,
    );
  }
  if (ok.length > 0) {
    const bySource = { bypass: 0, broker: 0, keeper: 0 };
    let sumFillDetect = 0;
    const timed = ok.filter((r) => r.timing);
    const sumSeg = { build: 0, placeTx: 0, fill: 0, total: 0 };
    for (const r of ok) {
      bySource[r.fillSource] += 1;
      sumFillDetect += r.fillLatencyMs;
      if (r.timing) {
        sumSeg.build += r.timing.buildMs;
        sumSeg.placeTx += r.timing.placeTxMs;
        sumSeg.fill += r.timing.fillDetectMs;
        sumSeg.total += r.timing.totalMs;
      }
    }
    console.log(
      `Fill detect (place→seen): bypass=${bySource.bypass} broker=${bySource.broker} keeper=${bySource.keeper} avg=${formatFillLatency(Math.round(sumFillDetect / ok.length))}`,
    );
    if (timed.length > 0) {
      const n = timed.length;
      console.log(
        `Wall-clock avg (${n}): build=${formatFillLatency(Math.round(sumSeg.build / n))} placeTx=${formatFillLatency(Math.round(sumSeg.placeTx / n))} fill=${formatFillLatency(Math.round(sumSeg.fill / n))} total=${formatFillLatency(Math.round(sumSeg.total / n))}`,
      );
    }
  }
  if (brokerTimeouts.length > 0) {
    console.log("\nUnfilled (placed but no OrderFilled within broker wait):");
    for (const u of brokerTimeouts) {
      console.log(`  • ${u.marketSlug}${u.sideKey ? ` (${u.sideKey})` : ""}: order=${u.orderId}`);
    }
  }
  if (failed.length > 0) {
    console.log("\nFailures:");
    for (const f of failed) {
      console.log(`  • ${f.marketSlug}${f.sideKey ? ` (${f.sideKey})` : ""}: ${f.error}`);
    }
  }
  console.log("═".repeat(72));

  process.exit(failed.length > 0 || (!placeOnly && brokerTimeouts.length > 0) ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

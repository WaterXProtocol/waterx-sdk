/**
 * Catalog → tx-build closed loop (Bruno: feed/detail trade fields → POST /predict/bets/place).
 * Backend dry-runs `waterx_prediction::place_order` before returning `txBytes`.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { listCatalogSlugCandidates, oddsCentsToPriceCapBps } from "./api-catalog-pure.ts";
import { decodeJwtWallet } from "./api-chain-field-audit.ts";
import { apiGet, apiPost, type ApiEnvelope } from "./api-client.ts";
import {
  assertTxBuildResponse,
  inferMarketSegmentFromSlug,
  roundLifecycle,
  type BetSideWire,
  type FeedBrowseItemWire,
  type FeedBrowseListData,
  type MarketDetailData,
  type RoundWire,
  type TxBuildResponseData,
} from "./api-contract.ts";
import type { MarketSegment } from "./api-endpoints.ts";
import type { ApiEnvironment } from "./api-env.ts";
import { marketDetailPath, type CatalogContext } from "./api-smoke.ts";
import { optionalEnv } from "./e2e-env.ts";
import { readBrokerFriendlyPlaceOptions, readStagingMaxSpend } from "./staging-amounts.ts";

export { listCatalogSlugCandidates };

const SEED_FIXTURE_PATH = resolve(process.cwd(), "test/prediction/fixtures/testnet-seeded.json");

function readSeedPlaceCredentials(): { accountId?: string; owner?: string } | undefined {
  if (!existsSync(SEED_FIXTURE_PATH)) return undefined;
  try {
    return JSON.parse(readFileSync(SEED_FIXTURE_PATH, "utf8")) as {
      accountId?: string;
      owner?: string;
    };
  } catch {
    return undefined;
  }
}

export interface PlaceBetCredentials {
  accountId: string;
  sender: string;
}

export interface PlaceBetRequestBody {
  accountId: string;
  marketId: string;
  selection: "YES" | "NO";
  maxSpend: string;
  minShares: string;
  priceCapBps: string;
  expiryTs: string;
  sender: string;
}

export interface CatalogPlaceTarget {
  catalog: CatalogContext;
  side: BetSideWire;
  detail: MarketDetailData;
}

export function hasTxBuildSmokeEnabled(): boolean {
  const v = optionalEnv("E2E_API_TX_BUILD");
  return v === "1" || v === "true";
}

/** Registry account + wallet sender for POST /predict/bets/place. */
export function resolvePlaceBetCredentials(env: ApiEnvironment): PlaceBetCredentials | null {
  const seed = readSeedPlaceCredentials();

  const accountId =
    optionalEnv("E2E_API_PLACE_ACCOUNT_ID") ?? optionalEnv("E2E_ACCOUNT_ID") ?? seed?.accountId;
  const sender =
    optionalEnv("E2E_API_PLACE_SENDER") ??
    optionalEnv("E2E_ACCOUNT_OWNER") ??
    seed?.owner ??
    (env.jwt ? decodeJwtWallet(env.jwt) : undefined);
  if (!accountId || !sender) return null;
  if (!accountId.startsWith("0x") || !sender.startsWith("0x")) return null;
  return { accountId, sender };
}

const ACTIVE_PLACE_PHASES = new Set(["live", "upcoming", "open", "scheduled"]);

function roundIsPlaceable(round: RoundWire | undefined): boolean {
  const phase = roundLifecycle(round)?.toLowerCase();
  return phase !== undefined && ACTIVE_PLACE_PHASES.has(phase);
}

/** First detail side with on-chain `trade` payload (Bruno sport/crypto detail). */
export function pickTradeableSide(detail: MarketDetailData): BetSideWire | null {
  if (!roundIsPlaceable(detail.detail.round)) return null;
  const sides = detail.detail.round?.sides ?? [];
  for (const side of sides) {
    if (!side.trade?.marketId || !side.trade.selection) continue;
    if (side.trade.selection !== "YES" && side.trade.selection !== "NO") continue;
    const odds = side.oddsCents;
    if (odds === null || odds === undefined) continue;
    const n = typeof odds === "string" ? Number(odds) : odds;
    if (!Number.isFinite(n) || n <= 0) continue;
    return side;
  }
  return null;
}

export {
  oddsCentsToPriceCapBps,
  oddsCentsToUnfillablePriceCapBps,
  PRICE_CAP_ABOVE_QUOTE_BPS,
} from "./api-catalog-pure.ts";

export function buildPlaceBetRequest(
  creds: PlaceBetCredentials,
  side: BetSideWire,
  options?: {
    maxSpend?: string;
    minShares?: string;
    expiryMs?: number;
    priceCapBps?: string;
  },
): PlaceBetRequestBody {
  const odds = typeof side.oddsCents === "string" ? Number(side.oddsCents) : (side.oddsCents ?? 50);
  const expiryMs = options?.expiryMs ?? 3_600_000;
  return {
    accountId: creds.accountId,
    sender: creds.sender,
    marketId: side.trade!.marketId!,
    selection: side.trade!.selection as "YES" | "NO",
    maxSpend: options?.maxSpend ?? "1000000",
    minShares: options?.minShares ?? "1",
    priceCapBps: options?.priceCapBps ?? oddsCentsToPriceCapBps(odds),
    expiryTs: String(Date.now() + expiryMs),
  };
}

export interface CatalogPlaceFailure {
  segment: MarketSegment;
  marketSlug: string;
  reason: string;
}

export type CatalogPlaceTxBuildHit = {
  target: CatalogPlaceTarget;
  body: PlaceBetRequestBody;
  status: number;
  envelope: ApiEnvelope<TxBuildResponseData>;
};

const FEED_ACTIVE_PHASES = new Set(["LIVE", "OPEN", "UPCOMING", "SCHEDULED"]);

function normalizeFeedPhase(item: FeedBrowseItemWire): string {
  const raw =
    item.round?.phase ?? item.round?.status ?? item.nextRound?.phase ?? item.nextRound?.status;
  return (raw ?? "").trim().toUpperCase().replace(/-/g, "_");
}

function segmentFromFeedItem(item: FeedBrowseItemWire, fallback: MarketSegment): MarketSegment {
  const slug = item.market?.slug;
  if (slug) {
    const fromSlug = inferMarketSegmentFromSlug(slug);
    if (fromSlug) return fromSlug;
  }
  const kind = (item.market?.display?.kind ?? item.market?.type ?? "").toLowerCase();
  if (kind.includes("sport")) return "sport";
  if (kind.includes("crypto")) return "crypto";
  return fallback;
}

function feedItemToCatalogContext(
  item: FeedBrowseItemWire,
  segment: MarketSegment,
  slug: string,
): CatalogContext {
  const round = item.round ?? item.nextRound;
  return {
    segment,
    marketSlug: slug,
    roundId: round?.roundId ?? round?.id,
    roundStartsAt: round?.startsAt,
    roundPhase: round?.phase ?? round?.status,
    displayKind: item.market.display?.kind,
    feedItem: item,
    source: "feed",
  };
}

function formatPlaceError(status: number, envelope: ApiEnvelope<TxBuildResponseData>): string {
  if (!envelope.success) {
    const err = envelope as { error?: { code?: number; message?: string } };
    return `HTTP ${status} code ${err.error?.code ?? "?"}: ${err.error?.message ?? "unknown"}`;
  }
  return `HTTP ${status} without success envelope`;
}

export interface TradeableCatalogMarket {
  segment: MarketSegment;
  marketSlug: string;
  target: CatalogPlaceTarget;
}

/** Resolve every reachable catalog slug to a tradeable detail side (dynamic market scan). */
export async function listTradeableCatalogMarkets(
  env: ApiEnvironment,
  options?: {
    segments?: readonly MarketSegment[];
    limit?: number;
    includeBrowse?: boolean;
    failures?: CatalogPlaceFailure[];
  },
): Promise<TradeableCatalogMarket[]> {
  const failures = options?.failures ?? [];
  const candidates = await listCatalogSlugCandidates(env, options);
  const tradeable: TradeableCatalogMarket[] = [];

  for (const { item, segment, slug } of candidates) {
    const detailPath = marketDetailPath(segment, slug);
    const { status, envelope } = await apiGet<MarketDetailData>(env, detailPath);
    if (status !== 200 || !envelope.success) {
      failures.push({ segment, marketSlug: slug, reason: `detail HTTP ${status}` });
      continue;
    }
    const side = pickTradeableSide(envelope.data);
    if (!side) {
      failures.push({
        segment,
        marketSlug: slug,
        reason: "detail has no tradeable side (missing trade / odds / inactive round)",
      });
      continue;
    }
    tradeable.push({
      segment,
      marketSlug: slug,
      target: {
        catalog: feedItemToCatalogContext(item, segment, slug),
        side,
        detail: envelope.data,
      },
    });
  }
  return tradeable;
}

async function listSegmentFeedCandidates(
  env: ApiEnvironment,
  segment: MarketSegment,
): Promise<FeedBrowseItemWire[]> {
  const candidates = await listCatalogSlugCandidates(env, {
    segments: [segment],
    limit: 50,
    includeBrowse: false,
  });
  return candidates.map((c) => c.item);
}

/**
 * Probe feed segments for a catalog row whose detail exposes a fillable `trade` side,
 * then POST /predict/bets/place. Tries every reachable slug (not only the first).
 */
export async function tryCatalogPlaceTxBuild(
  env: ApiEnvironment,
  creds: PlaceBetCredentials,
  options?: { failures?: CatalogPlaceFailure[]; maxSpend?: string },
): Promise<CatalogPlaceTxBuildHit | null> {
  const failures = options?.failures ?? [];

  for (const segment of ["crypto", "sport"] as const) {
    const items = await listSegmentFeedCandidates(env, segment);
    if (items.length === 0) {
      failures.push({ segment, marketSlug: "(feed)", reason: "no feed items for segment" });
      continue;
    }

    for (const item of items) {
      const slug = item.market!.slug!;
      const catalog = feedItemToCatalogContext(item, segment, slug);
      const detailPath = marketDetailPath(segment, slug);
      const { status: detailStatus, envelope: detailEnvelope } = await apiGet<MarketDetailData>(
        env,
        detailPath,
      );
      if (detailStatus !== 200 || !detailEnvelope.success) {
        failures.push({
          segment,
          marketSlug: slug,
          reason: `detail HTTP ${detailStatus}`,
        });
        continue;
      }

      const side = pickTradeableSide(detailEnvelope.data);
      if (!side) {
        failures.push({
          segment,
          marketSlug: slug,
          reason: "detail has no tradeable side (missing trade / odds / inactive round)",
        });
        continue;
      }

      const body = buildPlaceBetRequest(
        creds,
        side,
        readBrokerFriendlyPlaceOptions({
          maxSpend: options?.maxSpend ?? readStagingMaxSpend(),
        }),
      );
      const { status, envelope } = await apiPost<TxBuildResponseData>(
        env,
        "/predict/bets/place",
        body,
      );
      if (status >= 200 && status < 300 && envelope.success) {
        return {
          target: { catalog, side, detail: detailEnvelope.data },
          body,
          status,
          envelope,
        };
      }
      failures.push({
        segment,
        marketSlug: slug,
        reason: formatPlaceError(status, envelope),
      });
    }
  }
  return null;
}

/** Human-readable summary when {@link tryCatalogPlaceTxBuild} returns null. */
export function formatCatalogPlaceFailures(failures: CatalogPlaceFailure[]): string {
  if (failures.length === 0) {
    return "no catalog candidates probed";
  }
  const tail = failures.slice(-4).map((f) => `${f.segment}/${f.marketSlug}: ${f.reason}`);
  return tail.join("; ");
}

/** Assert a successful catalog → place tx-build response. */
export function assertCatalogPlaceTxBuildResult(envelope: ApiEnvelope<TxBuildResponseData>): void {
  if (!envelope.success) {
    const err = envelope as { error?: { code?: number; message?: string } };
    throw new Error(
      `POST /predict/bets/place failed: ${err.error?.code ?? "?"} ${err.error?.message ?? ""}`,
    );
  }
  assertTxBuildResponse(envelope.data);
}

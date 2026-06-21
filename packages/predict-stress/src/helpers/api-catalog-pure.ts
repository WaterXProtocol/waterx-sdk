/**
 * Catalog wire types + pure helpers (no Vitest — safe for tsx CLI scripts).
 */
import { apiGet } from "./api-client.ts";
import type { MarketSegment } from "./api-endpoints.ts";
import type { ApiEnvironment } from "./api-env.ts";

export interface BetSideWire {
  key: string;
  oddsCents?: number | string | null;
  trade?: { marketId?: string; selection?: string };
}

export interface RoundWire {
  id?: string;
  roundId?: string;
  marketId?: string;
  startsAt?: number;
  endsAt?: number;
  phase?: string;
  status?: string;
  sides?: BetSideWire[];
}

export interface MarketWire {
  id?: string;
  slug: string;
  type?: string;
  display?: { kind?: string; symbol?: string };
}

export interface FeedBrowseItemWire {
  market: MarketWire;
  /** Present on event-grouped catalog rows (sport tournaments, etc.). */
  event?: { slug?: string };
  round?: RoundWire;
  nextRound?: RoundWire;
}

export interface FeedBrowseListData {
  items: FeedBrowseItemWire[];
  nextCursor?: string | null;
}

export interface MarketDetailData {
  detail: {
    market: MarketWire;
    round?: RoundWire;
    neighbors?: { past?: RoundWire[]; upcoming?: RoundWire[] };
  };
}

export interface TxBuildResponseData {
  txBytes: string;
  sponsored?: boolean;
  digest?: string;
}

const ACTIVE_PLACE_PHASES = new Set(["live", "upcoming", "open", "scheduled"]);
const FEED_ACTIVE_PHASES = new Set(["LIVE", "OPEN", "UPCOMING", "SCHEDULED"]);

export function inferMarketSegmentFromSlug(slug: string): MarketSegment | null {
  if (slug.startsWith("sport-")) return "sport";
  if (slug.startsWith("crypto-")) return "crypto";
  if (slug.startsWith("politics-")) return "politics";
  return null;
}

export function roundLifecycle(round: RoundWire | undefined): string | undefined {
  if (!round) return undefined;
  const raw = round.phase ?? round.status;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

export function marketDetailPath(segment: MarketSegment, slug: string, query = ""): string {
  const q = query.startsWith("?") || query === "" ? query : `?${query}`;
  return `/predict/markets/${segment}/${encodeURIComponent(slug)}${q}`;
}

/**
 * Crypto recurrence window key for `GET …/markets/crypto/:slug?epoch=…`.
 * Matches FE `/predict/market/crypto/:slug/:epoch` — `epoch` is the round `endsAt` (unix sec).
 */
export function cryptoEpochEndsAt(round: RoundWire | undefined): number | undefined {
  const endsAt = round?.endsAt;
  return typeof endsAt === "number" && Number.isFinite(endsAt) ? endsAt : undefined;
}

/** Unique catalog slot — crypto windows differ by `?epoch=` even when `marketSlug` matches. */
export function catalogBetKey(
  bet: Pick<TradeableCatalogMarket, "marketSlug" | "cryptoEpochEndsAt">,
): string {
  return bet.cryptoEpochEndsAt != null
    ? `${bet.marketSlug}@${bet.cryptoEpochEndsAt}`
    : bet.marketSlug;
}

export function formatCatalogBetLabel(
  bet: Pick<TradeableCatalogMarket, "segment" | "marketSlug" | "cryptoEpochEndsAt">,
): string {
  const slug =
    bet.cryptoEpochEndsAt != null
      ? `${bet.marketSlug}?epoch=${bet.cryptoEpochEndsAt}`
      : bet.marketSlug;
  return `${bet.segment}/${slug}`;
}

/** Default max upcoming crypto windows per slug when `includeCryptoEpochs` is on. */
export const DEFAULT_CRYPTO_EPOCH_LIMIT = 3;

/**
 * Extra crypto time windows from `detail.neighbors.upcoming` (browse only returns the active round).
 * Returns `endsAt` values suitable for `?epoch=` queries; skips the current round.
 */
export function collectCryptoExtraEpochs(
  detail: MarketDetailData,
  maxExtra: number = DEFAULT_CRYPTO_EPOCH_LIMIT,
): number[] {
  const currentEnds = cryptoEpochEndsAt(detail.detail.round);
  const seen = new Set<number>();
  if (currentEnds !== undefined) seen.add(currentEnds);

  const out: number[] = [];
  for (const round of detail.detail.neighbors?.upcoming ?? []) {
    if (!roundIsPlaceable(round)) continue;
    const epoch = cryptoEpochEndsAt(round);
    if (epoch === undefined || seen.has(epoch)) continue;
    seen.add(epoch);
    out.push(epoch);
    if (out.length >= maxExtra) break;
  }
  return out;
}

function roundIsPlaceable(round: RoundWire | undefined): boolean {
  const phase = roundLifecycle(round)?.toLowerCase();
  return phase !== undefined && ACTIVE_PLACE_PHASES.has(phase);
}

export function isTradeableSide(side: BetSideWire): boolean {
  if (!side.trade?.marketId || !side.trade.selection) return false;
  if (side.trade.selection !== "YES" && side.trade.selection !== "NO") return false;
  const odds = side.oddsCents;
  if (odds === null || odds === undefined) return false;
  const n = typeof odds === "string" ? Number(odds) : odds;
  return Number.isFinite(n) && n > 0;
}

/** Every detail side with on-chain `trade` + odds (e.g. up/down, teamA/teamB). */
export function pickTradeableSides(detail: MarketDetailData): BetSideWire[] {
  if (!roundIsPlaceable(detail.detail.round)) return [];
  return (detail.detail.round?.sides ?? []).filter(isTradeableSide);
}

export function pickTradeableSide(detail: MarketDetailData): BetSideWire | null {
  return pickTradeableSides(detail)[0] ?? null;
}

/** Bps added above quoted odds — on-chain fill requires `priceCapBps` > quote (`oddsCents × 100`). */
export const PRICE_CAP_ABOVE_QUOTE_BPS = 1;

/**
 * Map catalog `oddsCents` (e.g. 60 for a 60¢ / “0.6” screen quote) to `priceCapBps`
 * strictly above the quote: 60¢ → 6000 bps quote → 6001 cap.
 */
export function oddsCentsToPriceCapBps(
  oddsCents: number,
  slippageBps: number = PRICE_CAP_ABOVE_QUOTE_BPS,
): string {
  const quoteBps = Math.round(oddsCents * 100);
  const capBps = Math.min(10_000, Math.max(101, quoteBps + slippageBps));
  return String(capBps);
}

/** Default tight cap for refund probes (staging order 366-style). */
export const UNFILLABLE_PRICE_CAP_BPS = 701;

/**
 * Deliberately below fillable cap — `min(quote-1, tightCap)` so broker/keeper
 * cannot fill at screen odds (e.g. 47¢ quote → cap 701).
 */
export function oddsCentsToUnfillablePriceCapBps(
  oddsCents: number,
  tightCap: number = UNFILLABLE_PRICE_CAP_BPS,
): string {
  const quoteBps = Math.round(oddsCents * 100);
  const cap = Math.min(Math.max(101, quoteBps - 1), tightCap);
  return String(cap);
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

export function buildPlaceBetRequest(
  creds: PlaceBetCredentials,
  side: BetSideWire,
  options?: {
    maxSpend?: string;
    minShares?: string;
    expiryMs?: number;
    /** When set, skips odds-derived cap (must still be > quoted odds for fill). */
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
  if (kind.includes("politics")) return "politics";
  return fallback;
}

/** Default segments — matches staging FE browse (crypto + sport; no politics tab yet). */
export const DEFAULT_CATALOG_SEGMENTS: readonly MarketSegment[] = ["crypto", "sport"];

/** Page size for browse/feed list APIs (`limit` query param). */
export const DEFAULT_CATALOG_PAGE_LIMIT = 500;

/** Default browse sort — same as FE `/predict/browse`. */
export const DEFAULT_CATALOG_BROWSE_SORT = "trending";

function fallbackSegmentForListPath(path: string): MarketSegment {
  if (path.includes("type=crypto")) return "crypto";
  if (path.includes("type=politics")) return "politics";
  if (path.includes("type=sport")) return "sport";
  return "sport";
}

/**
 * List API paths for catalog scans (deduped).
 * Default: **browse only** (`sort=trending`) — parity with FE browse page.
 * Set `includeFeed: true` to also probe `/predict/feed` (home feed; may differ slightly).
 */
export function catalogListPaths(
  segments: readonly MarketSegment[],
  pageLimit: number,
  options?: { includeBrowse?: boolean; includeFeed?: boolean; browseSort?: string },
): string[] {
  const includeBrowse = options?.includeBrowse ?? true;
  const includeFeed = options?.includeFeed ?? false;
  if (!includeBrowse && !includeFeed) {
    throw new Error(
      "catalogListPaths: includeBrowse and includeFeed are both false — no list endpoints to scan",
    );
  }
  const browseSort = options?.browseSort ?? DEFAULT_CATALOG_BROWSE_SORT;
  const paths = new Set<string>();

  if (includeBrowse) {
    paths.add(`/predict/browse?sort=${browseSort}&limit=${pageLimit}`);
    for (const segment of segments) {
      paths.add(`/predict/browse?type=${segment}&sort=${browseSort}&limit=${pageLimit}`);
    }
  }

  if (includeFeed) {
    paths.add(`/predict/feed?limit=${pageLimit}`);
    for (const segment of segments) {
      if (segment === "politics") continue;
      paths.add(`/predict/feed?type=${segment}&limit=${pageLimit}`);
    }
  }

  return [...paths];
}

async function listAllFeedBrowseItems(
  env: ApiEnvironment,
  listPath: string,
): Promise<FeedBrowseItemWire[]> {
  const items: FeedBrowseItemWire[] = [];
  let cursor: string | null | undefined = undefined;
  const maxPages = 200;

  for (let page = 0; page < maxPages; page += 1) {
    const sep = listPath.includes("?") ? "&" : "?";
    const requestPath: string =
      cursor != null && cursor !== ""
        ? `${listPath}${sep}cursor=${encodeURIComponent(cursor)}`
        : listPath;
    const { status, envelope } = await apiGet<FeedBrowseListData>(env, requestPath);
    if (status !== 200 || !envelope.success) break;
    items.push(...envelope.data.items);
    cursor = envelope.data.nextCursor ?? null;
    if (!cursor) break;
  }

  return items;
}

export type CatalogSlugCandidate = {
  item: FeedBrowseItemWire;
  segment: MarketSegment;
  slug: string;
};

export async function listCatalogSlugCandidates(
  env: ApiEnvironment,
  options?: {
    segments?: readonly MarketSegment[];
    limit?: number;
    includeBrowse?: boolean;
    /** When true, also scan `/predict/feed` (off by default — use browse for FE parity). */
    includeFeed?: boolean;
    browseSort?: string;
  },
): Promise<CatalogSlugCandidate[]> {
  const segments = options?.segments ?? DEFAULT_CATALOG_SEGMENTS;
  const pageLimit = options?.limit ?? DEFAULT_CATALOG_PAGE_LIMIT;
  const seen = new Set<string>();
  const out: CatalogSlugCandidate[] = [];

  const addItems = (items: FeedBrowseItemWire[], fallbackSegment: MarketSegment) => {
    for (const item of items) {
      const slug = item.market?.slug;
      if (!slug || seen.has(slug)) continue;
      const itemSegment = segmentFromFeedItem(item, fallbackSegment);
      if (!segments.includes(itemSegment)) continue;
      seen.add(slug);
      out.push({ item, segment: itemSegment, slug });
    }
  };

  for (const listPath of catalogListPaths(segments, pageLimit, options)) {
    const items = await listAllFeedBrowseItems(env, listPath);
    addItems(items, fallbackSegmentForListPath(listPath));
  }

  return [...out].sort((a, b) => {
    const aActive = FEED_ACTIVE_PHASES.has(normalizeFeedPhase(a.item)) ? 0 : 1;
    const bActive = FEED_ACTIVE_PHASES.has(normalizeFeedPhase(b.item)) ? 0 : 1;
    return aActive - bActive;
  });
}

export interface CatalogPlaceFailure {
  segment: MarketSegment;
  marketSlug: string;
  reason: string;
}

export interface CatalogPlaceTarget {
  catalog: { segment: MarketSegment; marketSlug: string };
  side: BetSideWire;
  detail: MarketDetailData;
}

export interface TradeableCatalogMarket {
  segment: MarketSegment;
  marketSlug: string;
  /** Crypto only — `?epoch=<endsAt>` when not the default browse round. */
  cryptoEpochEndsAt?: number;
  target: CatalogPlaceTarget;
}

export async function listTradeableCatalogMarkets(
  env: ApiEnvironment,
  options?: {
    segments?: readonly MarketSegment[];
    limit?: number;
    includeBrowse?: boolean;
    failures?: CatalogPlaceFailure[];
  },
): Promise<TradeableCatalogMarket[]> {
  const bets = await listTradeableCatalogBets(env, { ...options, bothSides: false });
  return bets.map((b) => ({
    segment: b.segment,
    marketSlug: b.marketSlug,
    target: b.target,
  }));
}

/** One row per placeable side (`bothSides` default true → up+down / teamA+teamB). */
function pushTradeableFromDetail(
  tradeable: TradeableCatalogMarket[],
  segment: MarketSegment,
  slug: string,
  detail: MarketDetailData,
  bothSides: boolean,
  cryptoEpochEndsAt?: number,
): BetSideWire[] {
  const firstSide = pickTradeableSide(detail);
  const sides = bothSides ? pickTradeableSides(detail) : firstSide ? [firstSide] : [];
  for (const side of sides) {
    tradeable.push({
      segment,
      marketSlug: slug,
      cryptoEpochEndsAt,
      target: {
        catalog: { segment, marketSlug: slug },
        side,
        detail,
      },
    });
  }
  return sides;
}

export async function listTradeableCatalogBets(
  env: ApiEnvironment,
  options?: {
    segments?: readonly MarketSegment[];
    limit?: number;
    includeBrowse?: boolean;
    includeFeed?: boolean;
    browseSort?: string;
    bothSides?: boolean;
    /** When true, also probe crypto `neighbors.upcoming` via `?epoch=<endsAt>`. */
    includeCryptoEpochs?: boolean;
    /** Max upcoming windows per crypto slug (default {@link DEFAULT_CRYPTO_EPOCH_LIMIT}). */
    cryptoEpochLimit?: number;
    failures?: CatalogPlaceFailure[];
  },
): Promise<TradeableCatalogMarket[]> {
  const failures = options?.failures ?? [];
  const bothSides = options?.bothSides ?? true;
  const candidates = await listCatalogSlugCandidates(env, options);
  const tradeable: TradeableCatalogMarket[] = [];

  for (const { segment, slug } of candidates) {
    const detailPath = marketDetailPath(segment, slug);
    const { status, envelope } = await apiGet<MarketDetailData>(env, detailPath);
    if (status !== 200 || !envelope.success) {
      failures.push({ segment, marketSlug: slug, reason: `detail HTTP ${status}` });
      continue;
    }

    const baseSides = pushTradeableFromDetail(tradeable, segment, slug, envelope.data, bothSides);
    if (baseSides.length === 0) {
      failures.push({
        segment,
        marketSlug: slug,
        reason: "detail has no tradeable side (missing trade / odds / inactive round)",
      });
    }

    if (segment !== "crypto" || !options?.includeCryptoEpochs) continue;

    const epochLimit = options.cryptoEpochLimit ?? DEFAULT_CRYPTO_EPOCH_LIMIT;
    for (const epoch of collectCryptoExtraEpochs(envelope.data, epochLimit)) {
      const epochPath = marketDetailPath("crypto", slug, `?epoch=${epoch}`);
      const epochLabel = `${slug}?epoch=${epoch}`;
      const { status: epochStatus, envelope: epochEnvelope } = await apiGet<MarketDetailData>(
        env,
        epochPath,
      );
      if (epochStatus !== 200 || !epochEnvelope.success) {
        failures.push({
          segment,
          marketSlug: epochLabel,
          reason: `epoch detail HTTP ${epochStatus}`,
        });
        continue;
      }
      const epochSides = pushTradeableFromDetail(
        tradeable,
        segment,
        slug,
        epochEnvelope.data,
        bothSides,
        epoch,
      );
      if (epochSides.length === 0) {
        failures.push({
          segment,
          marketSlug: epochLabel,
          reason: "epoch detail has no tradeable side (missing trade / odds / inactive round)",
        });
      }
    }
  }
  return tradeable;
}

/** Keep all sides for the first `marketLimit` unique catalog slots (slug, or slug+epoch for crypto). */
export function limitCatalogBetsByMarket(
  bets: TradeableCatalogMarket[],
  marketLimit: number,
): TradeableCatalogMarket[] {
  const allowedKeys = new Set([...new Set(bets.map(catalogBetKey))].slice(0, marketLimit));
  return bets.filter((b) => allowedKeys.has(catalogBetKey(b)));
}

export function formatCatalogPlaceFailures(failures: CatalogPlaceFailure[]): string {
  if (failures.length === 0) return "no catalog candidates probed";
  return failures
    .slice(-4)
    .map((f) => `${f.segment}/${f.marketSlug}: ${f.reason}`)
    .join("; ");
}

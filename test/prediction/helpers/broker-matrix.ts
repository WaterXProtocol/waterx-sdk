/**
 * Staging broker response matrix — vary place inputs, observe API + chain outcomes.
 * Local / opt-in only (needs SUI_PRIVATE_KEY + staging API).
 */
import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { formatSettlementBase, getAccountSettlementBalance } from "./account-balance.ts";
import {
  buildPlaceBetRequest,
  listTradeableCatalogBets,
  oddsCentsToPriceCapBps,
  oddsCentsToUnfillablePriceCapBps,
  UNFILLABLE_PRICE_CAP_BPS,
  type CatalogPlaceFailure,
  type PlaceBetCredentials,
  type TradeableCatalogMarket,
  type TxBuildResponseData,
} from "./api-catalog-pure.ts";
import { apiPost, type ApiEnvelope } from "./api-client.ts";
import type { ApiEnvironment } from "./api-env.ts";
import { waitForBrokerChainOutcome, type BrokerChainOutcome } from "./broker-outcome.ts";
import { executeCatalogPlace } from "./catalog-cli.ts";
import { optionalEnv } from "./e2e-env.ts";
import { eventsFromResult, findEvent } from "./events-core.ts";
import type { IntegrationCtx } from "./integration-setup.ts";
import {
  readBrokerFriendlyPlaceOptions,
  readStagingMaxSpend,
  usdToSettlementBaseStr,
} from "./staging-amounts.ts";
import { transactionDigest } from "./tx-result.ts";

export function hasBrokerMatrixEnabled(): boolean {
  const v = optionalEnv("E2E_BROKER_MATRIX");
  return v === "1" || v === "true";
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = optionalEnv(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const BROKER_MATRIX_FILL_WAIT_MS = () =>
  readPositiveIntEnv("E2E_BROKER_MATRIX_FILL_WAIT_MS", 45_000);

export const BROKER_MATRIX_REFUND_WAIT_MS = () =>
  readPositiveIntEnv("E2E_BROKER_MATRIX_REFUND_WAIT_MS", 90_000);

export type PriceCapMode = "fillable" | "at-quote" | "tight-701" | "absurd-101" | "above-quote-500";

export interface BrokerMatrixScenario {
  id: string;
  label: string;
  priceCapMode: PriceCapMode;
  /** Override maxSpend base units; default from E2E_STAGING_BET_USD. */
  maxSpend?: string;
  /** Absolute priceCapBps override — wins over priceCapMode (e.g. "0", "10001"). */
  priceCapBpsOverride?: string;
  /** Override minShares (default "1") — huge values make every broker fill abort EFillBelowMin. */
  minShares?: string;
  /** Shorter (or negative = already expired) expiry to stress broker (ms). */
  expiryMs?: number;
  /** Skip on-chain execute — API POST only. */
  apiOnly?: boolean;
  waitMs?: number;
  expectOutcome?: BrokerChainOutcome | "api-reject" | "bypass";
}

export const DEFAULT_BROKER_MATRIX: BrokerMatrixScenario[] = [
  {
    id: "api-reject-zero-spend",
    label: "API rejects maxSpend=0",
    priceCapMode: "fillable",
    maxSpend: "0",
    apiOnly: true,
    expectOutcome: "api-reject",
  },
  {
    id: "api-reject-zero-cap",
    label: "priceCapBps=0 — API still builds tx (validate on chain)",
    priceCapMode: "fillable",
    priceCapBpsOverride: "0",
    expectOutcome: "cancelled",
  },
  {
    id: "cap-over-10000",
    label: "priceCapBps=10001 — chain EBadPriceCap(5); sponsored dry-run rejects at POST",
    priceCapMode: "fillable",
    priceCapBpsOverride: "10001",
    apiOnly: true,
    expectOutcome: "api-reject",
  },
  {
    id: "expired-expiry",
    label: "expiryTs in the past — chain EBadExpiry(8); sponsored dry-run rejects at POST",
    priceCapMode: "fillable",
    expiryMs: -60_000,
    apiOnly: true,
    expectOutcome: "api-reject",
  },
  {
    id: "min-shares-unfillable",
    label:
      "minShares=u64 max with fillable cap — every fill aborts EFillBelowMin(7); order rests until expiry+grace",
    priceCapMode: "fillable",
    minShares: "18446744073709551615",
    // Documentation only — NO hard expectOutcome. A keeper cancel is gated by
    // `expiry_ts + KEEPER_FILL_GRACE_MS` (5 min), so within any practical matrix
    // wait this stays OPEN/timeout. The $ drop is normal escrow, not a loss.
    // To actually confirm refund, re-run with a >6.5 min wait or follow up with
    // self_cancel_order after the cooldown.
  },
  {
    id: "fillable-normal",
    label: "fillable cap (quote+1) — expect broker fill",
    priceCapMode: "fillable",
    expectOutcome: "filled",
  },
  {
    id: "micro-stake",
    label: "$0.01 maxSpend — API min-bet gate ($1)",
    priceCapMode: "fillable",
    maxSpend: usdToSettlementBaseStr(0.01),
    apiOnly: true,
    expectOutcome: "api-reject",
  },
  {
    id: "at-quote",
    label: "cap = quote (not strictly above)",
    priceCapMode: "at-quote",
    expectOutcome: "cancelled",
  },
  {
    id: "tight-701",
    label: "tight cap min(quote-1, 701) — expect refund",
    priceCapMode: "tight-701",
    expectOutcome: "cancelled",
  },
  {
    id: "absurd-101",
    label: "absurd cap 101 bps on high-odds side",
    priceCapMode: "absurd-101",
    expectOutcome: "cancelled",
  },
];

function formatMatrixPlaceError(
  status: number,
  envelope: ApiEnvelope<TxBuildResponseData>,
): string {
  if (!envelope.success) {
    return `HTTP ${status} code ${envelope.error.code}: ${envelope.error.message}`;
  }
  if (!envelope.data?.txBytes) {
    return `HTTP ${status} without txBytes`;
  }
  return `HTTP ${status}`;
}

function placeCredentials(ctx: IntegrationCtx): PlaceBetCredentials {
  return { accountId: ctx.accountId, sender: ctx.ownerAddress };
}

function oddsNumber(side: TradeableCatalogMarket["target"]["side"]): number {
  return typeof side.oddsCents === "string" ? Number(side.oddsCents) : (side.oddsCents ?? 50);
}

function resolvePriceCapBps(mode: PriceCapMode, oddsCents: number): string {
  const quoteBps = Math.round(oddsCents * 100);
  switch (mode) {
    case "fillable":
      return oddsCentsToPriceCapBps(oddsCents);
    case "at-quote":
      return String(quoteBps);
    case "tight-701":
      return oddsCentsToUnfillablePriceCapBps(oddsCents);
    case "absurd-101":
      return "101";
    case "above-quote-500":
      return String(Math.min(10_000, quoteBps + 500));
  }
}

function pickMatrixMarkets(markets: TradeableCatalogMarket[]): {
  fillable: TradeableCatalogMarket;
  lowOdds: TradeableCatalogMarket;
  highOdds: TradeableCatalogMarket;
} {
  const byOdds = [...markets].sort((a, b) => oddsNumber(a.target.side) - oddsNumber(b.target.side));
  const low = byOdds[0]!;
  const high = byOdds[byOdds.length - 1]!;
  const mid = byOdds[Math.floor(byOdds.length / 2)] ?? low;
  return { fillable: mid, lowOdds: low, highOdds: high };
}

export interface BrokerMatrixRowResult {
  scenario: BrokerMatrixScenario;
  marketSlug: string;
  sideKey: string;
  quoteBps: number;
  priceCapBps: string;
  maxSpend: string;
  apiStatus: number;
  apiOk: boolean;
  apiError?: string;
  orderId?: bigint;
  chainOutcome?: BrokerChainOutcome | "bypass";
  waitMs?: number;
  balanceBefore?: bigint;
  balanceAfter?: bigint;
  refundAmount?: bigint;
  positionId?: bigint;
  placeDigest?: string;
  note?: string;
}

function scenarioMarket(
  scenario: BrokerMatrixScenario,
  picks: ReturnType<typeof pickMatrixMarkets>,
): TradeableCatalogMarket {
  if (scenario.priceCapMode === "absurd-101") return picks.highOdds;
  if (scenario.priceCapMode === "tight-701" || scenario.priceCapMode === "at-quote") {
    return picks.lowOdds;
  }
  return picks.fillable;
}

async function runScenario(
  ctx: IntegrationCtx,
  apiEnv: ApiEnvironment,
  market: TradeableCatalogMarket,
  scenario: BrokerMatrixScenario,
): Promise<BrokerMatrixRowResult> {
  const maxSpend = scenario.maxSpend ?? readStagingMaxSpend();
  const odds = oddsNumber(market.target.side);
  const quoteBps = Math.round(odds * 100);
  const priceCapBps =
    scenario.priceCapBpsOverride ?? resolvePriceCapBps(scenario.priceCapMode, odds);

  const body = buildPlaceBetRequest(placeCredentials(ctx), market.target.side, {
    ...readBrokerFriendlyPlaceOptions({ maxSpend }),
    priceCapBps,
    minShares: scenario.minShares,
    expiryMs: scenario.expiryMs,
  });

  const apiRes = await apiPost<TxBuildResponseData>(apiEnv, "/predict/bets/place", body);
  const envelope = apiRes.envelope;
  const apiOk =
    apiRes.status >= 200 && apiRes.status < 300 && envelope.success && !!envelope.data?.txBytes;
  const apiError = !apiOk ? formatMatrixPlaceError(apiRes.status, envelope) : undefined;

  const row: BrokerMatrixRowResult = {
    scenario,
    marketSlug: market.marketSlug,
    sideKey: market.target.side.key ?? "?",
    quoteBps,
    priceCapBps,
    maxSpend,
    apiStatus: apiRes.status,
    apiOk,
    apiError,
  };

  if (scenario.apiOnly || !apiOk || !envelope.success) {
    return row;
  }

  const balanceBefore = await getAccountSettlementBalance(ctx.client, ctx.accountId);
  row.balanceBefore = balanceBefore;

  const placeResult = await executeCatalogPlace(
    ctx,
    body,
    envelope.data.txBytes,
    envelope.data.sponsored,
  );
  row.placeDigest = transactionDigest(placeResult);

  const bypass = findEvent(eventsFromResult(placeResult), EVENT_CONTRACT.OrderFilled.suffix);
  if (bypass) {
    row.chainOutcome = "bypass";
    row.positionId = BigInt(String(bypass.json.position_id));
    row.balanceAfter = await getAccountSettlementBalance(ctx.client, ctx.accountId);
    row.note = "filled in place tx (bypass)";
    return row;
  }

  const placed = findEvent(eventsFromResult(placeResult), EVENT_CONTRACT.OrderPlaced.suffix);
  if (!placed) {
    row.note = "place tx missing OrderPlaced";
    return row;
  }
  row.orderId = BigInt(String(placed.json.order_id));

  const waitMs =
    scenario.waitMs ??
    (scenario.priceCapMode === "fillable"
      ? BROKER_MATRIX_FILL_WAIT_MS()
      : BROKER_MATRIX_REFUND_WAIT_MS());

  const outcome = await waitForBrokerChainOutcome(ctx, row.orderId, waitMs);
  row.chainOutcome = outcome.outcome;
  row.waitMs = outcome.waitMs;
  row.refundAmount = outcome.refundAmount;
  row.positionId = outcome.positionId;
  row.balanceAfter = await getAccountSettlementBalance(ctx.client, ctx.accountId);

  if (outcome.outcome === "cancelled" && row.balanceBefore !== undefined) {
    row.note =
      row.balanceAfter === row.balanceBefore
        ? "wxa balance restored"
        : `wxa balance delta ${row.balanceAfter - row.balanceBefore}`;
  }

  return row;
}

export async function runBrokerMatrix(
  ctx: IntegrationCtx,
  apiEnv: ApiEnvironment,
  options?: {
    scenarios?: BrokerMatrixScenario[];
    placeFailures?: CatalogPlaceFailure[];
    delayMs?: number;
  },
): Promise<BrokerMatrixRowResult[]> {
  const placeFailures = options?.placeFailures ?? [];
  const markets = await listTradeableCatalogBets(apiEnv, {
    bothSides: true,
    failures: placeFailures,
  });
  if (markets.length === 0) return [];

  const picks = pickMatrixMarkets(markets);
  const all = options?.scenarios ?? DEFAULT_BROKER_MATRIX;
  const filterRaw = optionalEnv("E2E_BROKER_MATRIX_SCENARIOS");
  const scenarios = filterRaw
    ? all.filter((s) =>
        filterRaw
          .split(",")
          .map((x) => x.trim())
          .includes(s.id),
      )
    : all;

  const results: BrokerMatrixRowResult[] = [];
  const delayMs = options?.delayMs ?? 2_000;

  for (const scenario of scenarios) {
    const market = scenarioMarket(scenario, picks);
    results.push(await runScenario(ctx, apiEnv, market, scenario));
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  return results;
}

export function formatBrokerMatrixTable(rows: BrokerMatrixRowResult[]): string {
  const lines = [
    "id                  api   chain      wait     cap/quote  maxSpend   market",
    "─".repeat(88),
  ];
  for (const r of rows) {
    const chain = r.chainOutcome ?? (r.scenario.apiOnly ? "—" : r.apiOk ? "?" : "api-fail");
    const wait = r.waitMs != null ? `${(r.waitMs / 1000).toFixed(1)}s` : "—";
    const cap = `${r.priceCapBps}/${r.quoteBps}`;
    const api = r.apiOk ? "OK" : `ERR${r.apiStatus}`;
    lines.push(
      `${r.scenario.id.padEnd(20)}${api.padEnd(6)}${String(chain).padEnd(11)}${wait.padEnd(9)}${cap.padEnd(11)}${r.maxSpend.padEnd(11)}${r.marketSlug.slice(0, 24)}`,
    );
    if (r.apiError) lines.push(`  api: ${r.apiError.slice(0, 120)}`);
    if (r.note) lines.push(`  note: ${r.note}`);
    if (r.orderId) lines.push(`  order=${r.orderId}${r.positionId ? ` pos=${r.positionId}` : ""}`);
    if (r.balanceBefore != null && r.balanceAfter != null) {
      lines.push(
        `  wxa: ${formatSettlementBase(r.balanceBefore)} → ${formatSettlementBase(r.balanceAfter)}`,
      );
    }
  }
  return lines.join("\n");
}

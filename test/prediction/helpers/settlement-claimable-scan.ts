/**
 * Read-only claimable scan — no Vitest dependency (safe for `tsx` CLI).
 * Compares `GET /predict/bets/me/claimable` vs on-chain claim formula.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PredictClient } from "~predict/client.ts";
import { getAccountIds, getMarketById, getPosition, getPositionCursor } from "~predict/fetch.ts";
import type { MarketView, PositionView } from "~predict/types.ts";

import { betsMeClaimablePath } from "./api-bets-path.ts";
import { apiGet, assertSuccessEnvelope } from "./api-client.ts";
import type { ApiEnvironment } from "./api-env.ts";
import { pollUntil } from "./api-poll.ts";
import { isBetsMeListData, type BetsMeListData, type BetWire } from "./api-wire.ts";
import { optionalEnv, readFixtureOverrides } from "./e2e-env.ts";

/** wxUSD settlement coin uses 6 decimals on-chain ($1 = 1_000_000 base units). */
export const SETTLEMENT_SCALE = 1_000_000;

const SEED_FIXTURE_PATH = resolve(process.cwd(), "test/prediction/fixtures/testnet-seeded.json");

function readSeedAccountId(): string | undefined {
  if (!existsSync(SEED_FIXTURE_PATH)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(SEED_FIXTURE_PATH, "utf8")) as { accountId?: string };
    return raw.accountId;
  } catch {
    return undefined;
  }
}

export function settlementCrosscheckPollMs(): number {
  return readPositiveIntEnv("E2E_SETTLEMENT_CROSSCHECK_POLL_MS", 60_000);
}

export function settlementCrosscheckPollIntervalMs(): number {
  return readPositiveIntEnv("E2E_SETTLEMENT_CROSSCHECK_POLL_INTERVAL_MS", 2_000);
}

export function settlementCrosscheckMaxRows(): number {
  return readPositiveIntEnv("E2E_SETTLEMENT_CROSSCHECK_MAX_ROWS", 20);
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = optionalEnv(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function settlementBaseToUsd(amount: bigint): number {
  return Number(amount) / SETTLEMENT_SCALE;
}

/**
 * Mirrors backend `computeProjectedPayoutUsd` for resolved-but-unclaimed positions.
 * Returns `null` when the market is not resolved; `0` for a losing side.
 */
export function expectedClaimUsdFromChain(
  position: Pick<PositionView, "selection" | "filledShares" | "filledCost">,
  market: Pick<MarketView, "resolved" | "outcome">,
): number | null {
  if (!market.resolved || market.outcome === null) return null;
  const shares = settlementBaseToUsd(position.filledShares);
  const cost = settlementBaseToUsd(position.filledCost);
  if (market.outcome === "INVALID") return cost;
  return position.selection === market.outcome ? shares : 0;
}

export async function resolveAccountIdForWallet(
  client: PredictClient,
  wallet: string,
): Promise<string | null> {
  const explicit = optionalEnv("E2E_ACCOUNT_ID")?.trim();
  if (explicit) return explicit;

  const seedAccountId = readSeedAccountId();
  if (seedAccountId) {
    const ids = await getAccountIds(client, { owner: wallet });
    if (ids.includes(seedAccountId)) return seedAccountId;
  }

  const pinned = readFixtureOverrides().accountId?.trim();
  if (pinned) return pinned;

  const ids = await getAccountIds(client, { owner: wallet });
  return ids[0] ?? null;
}

export async function fetchBetsClaimableDirect(
  env: ApiEnvironment,
  wallet: string,
): Promise<BetsMeListData> {
  const path = betsMeClaimablePath(wallet);
  const { status, envelope } = await apiGet<BetsMeListData>(env, path);
  if (status !== 200) {
    throw new Error(`GET ${path} returned HTTP ${status}`);
  }
  assertSuccessEnvelope(envelope);
  if (!isBetsMeListData(envelope.data)) {
    throw new Error("GET /predict/bets/me/claimable: expected { bets: Bet[] }");
  }
  return envelope.data;
}

export function betWirePositionId(bet: BetWire): bigint | undefined {
  const raw = bet.positionId ?? bet.position_id;
  if (raw === undefined || raw === null) return undefined;
  try {
    return BigInt(String(raw));
  } catch {
    return undefined;
  }
}

export async function loadChainClaimContext(
  client: PredictClient,
  positionId: bigint,
): Promise<{ position: PositionView; market: MarketView; expectedUsd: number }> {
  const position = await getPosition(client, { positionId });
  const market = await getMarketById(client, { marketId: position.marketId });
  const expected = expectedClaimUsdFromChain(position, market);
  if (expected === null) {
    throw new Error(
      `positionId ${positionId}: market ${market.marketIdHex} not resolved on-chain (outcome=${String(market.outcome)})`,
    );
  }
  if (expected <= 0) {
    throw new Error(
      `positionId ${positionId}: chain expected claim ${expected} — losers should not appear in claimable API`,
    );
  }
  return { position, market, expectedUsd: expected };
}

export interface ChainClaimableCandidate {
  positionId: string;
  marketIdHex: string;
  selection: string;
  marketOutcome: string;
  expectedUsd: number;
}

/** Walk recent positions — resolved market + positive claim formula (no txs). */
export async function scanChainClaimableCandidates(
  client: PredictClient,
  accountId: string,
  maxSamples = 32,
): Promise<ChainClaimableCandidate[]> {
  const cursor = await getPositionCursor(client);
  const out: ChainClaimableCandidate[] = [];
  if (cursor.count === 0n || cursor.front == null) return out;

  const back = cursor.back ?? cursor.front;
  const stop = back - BigInt(maxSamples) > cursor.front ? back - BigInt(maxSamples) : cursor.front;

  for (let id = back; id >= stop; id -= 1n) {
    let position: PositionView | undefined;
    try {
      position = await getPosition(client, { positionId: id });
    } catch {
      if (id === 0n) break;
      continue;
    }
    if (!position || position.accountId !== accountId) {
      if (id === 0n) break;
      continue;
    }
    if (position.status !== "OPEN" || position.filledShares <= 0n) {
      if (id === 0n) break;
      continue;
    }

    const market = await getMarketById(client, { marketId: position.marketId });
    const expected = expectedClaimUsdFromChain(position, market);
    if (expected === null || expected <= 0) {
      if (id === 0n) break;
      continue;
    }

    out.push({
      positionId: String(position.positionId),
      marketIdHex: market.marketIdHex,
      selection: position.selection,
      marketOutcome: market.outcome ?? "?",
      expectedUsd: expected,
    });
    if (id === 0n) break;
  }

  return out;
}

export interface ClaimableRowAudit {
  positionId: string;
  marketSlug?: string;
  apiProjectedUsd: number;
  chainExpectedUsd: number;
  selection: string;
  marketOutcome: string;
  ok: boolean;
  detail?: string;
}

export interface SettlementScanReport {
  wallet: string;
  accountId: string | null;
  apiEnv: string;
  apiBaseUrl: string;
  apiRowCount: number;
  chainCandidateCount: number;
  rowsAudited: number;
  audits: ClaimableRowAudit[];
  /** Chain says claimable but absent from GET /claimable (indexer lag or SQL filter drift). */
  missingInApi: ChainClaimableCandidate[];
  apiSumUsd: number;
  chainSumUsd: number;
  ok: boolean;
}

export interface AuditSettlementClaimableParams {
  client: PredictClient;
  env: ApiEnvironment;
  wallet: string;
  accountId?: string | null;
  maxRows?: number;
  pollWhenChainAhead?: boolean;
}

async function fetchClaimableWithOptionalPoll(
  params: AuditSettlementClaimableParams,
  accountId: string | null,
  chainCandidates: ChainClaimableCandidate[],
): Promise<BetsMeListData> {
  let data = await fetchBetsClaimableDirect(params.env, params.wallet);
  if (data.bets.length > 0 || !params.pollWhenChainAhead || chainCandidates.length === 0) {
    return data;
  }

  try {
    await pollUntil(
      async () => {
        data = await fetchBetsClaimableDirect(params.env, params.wallet);
        return data.bets.length > 0;
      },
      {
        timeoutMs: settlementCrosscheckPollMs(),
        intervalMs: settlementCrosscheckPollIntervalMs(),
        label:
          "claimable rows in GET /predict/bets/me/claimable (indexer lag after MarketResolved)",
      },
    );
    return fetchBetsClaimableDirect(params.env, params.wallet);
  } catch {
    return data;
  }
}

/**
 * Read-only scan: audit every API claimable row vs chain; report chain-only gaps.
 * Does not place orders or send claim txs.
 */
export async function auditSettlementClaimable(
  params: AuditSettlementClaimableParams,
): Promise<SettlementScanReport> {
  const maxRows = params.maxRows ?? settlementCrosscheckMaxRows();
  const accountId =
    params.accountId !== undefined
      ? params.accountId
      : await resolveAccountIdForWallet(params.client, params.wallet);

  const chainCandidates = accountId
    ? await scanChainClaimableCandidates(params.client, accountId, Math.max(maxRows, 32))
    : [];

  const claimable = await fetchClaimableWithOptionalPoll(params, accountId, chainCandidates);
  const apiPositionIds = new Set<string>();
  for (const bet of claimable.bets) {
    const id = betWirePositionId(bet);
    if (id !== undefined) apiPositionIds.add(String(id));
  }

  const missingInApi = chainCandidates.filter((c) => !apiPositionIds.has(c.positionId));

  const audits: ClaimableRowAudit[] = [];
  let apiSumUsd = 0;
  let chainSumUsd = 0;
  let ok = true;

  const rows = claimable.bets.slice(0, maxRows);
  for (const [i, bet] of rows.entries()) {
    const positionId = betWirePositionId(bet);
    const label = `bets[${i}] positionId=${String(bet.positionId ?? bet.position_id)}`;
    if (positionId === undefined) {
      ok = false;
      audits.push({
        positionId: "?",
        apiProjectedUsd: bet.projectedPayoutUsd ?? NaN,
        chainExpectedUsd: NaN,
        selection: "?",
        marketOutcome: "?",
        ok: false,
        detail: `${label}: missing positionId on wire`,
      });
      continue;
    }

    let chainExpectedUsd: number;
    let selection: string;
    let marketOutcome: string;
    try {
      const { position, market, expectedUsd } = await loadChainClaimContext(
        params.client,
        positionId,
      );
      if (accountId && position.accountId !== accountId) {
        ok = false;
        audits.push({
          positionId: String(positionId),
          marketSlug: bet.marketSlug,
          apiProjectedUsd: bet.projectedPayoutUsd ?? NaN,
          chainExpectedUsd: expectedUsd,
          selection: position.selection,
          marketOutcome: market.outcome ?? "?",
          ok: false,
          detail: `${label}: owned by ${position.accountId}, expected ${accountId}`,
        });
        continue;
      }
      chainExpectedUsd = expectedUsd;
      selection = position.selection;
      marketOutcome = market.outcome ?? "?";
    } catch (err) {
      ok = false;
      audits.push({
        positionId: String(positionId),
        marketSlug: bet.marketSlug,
        apiProjectedUsd: bet.projectedPayoutUsd ?? NaN,
        chainExpectedUsd: NaN,
        selection: "?",
        marketOutcome: "?",
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    const apiUsd = bet.projectedPayoutUsd ?? NaN;
    const rowOk = Number.isFinite(apiUsd) && Math.abs(apiUsd - chainExpectedUsd) < 0.000_001;
    if (!rowOk) ok = false;

    audits.push({
      positionId: String(positionId),
      marketSlug: bet.marketSlug,
      apiProjectedUsd: apiUsd,
      chainExpectedUsd,
      selection,
      marketOutcome,
      ok: rowOk,
      detail: rowOk
        ? undefined
        : `${label}: projectedPayoutUsd ${apiUsd} vs chain ${chainExpectedUsd}`,
    });

    if (rowOk) {
      apiSumUsd += apiUsd;
      chainSumUsd += chainExpectedUsd;
    }
  }

  const sumOk = rows.length === 0 || Math.abs(apiSumUsd - chainSumUsd) < 0.000_001;
  if (rows.length > 0 && !sumOk) ok = false;

  return {
    wallet: params.wallet,
    accountId,
    apiEnv: params.env.name,
    apiBaseUrl: params.env.baseUrl,
    apiRowCount: claimable.bets.length,
    chainCandidateCount: chainCandidates.length,
    rowsAudited: rows.length,
    audits,
    missingInApi,
    apiSumUsd,
    chainSumUsd,
    ok: ok && sumOk,
  };
}

export function formatSettlementScanReport(report: SettlementScanReport): string {
  const lines: string[] = [
    "── predict claimable scan (read-only) ──",
    `api:       ${report.apiEnv} ${report.apiBaseUrl}`,
    `wallet:    ${report.wallet}`,
    `accountId: ${report.accountId ?? "(unresolved — set E2E_ACCOUNT_ID)"}`,
    `api rows:  ${report.apiRowCount} (audited ${report.rowsAudited})`,
    `chain scan: ${report.chainCandidateCount} resolved unclaimed candidate(s)`,
    "",
  ];

  if (report.rowsAudited === 0) {
    lines.push("No rows in GET /predict/bets/me/claimable.");
    if (report.missingInApi.length > 0) {
      lines.push(
        `Chain scan found ${report.missingInApi.length} candidate(s) not yet in API (indexer lag?):`,
      );
      for (const row of report.missingInApi.slice(0, 10)) {
        lines.push(
          `  positionId=${row.positionId} expected=$${row.expectedUsd} market=${row.marketIdHex} ${row.selection}/${row.marketOutcome}`,
        );
      }
    } else {
      lines.push("Nothing to audit — no pending claimables for this wallet.");
    }
    return lines.join("\n");
  }

  lines.push(
    `Claim All sum: api=$${report.apiSumUsd.toFixed(6)} chain=$${report.chainSumUsd.toFixed(6)} ${report.ok ? "OK" : "MISMATCH"}`,
    "",
    "positionId          apiProj   chainExp  ok  marketSlug / detail",
  );

  for (const row of report.audits) {
    const slug = row.marketSlug ?? "-";
    const flag = row.ok ? "OK" : "FAIL";
    lines.push(
      `${row.positionId.padEnd(20)} ${String(row.apiProjectedUsd).padStart(8)} ${String(row.chainExpectedUsd).padStart(9)} ${flag}  ${slug}${row.detail ? ` — ${row.detail}` : ""}`,
    );
  }

  if (report.missingInApi.length > 0) {
    lines.push("", `Missing in API (${report.missingInApi.length} chain-only):`);
    for (const row of report.missingInApi.slice(0, 10)) {
      lines.push(
        `  positionId=${row.positionId} expected=$${row.expectedUsd} ${row.selection}/${row.marketOutcome}`,
      );
    }
  }

  lines.push("", report.ok ? "Result: PASS" : "Result: FAIL");
  return lines.join("\n");
}

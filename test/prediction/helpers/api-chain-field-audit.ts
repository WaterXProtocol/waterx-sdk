/**
 * Field-level audit: chain views/events vs GET /predict/bets/me wire rows.
 *
 * Use when debugging backend/indexer mismatches (bypass testnet, wallet→account resolver, etc.).
 * Does not fail the run — returns structured rows for scripts/tests to print or soft-assert.
 */
import type { PredictClient } from "~predict/client.ts";
import { getOrder, getPosition } from "~predict/fetch.ts";
import type { PositionView } from "~predict/types.ts";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { tryResolveAccountOwner } from "./account-owner.ts";
import type { BetsMeListData, BetWire } from "./api-wire.ts";
import { findBetForChainFixture } from "./api-wire.ts";
import { normalizeEventMarketIdHex } from "./event-market-id.ts";
import { normalizeEnumField } from "./events.ts";
import { findChainEventByOrderId, findChainEventByPositionId } from "./query-prediction-events.ts";

/** Minimal discovery shape for audit (avoids importing e2e-discovery → simulate → vitest). */
export interface AuditFixtureIds {
  accountId: string;
  openOrderId?: bigint;
  openPositionId?: bigint;
  positionId?: bigint;
  pendingClosePositionId?: bigint;
}

export type FieldStatus = "ok" | "missing_api" | "missing_chain" | "mismatch" | "info" | "skip";

export interface FieldAuditRow {
  field: string;
  status: FieldStatus;
  chain: string;
  api: string;
  hint: string;
}

export interface FixtureAuditReport {
  label: string;
  chainAccountId: string;
  jwtWallet?: string;
  walletMatchesAccountOwner?: boolean;
  apiBetFound: boolean;
  apiBetRaw?: BetWire;
  rows: FieldAuditRow[];
}

export interface BetsMeAuditReport {
  apiEnv: string;
  apiBaseUrl: string;
  jwtWallet?: string;
  registryAccountId: string;
  registryOwner?: string;
  bypassLikely: boolean;
  apiBetCount: number;
  apiSampleKeys: string[];
  fixtures: FixtureAuditReport[];
  globalHints: string[];
}

/** Decode JWT payload (no signature verify) for `sub` / `suiAddress`. */
export function decodeJwtWallet(jwt: string): string | undefined {
  try {
    const part = jwt.split(".")[1];
    if (!part) return undefined;
    const json = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as {
      sub?: string;
      suiAddress?: string;
    };
    const addr = json.suiAddress ?? json.sub;
    return typeof addr === "string" && addr.startsWith("0x") ? addr : undefined;
  } catch {
    return undefined;
  }
}

function row(
  field: string,
  status: FieldStatus,
  chain: string,
  api: string,
  hint: string,
): FieldAuditRow {
  return { field, status, chain, api, hint };
}

function fmtBig(n: bigint | null | undefined): string {
  if (n === null || n === undefined) return "(null)";
  return n.toString();
}

function betRawKeys(bet: BetWire): string[] {
  return Object.keys(bet).sort();
}

function compareString(
  field: string,
  chain: string,
  api: string | undefined,
  hint: string,
): FieldAuditRow {
  if (api === undefined || api === "") {
    return row(field, "missing_api", chain, "(absent)", hint);
  }
  if (chain === api) return row(field, "ok", chain, api, hint);
  return row(field, "mismatch", chain, api, hint);
}

/** Map on-chain position status → common API status strings (backend may differ). */
const API_STATUS_HINT: Record<PositionView["status"], string> = {
  OPEN: "API often uses LIVE / OPEN / ACTIVE for open positions",
  PENDING_CLOSE: "API often uses CLOSING / PENDING_CLOSE / LIVE until settled",
};

async function auditPositionFixture(
  client: PredictClient,
  label: string,
  positionId: bigint,
  accountId: string,
  apiBets: BetWire[],
  opts: { orderId?: bigint; jwtWallet?: string },
): Promise<FixtureAuditReport> {
  const position = await getPosition(client, { positionId });
  const apiBet = findBetForChainFixture(apiBets, { positionId, orderId: opts.orderId });
  const rows: FieldAuditRow[] = [];

  rows.push(
    row(
      "account_id (registry)",
      position.accountId === accountId ? "ok" : "mismatch",
      accountId,
      position.accountId,
      "Chain OrderPlaced/position.account_id is wxa registry object id, not wallet",
    ),
  );

  if (opts.jwtWallet) {
    const owner = await tryResolveAccountOwner(client, accountId);
    rows.push(
      row(
        "JWT wallet vs AccountCreated owner",
        owner === opts.jwtWallet ? "ok" : owner ? "mismatch" : "info",
        owner ?? "(could not resolve owner from events)",
        opts.jwtWallet,
        "Backend bets/me filters by ?address= wallet — must map to registry accountId (#498)",
      ),
    );
  }

  rows.push(
    compareString(
      "positionId",
      fmtBig(positionId),
      apiBet ? String(apiBet.positionId ?? apiBet.position_id ?? "(absent)") : undefined,
      "Primary join key for ChBetSource close/claim paths",
    ),
  );

  rows.push(
    compareString(
      "orderId (wire)",
      opts.orderId !== undefined ? fmtBig(opts.orderId) : "(no open order — bypass)",
      apiBet ? String(apiBet.orderId ?? apiBet.order_id ?? "(absent)") : undefined,
      "Bypass: API may put position cursor in orderId; chain order_id may differ from position_id",
    ),
  );

  rows.push(
    compareString(
      "selection",
      position.selection,
      apiBet?.selection,
      "Should match OrderPlaced / position selection enum",
    ),
  );

  const apiStatus = apiBet?.status;
  rows.push(
    row(
      "status",
      apiStatus && apiStatus.toUpperCase().includes(position.status)
        ? "ok"
        : apiBet
          ? "mismatch"
          : "missing_api",
      position.status,
      apiStatus ?? "(absent)",
      API_STATUS_HINT[position.status],
    ),
  );

  rows.push(
    compareString(
      "market_id (chain hex)",
      position.marketIdHex,
      apiBet?.marketSlug ?? apiBet?.marketId,
      "Chain is UTF-8 label hex (e.g. pred-e2e-open-v1); API usually exposes catalog slug, not raw hex",
    ),
  );

  rows.push(
    compareString(
      "filled_cost (chain, raw units)",
      fmtBig(position.filledCost),
      apiBet?.stakeUsd !== undefined ? String(apiBet.stakeUsd) : undefined,
      "Check float scale: chain uses integer base units; API may show human USD or 1e9-scaled",
    ),
  );

  rows.push(
    compareString(
      "filled_shares",
      fmtBig(position.filledShares),
      apiBet?.shares !== undefined ? String(apiBet.shares) : undefined,
      "Optional API field — not in minimal BetWire contract",
    ),
  );

  const fillEv = await findChainEventByPositionId(client, EVENT_CONTRACT.OrderFilled, positionId);
  if (fillEv) {
    rows.push(
      compareString(
        "event OrderFilled.position_id",
        fmtBig(positionId),
        apiBet ? String(apiBet.positionId ?? apiBet.position_id ?? "") : undefined,
        "Indexer should index same id as on-chain event",
      ),
    );
    rows.push(
      row(
        "event OrderFilled.order_id vs position_id",
        fillEv.json.order_id === fillEv.json.position_id ? "ok" : "info",
        `order=${String(fillEv.json.order_id)} position=${String(fillEv.json.position_id)}`,
        "(n/a)",
        "Contract often has order_id === position_id; bypass testnet may differ",
      ),
    );
  } else {
    rows.push(
      row(
        "event OrderFilled",
        "missing_chain",
        "(not in suix_queryEvents window)",
        "(n/a)",
        "Indexer lag or wrong package",
      ),
    );
  }

  if (position.status === "PENDING_CLOSE") {
    const closeReq = await findChainEventByPositionId(
      client,
      EVENT_CONTRACT.CloseRequested,
      positionId,
    );
    if (closeReq) {
      rows.push(
        row(
          "event CloseRequested.order_id",
          "info",
          String(closeReq.json.order_id),
          apiBet?.orderId !== undefined ? String(apiBet.orderId) : "(absent)",
          "Close order id is NEW close-order id, not position_id",
        ),
      );
    }
  }

  if (!apiBet) {
    rows.push(
      row(
        "bets/me row",
        "missing_api",
        `positionId=${positionId}`,
        "(no matching row in list)",
        "Empty list → wallet→account resolver; non-empty → id/slug join mismatch",
      ),
    );
  } else {
    rows.push(
      row(
        "bets/me wire keys",
        "info",
        "(chain)",
        betRawKeys(apiBet).join(", "),
        "Extra keys are OK if documented",
      ),
    );
  }

  return {
    label,
    chainAccountId: accountId,
    jwtWallet: opts.jwtWallet,
    apiBetFound: apiBet !== undefined,
    apiBetRaw: apiBet,
    rows,
  };
}

async function auditOpenOrderFixture(
  client: PredictClient,
  orderId: bigint,
  accountId: string,
  apiBets: BetWire[],
  jwtWallet?: string,
): Promise<FixtureAuditReport> {
  const order = await getOrder(client, { orderId });
  const apiBet = findBetForChainFixture(apiBets, { orderId });
  const rows: FieldAuditRow[] = [];

  rows.push(
    compareString(
      "orderId",
      fmtBig(orderId),
      apiBet ? String(apiBet.orderId ?? apiBet.order_id) : undefined,
      "Resting OPEN order",
    ),
  );
  rows.push(
    compareString("order.kind", order.kind, apiBet?.status, "OPEN order vs API LIVE/PENDING"),
  );
  rows.push(compareString("selection", order.selection, apiBet?.selection, ""));
  rows.push(
    compareString(
      "max_spend",
      fmtBig(order.maxSpend),
      apiBet?.stakeUsd !== undefined ? String(apiBet.stakeUsd) : undefined,
      "Unfilled: API may omit or show max_spend",
    ),
  );
  rows.push(
    compareString(
      "price_cap_bps",
      fmtBig(order.priceCapBps),
      apiBet?.priceCapBps !== undefined ? String(apiBet.priceCapBps) : undefined,
      "Maps from event price_cap",
    ),
  );

  const placed = await findChainEventByOrderId(client, EVENT_CONTRACT.OrderPlaced, orderId);
  if (placed) {
    rows.push(
      compareString(
        "event OrderPlaced.market_id",
        order.marketIdHex,
        normalizeEventMarketIdHex(placed.json.market_id),
        "Hex/label encoding",
      ),
    );
    rows.push(
      compareString(
        "event OrderPlaced.account_id",
        accountId,
        String(placed.json.account_id),
        "Must match registry account, not JWT wallet",
      ),
    );
  }

  if (!apiBet) {
    rows.push(row("bets/me row", "missing_api", fmtBig(orderId), "(absent)", ""));
  }

  return {
    label: `OPEN order ${orderId}`,
    chainAccountId: accountId,
    jwtWallet,
    apiBetFound: apiBet !== undefined,
    apiBetRaw: apiBet,
    rows,
  };
}

export async function auditBetsMeAgainstChain(
  client: PredictClient,
  fx: AuditFixtureIds,
  apiData: BetsMeListData,
  opts: { jwt?: string; queryWallet?: string; apiEnvName?: string; apiBaseUrl?: string },
): Promise<BetsMeAuditReport> {
  const jwtWallet = opts.queryWallet ?? (opts.jwt ? decodeJwtWallet(opts.jwt) : undefined);
  const owner = await tryResolveAccountOwner(client, fx.accountId);
  const bypassLikely =
    fx.openOrderId === undefined &&
    (fx.openPositionId !== undefined || fx.positionId !== undefined);

  const globalHints = [
    "Registry accountId (chain PTB arg) ≠ query wallet unless AccountResolver maps them.",
    "Bypass testnet: placeOrder may fill immediately → bets/me keyed by position, not resting orderId.",
    "marketSlug (API) vs marketIdHex (chain) — different identifiers; mismatch alone is not always a bug.",
    "stakeUsd scale may differ from max_spend / filled_cost (check backend float rules).",
  ];

  const fixtures: FixtureAuditReport[] = [];

  if (fx.openOrderId !== undefined) {
    fixtures.push(
      await auditOpenOrderFixture(client, fx.openOrderId, fx.accountId, apiData.bets, jwtWallet),
    );
  }

  const posId = fx.openPositionId ?? fx.positionId;
  if (posId !== undefined) {
    fixtures.push(
      await auditPositionFixture(
        client,
        "OPEN position (bypass path)",
        posId,
        fx.accountId,
        apiData.bets,
        {
          orderId: fx.openOrderId,
          jwtWallet,
        },
      ),
    );
  }

  if (fx.pendingClosePositionId !== undefined) {
    fixtures.push(
      await auditPositionFixture(
        client,
        "PENDING_CLOSE position",
        fx.pendingClosePositionId,
        fx.accountId,
        apiData.bets,
        { jwtWallet },
      ),
    );
  }

  const sample = apiData.bets[0];
  return {
    apiEnv: opts.apiEnvName ?? "unknown",
    apiBaseUrl: opts.apiBaseUrl ?? "",
    jwtWallet,
    registryAccountId: fx.accountId,
    registryOwner: owner,
    bypassLikely,
    apiBetCount: apiData.bets.length,
    apiSampleKeys: sample ? betRawKeys(sample) : [],
    fixtures,
    globalHints,
  };
}

/**
 * Soft audit for a single fresh place (+ optional fill) vs one `bets/me` poll snapshot.
 * Used by `api-crosscheck.test.ts` — mismatches are logged, not failed, until backend bypass ends.
 */
export async function auditCrosscheckFreshBet(
  client: PredictClient,
  params: {
    accountId: string;
    orderId: bigint;
    positionId?: bigint;
    bypassLikely: boolean;
    apiData: BetsMeListData;
    queryWallet?: string;
    apiEnvName?: string;
    apiBaseUrl?: string;
  },
): Promise<BetsMeAuditReport> {
  const jwtWallet = params.queryWallet;
  const owner = await tryResolveAccountOwner(client, params.accountId);
  const fixtures: FixtureAuditReport[] = [];

  // Filled crosscheck: resting order is gone from chain view — audit position + API row only.
  if (params.positionId === undefined && !params.bypassLikely) {
    fixtures.push(
      await auditOpenOrderFixture(
        client,
        params.orderId,
        params.accountId,
        params.apiData.bets,
        jwtWallet,
      ),
    );
  }

  const posId = params.positionId;
  if (posId !== undefined) {
    fixtures.push(
      await auditPositionFixture(
        client,
        params.bypassLikely ? "crosscheck (bypass fill)" : "crosscheck (keeper/broker fill)",
        posId,
        params.accountId,
        params.apiData.bets,
        {
          orderId: params.bypassLikely ? undefined : params.orderId,
          jwtWallet,
        },
      ),
    );
  }

  const sample = params.apiData.bets[0];
  return {
    apiEnv: params.apiEnvName ?? "unknown",
    apiBaseUrl: params.apiBaseUrl ?? "",
    jwtWallet,
    registryAccountId: params.accountId,
    registryOwner: owner,
    bypassLikely: params.bypassLikely,
    apiBetCount: params.apiData.bets.length,
    apiSampleKeys: sample ? betRawKeys(sample) : [],
    fixtures,
    globalHints: [
      "Soft crosscheck: field mismatches are logged only (set E2E_API_CROSSCHECK_STRICT=1 to fail).",
      "Registry accountId (chain PTB arg) ≠ query wallet unless AccountResolver maps them (#498).",
      "Bypass testnet: placeOrder may fill immediately → bets/me keyed by position, not resting orderId.",
      "marketSlug (API) vs marketIdHex (chain label) — different identifiers; mismatch alone is not always a bug.",
    ],
  };
}

export function formatBetsMeAuditReport(report: BetsMeAuditReport): string {
  const lines: string[] = [];
  lines.push("═".repeat(72));
  lines.push("Predict bets/me ↔ chain field audit");
  lines.push("═".repeat(72));
  lines.push(`API: ${report.apiEnv} @ ${report.apiBaseUrl}`);
  lines.push(`Query wallet (?address=): ${report.jwtWallet ?? "(none)"}`);
  lines.push(`Registry accountId: ${report.registryAccountId}`);
  lines.push(`Account owner (from events): ${report.registryOwner ?? "(unknown)"}`);
  lines.push(`Bypass likely: ${report.bypassLikely}`);
  lines.push(`GET /predict/bets/me rows: ${report.apiBetCount}`);
  if (report.apiSampleKeys.length > 0) {
    lines.push(`Sample bet keys: ${report.apiSampleKeys.join(", ")}`);
  }
  lines.push("");
  lines.push("Global hints:");
  for (const h of report.globalHints) lines.push(`  • ${h}`);
  for (const fx of report.fixtures) {
    lines.push("");
    lines.push("─".repeat(72));
    lines.push(`${fx.label} — API row ${fx.apiBetFound ? "FOUND" : "MISSING"}`);
    lines.push("─".repeat(72));
    if (fx.apiBetRaw) {
      lines.push(`API raw: ${JSON.stringify(fx.apiBetRaw, null, 2)}`);
    }
    lines.push("");
    lines.push("field                  status        chain                    api");
    for (const r of fx.rows) {
      const f = r.field.padEnd(22).slice(0, 22);
      const s = r.status.padEnd(13).slice(0, 13);
      const c = r.chain.padEnd(24).slice(0, 24);
      const a = r.api.padEnd(24).slice(0, 24);
      lines.push(`${f} ${s} ${c} ${a}`);
      if (r.status !== "ok" && r.hint) lines.push(`    ↳ ${r.hint}`);
    }
  }
  lines.push("");
  lines.push("═".repeat(72));
  return lines.join("\n");
}

/** Count rows that indicate backend/indexer problems (exclude info/skip). */
export function auditIssueCount(report: BetsMeAuditReport): number {
  let n = 0;
  if (report.apiBetCount === 0) n += 1;
  for (const fx of report.fixtures) {
    if (!fx.apiBetFound) n += 1;
    for (const r of fx.rows) {
      if (r.status === "mismatch" || r.status === "missing_api") n += 1;
    }
  }
  return n;
}

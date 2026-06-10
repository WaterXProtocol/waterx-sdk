/**
 * Chain → HTTP cross-check helpers for `integration/api-crosscheck.test.ts`.
 *
 * Poll skips on indexer lag; when a row is found, hard-asserts chain OrderFilled ↔ API wire.
 * Extra field rows are logged; set `E2E_API_CROSSCHECK_STRICT=1` to fail on audit mismatches.
 */
import type { PredictClient } from "~predict/client.ts";
import { getOrder } from "~predict/fetch.ts";
import type { TestContext } from "vitest";
import { expect } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import {
  auditCrosscheckFreshBet,
  auditIssueCount,
  formatBetsMeAuditReport,
} from "./api-chain-field-audit.ts";
import type { ApiEnvironment } from "./api-env.ts";
import { pollUntil } from "./api-poll.ts";
import {
  assertCatalogPlaceTxBuildResult,
  tryCatalogPlaceTxBuild,
  type CatalogPlaceFailure,
} from "./api-tx-build.ts";
import type { BetsMeListData, BetWire } from "./api-wire.ts";
import { findBetForChainFixture } from "./api-wire.ts";
import { catalogFillBrokerOnly } from "./catalog-fill-policy.ts";
import { optionalEnv } from "./e2e-env.ts";
import { eventsFromResult, findEvent, type SuiEventEnvelope } from "./events.ts";
import {
  assertBetWireMatchesFillEconomics,
  assertFillEconomicsOnChain,
  placeCapsFromOrderPlacedEvent,
} from "./fill-economics.ts";
import {
  executeCatalogPlace,
  headlessPlaceCredentials,
  waitForHeadlessFill,
} from "./headless-catalog-bet.ts";
import { fetchBetsMe } from "./integration-api.ts";
import type { IntegrationCtx } from "./integration-setup.ts";
import {
  assertBetWireMatchesChainEvent,
  assertOrderFilledEventOnChain,
} from "./journey-event-assertions.ts";
import { findChainEventByOrderId } from "./query-prediction-events.ts";
import { readStagingMaxSpend, readStagingMaxSpendBase } from "./staging-amounts.ts";
import { transactionDigest } from "./tx-result.ts";

const TESTNET_TX_EXPLORER = "https://suiscan.xyz/testnet/tx";

/** Bypass testnet: broker/keeper fill is seconds; indexer is the slow leg. */
const DEFAULT_CROSSCHECK_BROKER_WAIT_MS = 30_000;
const DEFAULT_CROSSCHECK_BETS_POLL_MS = 60_000;
const DEFAULT_CROSSCHECK_BETS_POLL_INTERVAL_MS = 2_000;
function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = optionalEnv(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Max wait for off-chain broker before keeper `fillOrder` (crosscheck only). */
export function crosscheckBrokerWaitMs(): number {
  return readPositiveIntEnv("E2E_API_CROSSCHECK_BROKER_WAIT_MS", DEFAULT_CROSSCHECK_BROKER_WAIT_MS);
}

/** Poll `GET /predict/bets/me` for the new `positionId` (crosscheck only). */
export function crosscheckBetsMePollMs(): number {
  return readPositiveIntEnv("E2E_API_CROSSCHECK_BETS_POLL_MS", DEFAULT_CROSSCHECK_BETS_POLL_MS);
}

export function crosscheckBetsMePollIntervalMs(): number {
  return readPositiveIntEnv(
    "E2E_API_CROSSCHECK_BETS_POLL_INTERVAL_MS",
    DEFAULT_CROSSCHECK_BETS_POLL_INTERVAL_MS,
  );
}

/** `POST /predict/bets/place` maxSpend + keeper fill target (default **$1.11**). */
export function crosscheckMaxSpend(): string {
  return readStagingMaxSpend();
}

export interface CrosscheckChainIds {
  orderId: bigint;
  positionId?: bigint;
  bypassLikely: boolean;
}

/** Print + return chain refs for Suiscan / backend tickets (place ± separate keeper fill tx). */
export function logCrosscheckChainRefs(params: {
  wallet: string;
  accountId: string;
  marketSlug: string;
  orderId: bigint;
  chainIds: CrosscheckChainIds;
  placeResult: unknown;
  fillResult?: unknown;
  bypassFillInPlace: boolean;
}): string {
  const placeDigest = transactionDigest(params.placeResult);
  const fillDigest = params.fillResult ? transactionDigest(params.fillResult) : undefined;
  const positionId = params.chainIds.positionId;

  const lines = [
    "── predict API crosscheck · chain refs ──",
    `wallet:     ${params.wallet}`,
    `accountId:  ${params.accountId}`,
    `marketSlug: ${params.marketSlug}`,
    `orderId:    ${params.orderId}`,
    `positionId: ${positionId ?? "(none)"}`,
    `placeTx:    ${placeDigest ?? "(unknown)"}`,
    placeDigest ? `placeUrl:   ${TESTNET_TX_EXPLORER}/${placeDigest}` : "",
    params.bypassFillInPlace
      ? "fillTx:     (same as place — OrderFilled in place tx)"
      : `fillTx:     ${fillDigest ?? "(none)"}`,
    !params.bypassFillInPlace && fillDigest
      ? `fillUrl:    ${TESTNET_TX_EXPLORER}/${fillDigest}`
      : "",
    "────────────────────────────────────────",
  ].filter(Boolean);

  const text = lines.join("\n");
  console.log(`\n${text}\n`);
  return text;
}

export function hasApiCrosscheckStrict(): boolean {
  const v = optionalEnv("E2E_API_CROSSCHECK_STRICT");
  return v === "1" || v === "true";
}

/** Detect bypass same-tx fill or keeper fill position id for bets/me polling. */
export function resolveCrosscheckChainIds(
  placeResult: unknown,
  orderId: bigint,
  fillResult?: unknown,
): CrosscheckChainIds {
  const placeFill = findEvent(eventsFromResult(placeResult), EVENT_CONTRACT.OrderFilled.suffix);
  if (placeFill) {
    return {
      orderId,
      positionId: BigInt(String(placeFill.json.position_id)),
      bypassLikely: true,
    };
  }

  if (fillResult) {
    const keeperFill = findEvent(eventsFromResult(fillResult), EVENT_CONTRACT.OrderFilled.suffix);
    if (keeperFill) {
      const positionId = BigInt(String(keeperFill.json.position_id));
      return {
        orderId,
        positionId,
        bypassLikely: String(keeperFill.json.order_id) === String(keeperFill.json.position_id),
      };
    }
  }

  return { orderId, bypassLikely: false };
}

export function resolveCrosscheckFillEvent(
  placeResult: unknown,
  fillResult?: unknown,
): SuiEventEnvelope | undefined {
  return (
    findEvent(eventsFromResult(placeResult), EVENT_CONTRACT.OrderFilled.suffix) ??
    (fillResult
      ? findEvent(eventsFromResult(fillResult), EVENT_CONTRACT.OrderFilled.suffix)
      : undefined)
  );
}

/** Place/fill txs, else chain query by `orderId` (broker fill). */
export async function resolveCrosscheckFillEventAsync(
  client: PredictClient,
  placeResult: unknown,
  fillResult: unknown | undefined,
  orderId: bigint,
): Promise<SuiEventEnvelope | undefined> {
  const local = resolveCrosscheckFillEvent(placeResult, fillResult);
  if (local) return local;
  return findChainEventByOrderId(client, EVENT_CONTRACT.OrderFilled, orderId);
}

export interface CatalogCrosscheckPlaceFill {
  placeResult: unknown;
  fillResult?: unknown;
  orderId: bigint;
  marketSlug: string;
  chainIds: CrosscheckChainIds;
  bypassFillInPlace: boolean;
}

/**
 * Catalog closed loop for crosscheck: feed → POST place → execute → broker/keeper fill.
 * Returns null when no catalog market yields txBytes (caller should skip).
 */
export async function runCatalogCrosscheckPlaceFill(
  ctx: IntegrationCtx,
  apiEnv: ApiEnvironment,
  options?: { placeFailures?: CatalogPlaceFailure[] },
): Promise<CatalogCrosscheckPlaceFill | null> {
  const creds = headlessPlaceCredentials(ctx);
  const placeFailures = options?.placeFailures ?? [];
  const maxSpend = crosscheckMaxSpend();
  const hit = await tryCatalogPlaceTxBuild(apiEnv, creds, { failures: placeFailures, maxSpend });
  if (!hit) return null;

  assertCatalogPlaceTxBuildResult(hit.envelope);
  if (!hit.envelope.success) {
    throw new Error("POST /predict/bets/place returned success=false after assert");
  }
  const placeResult = await executeCatalogPlace(
    ctx,
    hit.body,
    hit.envelope.data.txBytes,
    hit.envelope.data.sponsored,
  );
  const placed = resolveCrosscheckPlacedEvent(placeResult);
  const orderId = BigInt(String(placed.json.order_id));

  const bypassFillInPlace = Boolean(
    findEvent(eventsFromResult(placeResult), EVENT_CONTRACT.OrderFilled.suffix),
  );

  let fillResult: unknown | undefined;
  let positionId: bigint | undefined;
  if (bypassFillInPlace) {
    const ev = findEvent(eventsFromResult(placeResult), EVENT_CONTRACT.OrderFilled.suffix)!;
    positionId = BigInt(String(ev.json.position_id));
  } else {
    const placeCaps = placeCapsFromOrderPlacedEvent(placed);
    const fill = await waitForHeadlessFill(ctx, orderId, {
      placeCaps,
      brokerWaitMs: crosscheckBrokerWaitMs(),
      targetFilledCost: readStagingMaxSpendBase(),
      brokerOnly: catalogFillBrokerOnly(),
    });
    positionId = fill.positionId;
    fillResult = fill.fillResult;
  }

  const chainIds = resolveCrosscheckChainIds(placeResult, orderId, fillResult);
  const mergedChainIds: CrosscheckChainIds = {
    ...chainIds,
    positionId: chainIds.positionId ?? positionId,
  };

  return {
    placeResult,
    fillResult,
    orderId,
    marketSlug: hit.target.catalog.marketSlug,
    chainIds: mergedChainIds,
    bypassFillInPlace,
  };
}

export function resolveCrosscheckPlacedEvent(placeResult: unknown): SuiEventEnvelope {
  const placed = findEvent(eventsFromResult(placeResult), EVENT_CONTRACT.OrderPlaced.suffix);
  expect(placed, "placeOrder must emit OrderPlaced").toBeDefined();
  return placed!;
}

/** Hard chain ↔ API assertions when `bets/me` returns the new row (bypass wire now Polymarket-shaped). */
export async function assertCrosscheckFillChainAndApi(
  client: PredictClient,
  params: {
    accountId: string;
    chainIds: CrosscheckChainIds;
    bet: BetWire;
    placeResult: unknown;
    fillResult?: unknown;
  },
): Promise<void> {
  const positionId = params.chainIds.positionId;
  expect(positionId, "crosscheck fill assertions require a filled position").toBeDefined();

  const placed = resolveCrosscheckPlacedEvent(params.placeResult);
  const fillEv = await resolveCrosscheckFillEventAsync(
    client,
    params.placeResult,
    params.fillResult,
    params.chainIds.orderId,
  );
  expect(fillEv, "OrderFilled event required for fill economics").toBeDefined();

  const caps = placeCapsFromOrderPlacedEvent(placed);
  // Filled resting orders are often gone from `getOrder` (broker / bypass); position view is authoritative.
  const { event, position, order } = await assertOrderFilledEventOnChain(
    client,
    positionId!,
    undefined,
  );
  expect(event.type).toContain("OrderFilled");

  const effectiveBps = assertFillEconomicsOnChain(caps, fillEv!, position);
  assertBetWireMatchesChainEvent(params.bet, event, {
    orderId: params.chainIds.orderId,
    positionId: positionId!,
  });

  let orderView = order;
  if (orderView === undefined && !params.chainIds.bypassLikely) {
    try {
      orderView = await getOrder(client, { orderId: params.chainIds.orderId });
    } catch {
      /* filled orders may no longer be OPEN on-chain */
    }
  }
  assertBetWireMatchesFillEconomics(params.bet, position, effectiveBps, orderView);
}

export type BetsMePollOutcome =
  | { kind: "found"; data: BetsMeListData; bet: BetWire }
  | { kind: "empty" }
  | { kind: "stale"; lastSample?: string };

/**
 * Poll `bets/me` for chain fixture ids. Does not throw on timeout — returns `empty` or `stale`
 * so callers can skip while backend/indexer is still bypass-shaped.
 */
export async function pollBetsMeForChainFixtureSoft(
  ctx: TestContext,
  env: ApiEnvironment,
  fixture: { orderId?: bigint; positionId?: bigint },
  options?: { timeoutMs?: number; intervalMs?: number; wallet?: string; query?: string },
): Promise<BetsMePollOutcome> {
  const query = options?.query ?? "?filter=all&limit=50";
  let sawAnyBet = false;
  let lastSample = "";

  try {
    await pollUntil(
      async () => {
        const data = await fetchBetsMe(ctx, env, query, options?.wallet);
        if (data.bets.length > 0) {
          sawAnyBet = true;
          const sample = data.bets[0]!;
          lastSample = JSON.stringify({
            orderId: sample.orderId ?? sample.order_id,
            positionId: sample.positionId ?? sample.position_id,
            status: sample.status,
          });
        }
        return findBetForChainFixture(data.bets, fixture) !== undefined;
      },
      {
        timeoutMs: options?.timeoutMs ?? crosscheckBetsMePollMs(),
        intervalMs: options?.intervalMs ?? crosscheckBetsMePollIntervalMs(),
        label: `chain fixture ${JSON.stringify({
          orderId: fixture.orderId?.toString(),
          positionId: fixture.positionId?.toString(),
        })} in GET /predict/bets/me`,
      },
    );
    const data = await fetchBetsMe(ctx, env, query, options?.wallet);
    const bet = findBetForChainFixture(data.bets, fixture);
    if (!bet) return { kind: "stale", lastSample };
    return { kind: "found", data, bet };
  } catch {
    if (!sawAnyBet) return { kind: "empty" };
    return { kind: "stale", lastSample };
  }
}

/** Log field audit; only throws when `E2E_API_CROSSCHECK_STRICT=1` and issues remain. */
export async function runSoftBetsMeFieldAudit(
  client: PredictClient,
  params: {
    accountId: string;
    chainIds: CrosscheckChainIds;
    apiData: BetsMeListData;
    apiEnv: ApiEnvironment;
    wallet?: string;
  },
): Promise<void> {
  const report = await auditCrosscheckFreshBet(client, {
    accountId: params.accountId,
    orderId: params.chainIds.orderId,
    positionId: params.chainIds.positionId,
    bypassLikely: params.chainIds.bypassLikely,
    apiData: params.apiData,
    queryWallet: params.wallet,
    apiEnvName: params.apiEnv.name,
    apiBaseUrl: params.apiEnv.baseUrl,
  });

  const text = formatBetsMeAuditReport(report);
  console.log(`\n${text}\n`);

  if (hasApiCrosscheckStrict() && auditIssueCount(report) > 0) {
    throw new Error(
      `E2E_API_CROSSCHECK_STRICT=1 and audit reported ${auditIssueCount(report)} issue(s) — see log above`,
    );
  }
}

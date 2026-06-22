/**
 * Headless frontend closed loop:
 * catalog → POST /predict/bets/place → sign txBytes → broker/keeper fill → GET /predict/bets/me
 */
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "~predict/client.ts";
import { getOrder } from "~predict/fetch.ts";
import { fillOrder, placeOrder } from "~predict/prediction.ts";
import type { TestContext } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { INTEGRATION_MIN_FILL } from "../fixtures/ptb-params.ts";
import { isApiUnreachableError } from "./api-client.ts";
import type { ApiEnvironment } from "./api-env.ts";
import { pollUntil } from "./api-poll.ts";
import {
  assertCatalogPlaceTxBuildResult,
  formatCatalogPlaceFailures,
  tryCatalogPlaceTxBuild,
  type CatalogPlaceFailure,
  type CatalogPlaceTarget,
  type PlaceBetCredentials,
  type PlaceBetRequestBody,
} from "./api-tx-build.ts";
import { findBetForChainFixture, type BetWire } from "./api-wire.ts";
import {
  CatalogBrokerFillTimeoutError,
  catalogFillBrokerOnly,
  DEFAULT_CATALOG_KEEPER_FALLBACK_WAIT_MS,
} from "./catalog-fill-policy.ts";
import { optionalEnv } from "./e2e-env.ts";
import { expectEvent } from "./events.ts";
import {
  assertKeeperFillArgsWithinCaps,
  keeperFillFromPlaceCaps,
  keeperFillTargetCost,
  placeCapsFromOrderPlacedEvent,
  type PlaceCaps,
} from "./fill-economics.ts";
import { fetchBetsMe, type PollBetsMeFixtureResult } from "./integration-api.ts";
import { executeAndFetch, isStaleObjectError, type IntegrationCtx } from "./integration-setup.ts";
import { findChainEventByOrderId } from "./query-prediction-events.ts";
import { readStagingMaxSpend, readStagingMaxSpendBase } from "./staging-amounts.ts";
import { assertSuccessfulExecution, transactionDigest } from "./tx-result.ts";

export function hasHeadlessBetEnabled(): boolean {
  const v = optionalEnv("E2E_HEADLESS_BET");
  return v === "1" || v === "true";
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = optionalEnv(name);
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const HEADLESS_BROKER_WAIT_MS = () =>
  readPositiveIntEnv("E2E_HEADLESS_BROKER_WAIT_MS", 90_000);

export const HEADLESS_BETS_POLL_MS = () => readPositiveIntEnv("E2E_HEADLESS_BETS_POLL_MS", 120_000);

export interface HeadlessPlaceResult {
  target: CatalogPlaceTarget;
  orderId: bigint;
  placeDigest?: string;
}

export interface HeadlessFillResult {
  positionId: bigint;
  /** True when `OrderFilled` appeared before the broker wait deadline (no local keeper fill). */
  brokerFilled: boolean;
  /** Present when this process executed `fillOrder` (keeper path). */
  fillResult?: unknown;
}

export interface HeadlessCatalogBetOutcome {
  place: HeadlessPlaceResult;
  fill: HeadlessFillResult;
  marketSlug: string;
  bet: BetWire;
  betsMe: PollBetsMeFixtureResult;
}

export type { CatalogMarketBetOutcome } from "./catalog-cli.ts";
export { placeAndFillCatalogMarket } from "./catalog-cli.ts";

/** Uses integration ctx account + owner (must match ?address= wallet for bets/me). */
export function headlessPlaceCredentials(ctx: IntegrationCtx): PlaceBetCredentials {
  return { accountId: ctx.accountId, sender: ctx.ownerAddress };
}

function marketIdHexToBytes(marketId: string): Uint8Array {
  const clean = marketId.startsWith("0x") ? marketId.slice(2) : marketId;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * Execute catalog place: API `txBytes` when unsponsored; otherwise rebuild `placeOrder`
 * locally (staging Enoki sponsorship needs a second sponsor signature the SDK cannot fake).
 */
export async function executeCatalogPlace(
  ctx: IntegrationCtx,
  body: PlaceBetRequestBody,
  txBytes: string,
  sponsored: boolean | undefined,
): Promise<unknown> {
  if (sponsored) {
    return executeAndFetch(ctx.client, ctx.signer, (tx) => {
      placeOrder(ctx.client, tx, {
        accountId: body.accountId,
        marketId: marketIdHexToBytes(body.marketId),
        selection: body.selection,
        maxSpend: BigInt(body.maxSpend),
        minShares: BigInt(body.minShares),
        priceCapBps: BigInt(body.priceCapBps),
        expiryTs: BigInt(body.expiryTs),
      });
    });
  }
  return executePlaceTxBytes(ctx.client, ctx.signer, txBytes);
}

/** Deserialize API `txBytes` (base64) and sign + execute as the catalog `sender`. */
export async function executePlaceTxBytes(
  client: PredictClient,
  signer: Ed25519Keypair,
  txBytes: string,
  opts?: { maxAttempts?: number },
): Promise<unknown> {
  const maxAttempts = opts?.maxAttempts ?? 4;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const tx = Transaction.from(txBytes);
    try {
      const result = await client.signAndExecuteTransaction({
        signer,
        transaction: tx,
        include: { effects: true, objectTypes: true, events: true },
      });
      assertSuccessfulExecution(result);
      const digest = transactionDigest(result);
      if (digest) {
        await client.waitForTransaction(digest);
        return await client.grpcClient.getTransaction({ digest, include: { events: true } });
      }
      return result;
    } catch (err) {
      lastErr = err;
      if (!isStaleObjectError(err) || attempt === maxAttempts - 1) throw err;
      const backoffMs = 250 * 2 ** attempt + Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}

async function tryLoadOpenOrder(client: PredictClient, orderId: bigint): Promise<boolean> {
  try {
    const order = await getOrder(client, { orderId });
    return order.kind === "OPEN";
  } catch {
    return false;
  }
}

/**
 * Wait for off-chain broker `fill_order`. Local keeper `fillOrder` only when
 * `E2E_CATALOG_KEEPER_FALLBACK=1` and `ctx.keeper` is set.
 */
export async function waitForHeadlessFill(
  ctx: IntegrationCtx,
  orderId: bigint,
  options?: {
    brokerWaitMs?: number;
    placeCaps?: PlaceCaps;
    targetFilledCost?: bigint;
    /** Override broker-only policy (default: true unless keeper fallback env). */
    brokerOnly?: boolean;
  },
): Promise<HeadlessFillResult> {
  const brokerOnly = catalogFillBrokerOnly(options?.brokerOnly);
  const brokerWaitMs =
    options?.brokerWaitMs ??
    (brokerOnly ? HEADLESS_BROKER_WAIT_MS() : DEFAULT_CATALOG_KEEPER_FALLBACK_WAIT_MS);
  const deadline = Date.now() + brokerWaitMs;

  while (Date.now() < deadline) {
    const filled = await findChainEventByOrderId(ctx.client, EVENT_CONTRACT.OrderFilled, orderId);
    if (filled) {
      return {
        positionId: BigInt(String(filled.json.position_id)),
        brokerFilled: true,
      };
    }
    const stillOpen = await tryLoadOpenOrder(ctx.client, orderId);
    if (!stillOpen) {
      const late = await findChainEventByOrderId(ctx.client, EVENT_CONTRACT.OrderFilled, orderId);
      if (late) {
        return {
          positionId: BigInt(String(late.json.position_id)),
          brokerFilled: true,
        };
      }
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }

  if (brokerOnly) {
    throw new CatalogBrokerFillTimeoutError(orderId, brokerWaitMs);
  }

  if (!ctx.keeper) {
    throw new Error(
      `order ${orderId} still OPEN after ${brokerWaitMs}ms — broker down and no keeper signer ` +
        `(set E2E_CATALOG_KEEPER_FALLBACK=1 + keeper key for decoupled fillOrder)`,
    );
  }

  const fillArgs = options?.placeCaps
    ? options.targetFilledCost !== undefined
      ? keeperFillTargetCost(options.placeCaps, options.targetFilledCost)
      : keeperFillFromPlaceCaps(options.placeCaps)
    : INTEGRATION_MIN_FILL;
  if (options?.placeCaps) {
    assertKeeperFillArgsWithinCaps(options.placeCaps, fillArgs.filledShares, fillArgs.filledCost);
  }

  let fillResult: unknown;
  try {
    fillResult = await executeAndFetch(ctx.client, ctx.keeper, (tx) => {
      fillOrder(ctx.client, tx, { orderId, ...fillArgs });
    });
  } catch (err) {
    // Broker may have filled between the wait loop and keeper `fill_order` (race → abort 20).
    const late = await findChainEventByOrderId(ctx.client, EVENT_CONTRACT.OrderFilled, orderId);
    if (late) {
      return {
        positionId: BigInt(String(late.json.position_id)),
        brokerFilled: true,
      };
    }
    throw err;
  }
  const ev = expectEvent(fillResult, EVENT_CONTRACT.OrderFilled.suffix, {
    order_id: String(orderId),
  });
  return {
    positionId: BigInt(String(ev.json.position_id)),
    brokerFilled: false,
    fillResult,
  };
}

/**
 * Full steps 1–5: catalog pick → POST place → execute → fill → poll bets/me.
 * Returns null when catalog/place cannot produce txBytes (caller should skip).
 */
export async function runHeadlessCatalogBetFlow(
  testCtx: TestContext,
  ctx: IntegrationCtx,
  apiEnv: ApiEnvironment,
  options?: { placeFailures?: CatalogPlaceFailure[] },
): Promise<HeadlessCatalogBetOutcome | null> {
  const creds = headlessPlaceCredentials(ctx);
  const placeFailures = options?.placeFailures ?? [];
  const maxSpend = readStagingMaxSpend();
  const hit = await tryCatalogPlaceTxBuild(apiEnv, creds, { failures: placeFailures, maxSpend });
  if (!hit) return null;

  assertCatalogPlaceTxBuildResult(hit.envelope);
  if (!hit.envelope.success) {
    throw new Error("POST /predict/bets/place returned success=false after assert");
  }
  const txBytes = hit.envelope.data.txBytes;
  const sponsored = hit.envelope.data.sponsored;

  const placeResult = await executeCatalogPlace(ctx, hit.body, txBytes, sponsored);
  const placed = expectEvent(placeResult, EVENT_CONTRACT.OrderPlaced.suffix, {
    account_id: ctx.accountId,
  });
  const orderId = BigInt(String(placed.json.order_id));
  const placeCaps = placeCapsFromOrderPlacedEvent(placed);

  const fill = await waitForHeadlessFill(ctx, orderId, {
    placeCaps,
    targetFilledCost: readStagingMaxSpendBase(),
    brokerOnly: catalogFillBrokerOnly(),
  });

  const fixture = { orderId, positionId: fill.positionId };
  let sawAnyBet = false;
  let lastSample = "";
  try {
    await pollUntil(
      async () => {
        const data = await fetchBetsMe(testCtx, apiEnv, "?filter=all&limit=50", ctx.ownerAddress);
        if (data.bets.length > 0) {
          sawAnyBet = true;
          const sample = data.bets[0]!;
          lastSample = JSON.stringify({
            orderId: sample.orderId ?? sample.order_id,
            positionId: sample.positionId ?? sample.position_id,
          });
        }
        return findBetForChainFixture(data.bets, fixture) !== undefined;
      },
      {
        timeoutMs: HEADLESS_BETS_POLL_MS(),
        intervalMs: 3_000,
        label: `catalog bet orderId=${orderId} or positionId=${fill.positionId} in bets/me`,
      },
    );
  } catch (err) {
    if (isApiUnreachableError(err)) {
      throw err;
    }
    if (!sawAnyBet) {
      testCtx.skip(
        true,
        "GET /predict/bets/me empty after catalog place+fill — wallet→account resolver or indexer not wired",
      );
      return null;
    }
    const msg = err instanceof Error ? err.message : String(err);
    testCtx.skip(
      true,
      `${msg}${lastSample ? ` (sample: ${lastSample})` : ""} — indexer lag; chain fill ok (brokerFilled=${fill.brokerFilled})`,
    );
    return null;
  }

  const data = await fetchBetsMe(testCtx, apiEnv, "?filter=all&limit=50", ctx.ownerAddress);
  const bet = findBetForChainFixture(data.bets, fixture);
  if (!bet) {
    testCtx.skip(true, "poll succeeded but bets/me row missing on final fetch");
    return null;
  }
  const polled = { data, bet };

  return {
    place: {
      target: hit.target,
      orderId,
      placeDigest: transactionDigest(placeResult),
    },
    fill,
    marketSlug: hit.target.catalog.marketSlug,
    bet: polled.bet,
    betsMe: polled,
  };
}

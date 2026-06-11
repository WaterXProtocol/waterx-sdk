import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "~predict/client.ts";
import { confirmClose, fillOrder, placeOrder, requestClose } from "~predict/prediction.ts";

import {
  INTEGRATION_FILLABLE_PRICE_CAP_BPS,
  INTEGRATION_MIN_FILL,
} from "../fixtures/ptb-params.ts";
import type { ApiEnvironment } from "./api-env.ts";
import { discoverCatalogContext } from "./api-smoke.ts";
import { INTEGRATION_FAR_FUTURE, INTEGRATION_OPEN_MARKET_BYTES } from "./integration-positions.ts";
import { assertSimulateSucceeded } from "./journey-assertions.ts";
import {
  expectSimulateSuccess,
  parseMoveAbortCode,
  simulateErrorMessage,
  simulateWithSender,
} from "./simulate.ts";

type SimulateResult = Awaited<ReturnType<PredictClient["simulate"]>>;

/** `waterx_prediction::fill_order` abort when the order expiry has passed (stale seed). */
export const E_ORDER_EXPIRED = 18;

export interface CatalogDiscovery {
  segment: "crypto" | "sport";
  slug: string;
}

/** Context for simulate-first integration journeys (no signer / keeper key). */
export interface SimulateJourneyCtx {
  client: PredictClient;
  accountId: string;
  /** Wallet that owns `accountId` — used as `tx.setSender` for account-scoped PTBs. */
  ownerAddress: string;
}

export interface SimulateJourneyFixtures {
  openMarketIdBytes?: Uint8Array;
  openOrderId?: bigint;
  openPositionId?: bigint;
  pendingClosePositionId?: bigint;
}

/** Owner `placeOrder` dry-run (same as `test/prediction/e2e/order.test.ts`). */
export async function simulatePlaceYesBet(
  ctx: SimulateJourneyCtx,
  marketId: Uint8Array = INTEGRATION_OPEN_MARKET_BYTES,
): Promise<SimulateResult> {
  const tx = new Transaction();
  placeOrder(ctx.client, tx, {
    accountId: ctx.accountId,
    marketId,
    selection: "YES",
    maxSpend: 1_000n,
    minShares: 1n,
    priceCapBps: INTEGRATION_FILLABLE_PRICE_CAP_BPS,
    expiryTs: INTEGRATION_FAR_FUTURE,
  });
  const result = await expectSimulateSuccess(ctx.client, tx, ctx.ownerAddress);
  assertSimulateSucceeded(result, "placeOrder");
  return result;
}

/**
 * Keeper `fillOrder` dry-run. Uses a seeded OPEN `orderId` (simulate does not create orders).
 * @returns `'expired'` when the order is no longer fillable on-chain.
 */
export async function simulateFillBet(
  client: PredictClient,
  orderId: bigint,
): Promise<"ok" | "expired"> {
  const tx = new Transaction();
  fillOrder(client, tx, { orderId, ...INTEGRATION_MIN_FILL });
  const result = await simulateWithSender(client, tx);
  if (result.$kind === "FailedTransaction") {
    if (parseMoveAbortCode(simulateErrorMessage(result)) === E_ORDER_EXPIRED) {
      return "expired";
    }
    throw new Error(`simulateFillBet: ${simulateErrorMessage(result)}`);
  }
  assertSimulateSucceeded(result, "fillOrder");
  return "ok";
}

/** Owner `requestClose` dry-run on a seeded OPEN position. */
export async function simulateRequestClose(
  ctx: SimulateJourneyCtx,
  positionId: bigint,
): Promise<SimulateResult> {
  const tx = new Transaction();
  requestClose(ctx.client, tx, {
    positionId,
    minProceeds: 1n,
    expiryTs: INTEGRATION_FAR_FUTURE,
  });
  const result = await expectSimulateSuccess(ctx.client, tx, ctx.ownerAddress);
  assertSimulateSucceeded(result, "requestClose");
  return result;
}

/** Keeper `confirmClose` dry-run on a seeded PENDING_CLOSE position. */
export async function simulateConfirmClose(
  client: PredictClient,
  positionId: bigint,
): Promise<SimulateResult> {
  const tx = new Transaction();
  confirmClose(client, tx, { positionId, proceeds: 1n });
  const result = await expectSimulateSuccess(client, tx);
  assertSimulateSucceeded(result, "confirmClose");
  return result;
}

/**
 * Testnet broker often runs in bypass mode: `placeOrder` fills immediately, so no resting
 * `OrderKind::OPEN` order remains (see `EVENT_CONTRACT.OrderFilled` bypass note).
 * Journey tests should skip keeper `fillOrder` simulate and use `openPositionId` instead.
 */
export function likelyBypassFilledFixtures(fx: {
  openOrderId?: bigint;
  openPositionId?: bigint;
  positionId?: bigint;
}): boolean {
  return (
    fx.openOrderId === undefined && (fx.openPositionId !== undefined || fx.positionId !== undefined)
  );
}

/** Returns the first feed slug with a reachable detail page, or null when the catalog is empty. */
export async function tryDiscoverCatalogMarket(
  env: ApiEnvironment,
): Promise<CatalogDiscovery | null> {
  for (const segment of ["crypto", "sport"] as const) {
    const hit = await discoverCatalogContext(env, { segment });
    if (hit) return { segment, slug: hit.marketSlug };
  }
  return null;
}

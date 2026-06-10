/**
 * Catalog place → poll GET /predict/bets/me for pending (submitting) → filled (confirmed).
 * Same product contract as `pnpm predict:place-all-markets` / frontend watch flow.
 */
import type { TestContext } from "vitest";
import { expect } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import type { TradeableCatalogMarket } from "./api-catalog-pure.ts";
import type { ApiEnvironment } from "./api-env.ts";
import { pollUntil } from "./api-poll.ts";
import {
  betWireAwaitingBrokerFill,
  betWireBrokerFilled,
  findBetForChainFixture,
  type BetWire,
} from "./api-wire.ts";
import { placeCatalogMarketOnly } from "./catalog-cli.ts";
import { optionalEnv } from "./e2e-env.ts";
import { fetchBetsMe } from "./integration-api.ts";
import type { IntegrationCtx } from "./integration-setup.ts";
import { findChainEventByOrderId } from "./query-prediction-events.ts";

export interface CatalogBetsMeLifecycleResult {
  marketSlug: string;
  orderId: bigint;
  positionId: bigint;
  bet: BetWire;
  sawPendingOnWire: boolean;
}

function readBrokerWaitMs(): number {
  const raw = optionalEnv("E2E_JOURNEY_BETS_FILL_WAIT_MS");
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 90_000;
}

function readPendingWindowMs(): number {
  const raw = optionalEnv("E2E_JOURNEY_BETS_PENDING_WAIT_MS");
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 20_000;
}

async function fetchBetForFixture(
  testCtx: TestContext,
  apiEnv: ApiEnvironment,
  wallet: string,
  fixture: { orderId: bigint; positionId?: bigint },
): Promise<BetWire | undefined> {
  const data = await fetchBetsMe(testCtx, apiEnv, "?filter=all&limit=50", wallet);
  return findBetForChainFixture(data.bets, fixture);
}

/**
 * Place one catalog bet, assert bets/me shows broker-pending then filled for that orderId.
 * Relies on staging backend broker (same as `predict:place-all-markets`); no local keeper fill.
 */
export async function assertCatalogBetsMePendingThenFilled(
  testCtx: TestContext,
  ctx: IntegrationCtx,
  apiEnv: ApiEnvironment,
  market: TradeableCatalogMarket,
  wallet: string,
): Promise<CatalogBetsMeLifecycleResult> {
  const creds = { accountId: ctx.accountId, sender: ctx.ownerAddress };
  const brokerWaitMs = readBrokerWaitMs();
  const pendingWindowMs = readPendingWindowMs();

  const placed = await placeCatalogMarketOnly(ctx, apiEnv, market, creds);

  if (placed.alreadyFilled && placed.positionId !== undefined) {
    const bet = await fetchBetForFixture(testCtx, apiEnv, wallet, { orderId: placed.orderId });
    expect(bet, `bets/me should list bypass-filled orderId=${placed.orderId}`).toBeDefined();
    expect(betWireBrokerFilled(bet!), "bypass fill should be confirmed on wire").toBe(true);
    return {
      marketSlug: placed.marketSlug,
      orderId: placed.orderId,
      positionId: placed.positionId,
      bet: bet!,
      sawPendingOnWire: false,
    };
  }

  let sawPendingOnWire = false;
  try {
    await pollUntil(
      async () => {
        const bet = await fetchBetForFixture(testCtx, apiEnv, wallet, { orderId: placed.orderId });
        if (bet && betWireAwaitingBrokerFill(bet)) {
          sawPendingOnWire = true;
          return true;
        }
        return false;
      },
      {
        timeoutMs: pendingWindowMs,
        intervalMs: 1_000,
        label: `orderId=${placed.orderId} pending (submissionState=submitting) in GET /predict/bets/me`,
      },
    );
  } catch (err) {
    const early = await fetchBetForFixture(testCtx, apiEnv, wallet, { orderId: placed.orderId });
    if (early && betWireBrokerFilled(early)) {
      throw new Error(
        `bets/me jumped to filled before pending was observable for orderId=${placed.orderId} — ` +
          `indexer may be too fast; retry or increase E2E_JOURNEY_BETS_PENDING_WAIT_MS`,
        { cause: err },
      );
    }
    throw err;
  }

  let chainPositionId: bigint | undefined;
  await pollUntil(
    async () => {
      const chainFill = await findChainEventByOrderId(
        ctx.client,
        EVENT_CONTRACT.OrderFilled,
        placed.orderId,
      );
      if (chainFill) {
        chainPositionId = BigInt(String(chainFill.json.position_id));
      }
      const bet = await fetchBetForFixture(testCtx, apiEnv, wallet, {
        orderId: placed.orderId,
        ...(chainPositionId !== undefined ? { positionId: chainPositionId } : {}),
      });
      return bet !== undefined && betWireBrokerFilled(bet);
    },
    {
      timeoutMs: brokerWaitMs,
      intervalMs: 2_000,
      label: `orderId=${placed.orderId} filled (submissionState=confirmed) in GET /predict/bets/me`,
    },
  );

  const bet = await fetchBetForFixture(testCtx, apiEnv, wallet, {
    orderId: placed.orderId,
    ...(chainPositionId !== undefined ? { positionId: chainPositionId } : {}),
  });
  expect(bet, `bets/me row for orderId=${placed.orderId}`).toBeDefined();
  expect(betWireBrokerFilled(bet!), "filled bet should be submissionState=confirmed").toBe(true);
  expect(sawPendingOnWire, "should have observed pending/submitting on bets/me before fill").toBe(
    true,
  );

  const rawPos = bet!.positionId ?? bet!.position_id;
  expect(rawPos, "filled bet should expose positionId on wire").toBeDefined();
  const positionId = BigInt(String(rawPos));

  if (bet!.marketSlug !== undefined) {
    expect(bet!.marketSlug).toBe(placed.marketSlug);
  }

  return {
    marketSlug: placed.marketSlug,
    orderId: placed.orderId,
    positionId,
    bet: bet!,
    sawPendingOnWire,
  };
}

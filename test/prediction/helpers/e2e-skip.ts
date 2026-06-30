import type { PredictClient } from "~predict/client.ts";
import type { TestContext } from "vitest";

import { tryResolveAccountOwner } from "./account-owner.ts";
import type { E2eFixtures } from "./e2e-discovery.ts";
import type { DiscoveredWalletCoin } from "./wallet-coin-discovery.ts";

/** Skip the current test with a visible reason instead of silently passing. */
export function skipUnlessDefined<T>(
  ctx: TestContext,
  value: T | undefined,
  label: string,
  fx?: E2eFixtures,
): asserts value is T {
  if (value === undefined) {
    const hint = fx ? ` Discovery: ${fixtureSummary(fx)}` : "";
    ctx.skip(true, `Missing E2E fixture "${label}" after on-chain discovery.${hint}`);
  }
}

/** Skip with an explicit "fixable by running seed" hint pointing at the right preset/stage. */
export function skipFixableBySeed(
  ctx: TestContext,
  label: string,
  hint: { preset?: string; stage?: string },
  fx?: E2eFixtures,
): never {
  const cmd = hint.preset
    ? `pnpm seed:testnet -- --preset=${hint.preset}`
    : hint.stage
      ? `pnpm seed:testnet -- --stage=${hint.stage}`
      : "pnpm seed:testnet";
  const summary = fx ? ` Discovery: ${fixtureSummary(fx)}` : "";
  ctx.skip(true, `Need testnet pre-condition: ${label}. Fix with: ${cmd}.${summary}`);
  throw new Error("unreachable");
}

/** Permanent skip for tests that cannot pass on this testnet by design (e.g. policy mismatch). */
export function skipPermanent(ctx: TestContext, reason: string): never {
  ctx.skip(true, `Permanent skip on testnet: ${reason}`);
  throw new Error("unreachable");
}

/** Skip when discovery did not find a wallet coin for deposit / transfer PTBs. */
export function skipUnlessWalletCoin(ctx: TestContext, fx: E2eFixtures): DiscoveredWalletCoin {
  const coin = fx.walletCoin;
  if (!coin) {
    ctx.skip(
      true,
      `No wallet coin discovered (settlement USD or MOCK_USDC). Discovery: ${fixtureSummary(fx)}`,
    );
    throw new Error("unreachable");
  }
  return coin;
}

/** @deprecated Prefer {@link skipUnlessWalletCoin} — returns object id for legacy callers. */
export function skipUnlessUsdCoin(ctx: TestContext, fx: E2eFixtures): string {
  return skipUnlessWalletCoin(ctx, fx).objectId;
}

/** Skip when discovery did not find an account with `hasData=true` (delegate / withdraw). */
export function skipUnlessAccountReady(ctx: TestContext, fx: E2eFixtures): void {
  if (!fx.accountReady) {
    ctx.skip(true, `No funded account (hasData=true) on testnet. Discovery: ${fixtureSummary(fx)}`);
  }
}

/** Skip unless discovery found a market (unresolved/resolved cursor or order/position market_id). */
export function skipUnlessMarket(ctx: TestContext, fx: E2eFixtures): void {
  if (fx.marketKey === undefined && fx.marketIdBytes === undefined) {
    ctx.skip(true, `No market discovered on testnet. Discovery: ${fixtureSummary(fx)}`);
  }
}

/** Human-readable fixture summary for assertion messages. */
export function fixtureSummary(fx: E2eFixtures): string {
  return JSON.stringify({
    accountId: fx.accountId,
    accountReady: fx.accountReady,
    orderId: fx.orderId?.toString() ?? null,
    positionId: fx.positionId?.toString() ?? null,
    openOrderId: fx.openOrderId?.toString() ?? null,
    openPositionId: fx.openPositionId?.toString() ?? null,
    pendingClosePositionId: fx.pendingClosePositionId?.toString() ?? null,
    claimablePositionId: fx.claimablePositionId?.toString() ?? null,
    expiredOpenOrderId: fx.expiredOpenOrderId?.toString() ?? null,
    expiredPendingClosePositionId: fx.expiredPendingClosePositionId?.toString() ?? null,
    marketKey: fx.marketKey?.toString() ?? null,
    openMarketIdHex: fx.openMarketIdHex ?? null,
    claimMarketIdHex: fx.claimMarketIdHex ?? null,
    usdCoinObjectId: fx.usdCoinObjectId ?? null,
    walletCoinSource: fx.walletCoin?.source ?? null,
    meta: fx.meta,
  });
}

/** Skip when the simulate sender for an account-scoped PTB cannot be resolved. */
export async function skipUnlessAccountOwner(
  ctx: TestContext,
  client: PredictClient,
  fx: E2eFixtures,
): Promise<string> {
  const owner = await tryResolveAccountOwner(client, fx.accountId);
  if (!owner) {
    ctx.skip(
      true,
      `Could not resolve simulate sender for accountId ${fx.accountId}. Discovery: ${fixtureSummary(fx)}`,
    );
    return "";
  }
  return owner;
}

/** Binds discovery context into skip helpers for a test file. */
export function fixtureGuards(fx: E2eFixtures, client?: PredictClient) {
  return {
    skipUnlessDefined<T>(
      ctx: TestContext,
      value: T | undefined,
      label: string,
    ): asserts value is T {
      skipUnlessDefined(ctx, value, label, fx);
    },
    skipFixableBySeed(
      ctx: TestContext,
      label: string,
      hint: { preset?: string; stage?: string },
    ): never {
      return skipFixableBySeed(ctx, label, hint, fx);
    },
    skipPermanent(ctx: TestContext, reason: string): never {
      return skipPermanent(ctx, reason);
    },
    skipUnlessMarket(ctx: TestContext): void {
      skipUnlessMarket(ctx, fx);
    },
    skipUnlessAccountReady(ctx: TestContext): void {
      skipUnlessAccountReady(ctx, fx);
    },
    skipUnlessWalletCoin(ctx: TestContext) {
      return skipUnlessWalletCoin(ctx, fx);
    },
    skipUnlessUsdCoin(ctx: TestContext): string {
      return skipUnlessUsdCoin(ctx, fx);
    },
    async skipUnlessAccountOwner(ctx: TestContext): Promise<string> {
      if (!client) {
        ctx.skip(true, "PredictClient not available for account owner resolution.");
      }
      return skipUnlessAccountOwner(ctx, client!, fx);
    },
  };
}

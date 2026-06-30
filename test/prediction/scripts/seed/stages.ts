import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { createAccount } from "~predict/account.ts";
import {
  addKeeper,
  adminWithdraw,
  depositSettlement,
  pauseMarket,
  removeKeeper,
  setMinReserve,
  setOrderCancelCooldownMs,
  unpauseMarket,
} from "~predict/admin.ts";
import type { PredictClient } from "~predict/client.ts";
import {
  getAccountData,
  getAccountIds,
  getMarketById,
  getOrderCursor,
  getPosition,
  getPositionCursor,
  getRegistry,
} from "~predict/fetch.ts";
import {
  cancelClose,
  cancelOrder,
  confirmClose,
  fillOrder,
  forceClaim,
  placeOrder,
  requestClose,
  resolveMarket,
  selfCancelClose,
  selfCancelOrder,
} from "~predict/prediction.ts";

import { PTB_DUMMY } from "../../fixtures/ptb-params.ts";
import {
  appendPsmDeposit,
  appendWalletUsdDeposit,
  listBestWalletCoin,
  planAccountFunding,
  resolveMockUsdcCoinType,
  resolveOwnerRegistryAccountId,
} from "../../helpers/account-funding.ts";
import { getChainOrderView } from "../../helpers/chain-order-view.ts";
import {
  assertSuccessfulExecution,
  registryAccountIdFromAccountCreated,
  transactionDigest,
} from "../../helpers/tx-result.ts";
import type { SeedContext } from "./context.ts";
import type { SeedFixture } from "./fixture.ts";

/** Stable market id (utf-8 bytes) for tests that need a forever-unresolved market. */
export const E2E_OPEN_MARKET_LABEL = "pred-e2e-open-v1";
/** Stable market id for tests that need a resolved market with a claimable position. */
export const E2E_CLAIM_MARKET_LABEL = "pred-e2e-claim-v1";

function labelToHex(label: string): string {
  return `0x${Buffer.from(label, "utf8").toString("hex")}`;
}
function labelToBytes(label: string): Uint8Array {
  return new Uint8Array(Buffer.from(label, "utf8"));
}

const FAR_FUTURE = 9_999_999_999_999n;
/** 100% cap — required so keeper can fill 1 share @ 1 base-unit cost (fill_order abort 20 at 9000 bps). */
const SEED_FILLABLE_PRICE_CAP_BPS = 10_000n;
const SEED_MIN_FILL = { filledShares: 1n, filledCost: 1n } as const;

async function executeTx(
  client: PredictClient,
  signer: Ed25519Keypair,
  build: (tx: Transaction) => void,
  label: string,
  log: SeedContext["log"],
): Promise<unknown> {
  const tx = new Transaction();
  tx.setSender(signer.toSuiAddress());
  build(tx);
  log(`signing: ${label}`);
  const result = await client.signAndExecuteTransaction({
    signer,
    transaction: tx,
    include: { effects: true, objectTypes: true, events: true },
  });
  assertSuccessfulExecution(result);
  const digest = transactionDigest(result);
  if (typeof digest === "string" && digest.length > 0) {
    await client.waitForTransaction(digest);
    log(`confirmed: ${label}`, digest);
    return await client.grpcClient.getTransaction({
      digest,
      include: { events: true },
    });
  }
  return result;
}

async function inferNextId(
  before: { back: bigint | null; front: bigint | null },
  after: { back: bigint | null; front: bigint | null },
): Promise<bigint | undefined> {
  if (after.back != null) return after.back;
  const prevBack = before.back ?? undefined;
  if (prevBack !== undefined) return prevBack + 1n;
  return after.front ?? undefined;
}

async function scanAccountPositions(
  client: PredictClient,
  accountId: string,
): Promise<
  { id: bigint; status: "OPEN" | "PENDING_CLOSE"; marketIdHex: string; selection: "YES" | "NO" }[]
> {
  const cursor = await getPositionCursor(client);
  if (cursor.count === 0n || cursor.front == null) return [];
  const out: {
    id: bigint;
    status: "OPEN" | "PENDING_CLOSE";
    marketIdHex: string;
    selection: "YES" | "NO";
  }[] = [];
  const back = cursor.back ?? cursor.front;
  for (let id = cursor.front; id <= back; id += 1n) {
    try {
      const p = await getPosition(client, { positionId: id });
      if (p.accountId === accountId) {
        out.push({
          id: p.positionId,
          status: p.status,
          marketIdHex: p.marketIdHex,
          selection: p.selection,
        });
      }
    } catch {
      /* gap or stale id */
    }
  }
  return out;
}

async function scanAccountOpenOrders(
  client: PredictClient,
  accountId: string,
): Promise<{ id: bigint; marketIdHex: string }[]> {
  const cursor = await getOrderCursor(client);
  if (cursor.count === 0n || cursor.front == null) return [];
  const out: { id: bigint; marketIdHex: string }[] = [];
  const back = cursor.back ?? cursor.front;
  for (let id = cursor.front; id <= back; id += 1n) {
    try {
      const o = await getChainOrderView(client, { orderId: id });
      if (o.accountId === accountId && o.kind === "OPEN") {
        out.push({ id: o.orderId, marketIdHex: o.marketIdHex });
      }
    } catch {
      /* consumed */
    }
  }
  return out;
}

// ---- Stage implementations ----------------------------------------------------

/** Ensure owner has at least one registry account; reuse if so. */
export async function stageAccount(ctx: SeedContext): Promise<void> {
  const preferred = ctx.fixture.accountId;
  const existing = await resolveOwnerRegistryAccountId(ctx.client, ctx.ownerAddress, preferred);
  if (existing) {
    if (preferred && preferred.toLowerCase() !== existing.toLowerCase()) {
      ctx.log("stage account", `reuse ${existing} (fixture id stale: ${preferred})`);
    } else {
      ctx.log("stage account", `reuse ${existing}`);
    }
    ctx.setFixture({ accountId: existing });
    return;
  }
  if (ctx.dryRun) {
    ctx.log("stage account", "would createAccount (dry-run)");
    return;
  }
  const alias = `seed-${Date.now()}`;
  const result = await executeTx(
    ctx.client,
    ctx.owner,
    (tx) => createAccount(ctx.client, tx, { alias }),
    "createAccount",
    ctx.log,
  );
  const accountId = registryAccountIdFromAccountCreated(
    result,
    ctx.client.waterxAccountPackageId(),
  );
  if (!accountId)
    throw new Error("createAccount: could not resolve registry account id from events");
  ctx.setFixture({ accountId });
  ctx.log("stage account", `created ${accountId}`);
}

/** Ensure the account can pay for orders (wallet USD deposit or MOCK_USDC PSM if needed). */
export async function stageDeposit(ctx: SeedContext): Promise<void> {
  const accountId = ctx.fixture.accountId;
  if (!accountId) throw new Error("stageDeposit: accountId not set — run 'account' stage first");

  const plan = await planAccountFunding(ctx.client, ctx.ownerAddress, ctx.depositAmount, {
    accountId,
  });
  if (plan === "skipped") {
    ctx.log("stage deposit", "skip (account.hasData=true)");
    return;
  }
  if (ctx.dryRun) {
    if (plan === "wallet-usd") {
      ctx.log("stage deposit", `would deposit ${ctx.depositAmount} USD from wallet (dry-run)`);
    } else if (plan === "psm-mock-usdc") {
      ctx.log("stage deposit", `would PSM ${ctx.depositAmount} MOCK_USDC → account USD (dry-run)`);
    } else {
      ctx.log(
        "stage deposit",
        `would fail — need wallet USD or MOCK_USDC (≥ ${ctx.depositAmount} base units)`,
      );
    }
    return;
  }
  if (plan === "needed") {
    throw new Error(
      `stageDeposit: wallet ${ctx.ownerAddress} has neither settlement USD nor enough MOCK_USDC ` +
        `for PSM (need ≥ ${ctx.depositAmount} base units)`,
    );
  }

  const label = plan === "psm-mock-usdc" ? "PSM mint (MOCK_USDC → account USD)" : "deposit";
  if (plan === "wallet-usd") {
    const usd = await listBestWalletCoin(
      ctx.client,
      ctx.ownerAddress,
      ctx.client.settlementCoinType(),
      ctx.depositAmount,
    );
    if (!usd) {
      throw new Error(`No settlement coin in wallet ${ctx.ownerAddress}`);
    }
    await executeTx(
      ctx.client,
      ctx.owner,
      (tx) => {
        appendWalletUsdDeposit(ctx.client, tx, {
          accountId,
          usdCoinId: usd.objectId,
          amount: ctx.depositAmount,
        });
      },
      label,
      ctx.log,
    );
  } else {
    const mockUsdcType = resolveMockUsdcCoinType(ctx.client);
    if (!mockUsdcType) throw new Error("MOCK_USDC not configured in waterx-config");
    const mock = await listBestWalletCoin(
      ctx.client,
      ctx.ownerAddress,
      mockUsdcType,
      ctx.depositAmount,
    );
    if (!mock) {
      throw new Error(`Insufficient MOCK_USDC in wallet ${ctx.ownerAddress}`);
    }
    await executeTx(
      ctx.client,
      ctx.owner,
      (tx) => {
        appendPsmDeposit(ctx.client, tx, {
          accountId,
          mockUsdcCoinId: mock.objectId,
          amount: ctx.depositAmount,
        });
      },
      label,
      ctx.log,
    );
  }
  ctx.log("stage deposit", `${ctx.depositAmount} base units via ${label}`);
}

/**
 * Ensure there is at least one OPEN (unfilled) order owned by the account on the e2e-open market.
 * Re-uses an existing open order on the configured market if one is found.
 */
export async function stagePlaceOpen(ctx: SeedContext): Promise<void> {
  const accountId = ctx.fixture.accountId;
  if (!accountId) throw new Error("stagePlaceOpen: accountId not set");
  const marketHex = ctx.fixture.openMarketIdHex ?? labelToHex(E2E_OPEN_MARKET_LABEL);

  const accountOpenOrders = await scanAccountOpenOrders(ctx.client, accountId);
  const sameMarket = accountOpenOrders.find((o) => o.marketIdHex === marketHex);
  if (sameMarket) {
    ctx.log("stage place-open", `reuse orderId=${sameMarket.id} on ${marketHex}`);
    ctx.setFixture({ openMarketIdHex: marketHex, openOrderId: sameMarket.id.toString() });
    return;
  }
  if (ctx.dryRun) {
    ctx.log("stage place-open", `would placeOrder on ${marketHex} (dry-run)`);
    return;
  }
  const before = await getOrderCursor(ctx.client);
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) => {
      placeOrder(ctx.client, tx, {
        accountId,
        marketId: labelToBytes(E2E_OPEN_MARKET_LABEL),
        selection: "YES",
        maxSpend: 1_000n,
        minShares: 1n,
        priceCapBps: SEED_FILLABLE_PRICE_CAP_BPS,
        expiryTs: FAR_FUTURE,
      });
    },
    "placeOrder (open)",
    ctx.log,
  );
  const after = await getOrderCursor(ctx.client);
  const orderId = await inferNextId(before, after);
  if (orderId === undefined) throw new Error("stagePlaceOpen: could not infer orderId from cursor");
  ctx.setFixture({ openMarketIdHex: marketHex, openOrderId: orderId.toString() });
  ctx.log("stage place-open", `orderId=${orderId} on ${marketHex}`);
}

/**
 * Ensure the account has at least one OPEN position. Places + fills a fresh order on the e2e-open
 * market (keeper key required). The previously-seeded `openOrderId` is intentionally left untouched.
 */
export async function stageFill(ctx: SeedContext): Promise<void> {
  const accountId = ctx.fixture.accountId;
  if (!accountId) throw new Error("stageFill: accountId not set");
  if (!ctx.keeper) {
    ctx.log("stage fill", "skip — no keeper key (E2E_KEEPER_PRIVATE_KEY) registered");
    return;
  }
  const positions = await scanAccountPositions(ctx.client, accountId);
  const existingOpen = positions.find((p) => p.status === "OPEN");
  if (existingOpen) {
    ctx.log("stage fill", `reuse openPositionId=${existingOpen.id}`);
    ctx.setFixture({ openPositionId: existingOpen.id.toString() });
    return;
  }
  if (ctx.dryRun) {
    ctx.log("stage fill", "would placeOrder + fillOrder (dry-run)");
    return;
  }
  const beforeOrder = await getOrderCursor(ctx.client);
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) => {
      placeOrder(ctx.client, tx, {
        accountId,
        marketId: labelToBytes(E2E_OPEN_MARKET_LABEL),
        selection: "YES",
        maxSpend: 1_000n,
        minShares: 1n,
        priceCapBps: SEED_FILLABLE_PRICE_CAP_BPS,
        expiryTs: FAR_FUTURE,
      });
    },
    "placeOrder (to-be-filled)",
    ctx.log,
  );
  const afterOrder = await getOrderCursor(ctx.client);
  const orderId = await inferNextId(beforeOrder, afterOrder);
  if (orderId === undefined) throw new Error("stageFill: could not infer orderId from cursor");

  const beforePos = await getPositionCursor(ctx.client);
  await executeTx(
    ctx.client,
    ctx.keeper,
    (tx) => fillOrder(ctx.client, tx, { orderId, ...SEED_MIN_FILL }),
    "fillOrder",
    ctx.log,
  );
  const afterPos = await getPositionCursor(ctx.client);
  const positionId = await inferNextId(beforePos, afterPos);
  if (positionId === undefined)
    throw new Error("stageFill: could not infer positionId from cursor");
  ctx.setFixture({
    openMarketIdHex: ctx.fixture.openMarketIdHex ?? labelToHex(E2E_OPEN_MARKET_LABEL),
    openPositionId: positionId.toString(),
  });
  ctx.log("stage fill", `openPositionId=${positionId}`);
}

/**
 * Ensure the account has at least one PENDING_CLOSE position. If none exists, create a fresh
 * position (place + fill) and then `requestClose` on it. Keeper key is required only when no
 * existing OPEN position is available for the close transition.
 */
export async function stageRequestClose(ctx: SeedContext): Promise<void> {
  const accountId = ctx.fixture.accountId;
  if (!accountId) throw new Error("stageRequestClose: accountId not set");

  const positions = await scanAccountPositions(ctx.client, accountId);
  const existingPending = positions.find((p) => p.status === "PENDING_CLOSE");
  if (existingPending) {
    ctx.log("stage request-close", `reuse pendingClosePositionId=${existingPending.id}`);
    ctx.setFixture({ pendingClosePositionId: existingPending.id.toString() });
    return;
  }

  let openPosition = positions.find(
    (p) => p.status === "OPEN" && p.id.toString() !== ctx.fixture.openPositionId,
  );
  // If only the "permanent OPEN" position exists, we still need a separate position to close.
  if (!openPosition) {
    if (!ctx.keeper) {
      ctx.log(
        "stage request-close",
        "skip — no spare OPEN position and no keeper key to create one",
      );
      return;
    }
    if (ctx.dryRun) {
      ctx.log("stage request-close", "would place+fill+requestClose (dry-run)");
      return;
    }
    const beforeOrder = await getOrderCursor(ctx.client);
    await executeTx(
      ctx.client,
      ctx.owner,
      (tx) => {
        placeOrder(ctx.client, tx, {
          accountId,
          marketId: labelToBytes(E2E_OPEN_MARKET_LABEL),
          selection: "YES",
          maxSpend: 1_000n,
          minShares: 1n,
          priceCapBps: SEED_FILLABLE_PRICE_CAP_BPS,
          expiryTs: FAR_FUTURE,
        });
      },
      "placeOrder (for requestClose)",
      ctx.log,
    );
    const afterOrder = await getOrderCursor(ctx.client);
    const orderId = await inferNextId(beforeOrder, afterOrder);
    if (orderId === undefined) throw new Error("stageRequestClose: could not infer orderId");
    const beforePos = await getPositionCursor(ctx.client);
    await executeTx(
      ctx.client,
      ctx.keeper,
      (tx) => fillOrder(ctx.client, tx, { orderId, ...SEED_MIN_FILL }),
      "fillOrder (for requestClose)",
      ctx.log,
    );
    const afterPos = await getPositionCursor(ctx.client);
    const positionId = await inferNextId(beforePos, afterPos);
    if (positionId === undefined) throw new Error("stageRequestClose: could not infer positionId");
    openPosition = {
      id: positionId,
      status: "OPEN",
      marketIdHex: labelToHex(E2E_OPEN_MARKET_LABEL),
      selection: "YES",
    };
  }

  if (ctx.dryRun) {
    ctx.log("stage request-close", `would requestClose on positionId=${openPosition.id} (dry-run)`);
    return;
  }
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) =>
      requestClose(ctx.client, tx, {
        positionId: openPosition!.id,
        minProceeds: 1n,
        expiryTs: FAR_FUTURE,
      }),
    "requestClose",
    ctx.log,
  );
  ctx.setFixture({ pendingClosePositionId: openPosition.id.toString() });
  ctx.log("stage request-close", `pendingClosePositionId=${openPosition.id}`);
}

/**
 * Ensure there is a resolved market with a claimable position owned by the account.
 * Creates a fresh position on `pred-e2e-claim-v1` via place+fill, then resolveMarket(YES).
 * Requires both owner key (for placeOrder) and keeper key (for fillOrder + resolveMarket).
 */
export async function stagePlaceAndResolve(ctx: SeedContext): Promise<void> {
  const accountId = ctx.fixture.accountId;
  if (!accountId) throw new Error("stagePlaceAndResolve: accountId not set");
  if (!ctx.keeper) {
    ctx.log("stage place-and-resolve", "skip — no keeper key");
    return;
  }
  const claimMarketHex = ctx.fixture.claimMarketIdHex ?? labelToHex(E2E_CLAIM_MARKET_LABEL);

  // Check if we already have a claimable position on this market.
  if (ctx.fixture.claimPositionId) {
    try {
      const pos = await getPosition(ctx.client, {
        positionId: BigInt(ctx.fixture.claimPositionId),
      });
      const market = await getMarketById(ctx.client, { marketId: pos.marketId });
      if (pos.accountId === accountId && market.resolved) {
        ctx.log(
          "stage place-and-resolve",
          `reuse claimPositionId=${pos.positionId} on resolved market`,
        );
        ctx.setFixture({
          claimMarketIdHex: claimMarketHex,
          claimMarketOutcome: market.outcome ?? undefined,
        });
        return;
      }
    } catch {
      /* stale, will rebuild */
    }
  }

  // Try to find an existing OPEN position on the claim market.
  const positions = await scanAccountPositions(ctx.client, accountId);
  let claimPos = positions.find((p) => p.marketIdHex === claimMarketHex && p.status === "OPEN");

  if (!claimPos) {
    if (ctx.dryRun) {
      ctx.log("stage place-and-resolve", "would place+fill on claim market (dry-run)");
      return;
    }
    const beforeOrder = await getOrderCursor(ctx.client);
    await executeTx(
      ctx.client,
      ctx.owner,
      (tx) => {
        placeOrder(ctx.client, tx, {
          accountId,
          marketId: labelToBytes(E2E_CLAIM_MARKET_LABEL),
          selection: "YES",
          maxSpend: 1_000n,
          minShares: 1n,
          priceCapBps: SEED_FILLABLE_PRICE_CAP_BPS,
          expiryTs: FAR_FUTURE,
        });
      },
      "placeOrder (claim market)",
      ctx.log,
    );
    const afterOrder = await getOrderCursor(ctx.client);
    const orderId = await inferNextId(beforeOrder, afterOrder);
    if (orderId === undefined) throw new Error("stagePlaceAndResolve: could not infer orderId");
    const beforePos = await getPositionCursor(ctx.client);
    await executeTx(
      ctx.client,
      ctx.keeper,
      (tx) => fillOrder(ctx.client, tx, { orderId, ...SEED_MIN_FILL }),
      "fillOrder (claim market)",
      ctx.log,
    );
    const afterPos = await getPositionCursor(ctx.client);
    const positionId = await inferNextId(beforePos, afterPos);
    if (positionId === undefined)
      throw new Error("stagePlaceAndResolve: could not infer positionId");
    claimPos = { id: positionId, status: "OPEN", marketIdHex: claimMarketHex, selection: "YES" };
  } else {
    ctx.log("stage place-and-resolve", `reuse OPEN claim position ${claimPos.id}`);
  }

  // Check whether the market is already resolved.
  let market = await getMarketById(ctx.client, { marketId: labelToBytes(E2E_CLAIM_MARKET_LABEL) });
  if (!market.resolved) {
    if (ctx.dryRun) {
      ctx.log("stage place-and-resolve", "would resolveMarket YES (dry-run)");
      return;
    }
    await executeTx(
      ctx.client,
      ctx.keeper,
      (tx) =>
        resolveMarket(ctx.client, tx, {
          marketId: labelToBytes(E2E_CLAIM_MARKET_LABEL),
          outcome: "YES",
        }),
      "resolveMarket (claim) YES",
      ctx.log,
    );
    market = await getMarketById(ctx.client, { marketId: labelToBytes(E2E_CLAIM_MARKET_LABEL) });
  } else {
    ctx.log("stage place-and-resolve", `claim market already resolved (outcome=${market.outcome})`);
  }

  ctx.setFixture({
    claimMarketIdHex: claimMarketHex,
    claimPositionId: claimPos.id.toString(),
    claimMarketOutcome: market.outcome ?? undefined,
  });
  ctx.log("stage place-and-resolve", `claimPositionId=${claimPos.id}, outcome=${market.outcome}`);
}

/**
 * Produces a "rescue" precondition for `selfCancelOrder` / `selfCancelClose`. Both Move
 * functions require `now >= self_cancel_after_ts` (cooldown, default 30s after place) AND
 * `now >= expiry_ts` (user-provided). We place with a 1s expiry, then sleep just over the
 * cooldown. Keeper key is required only for the close-rescue arm.
 */
export async function stageExpiredRescue(ctx: SeedContext): Promise<void> {
  const accountId = ctx.fixture.accountId;
  if (!accountId) throw new Error("stageExpiredRescue: accountId not set");

  const nowMs = BigInt(Date.now());
  const reg = await getRegistry(ctx.client);
  const cooldownMs = reg.orderCancelCooldownMs;
  // Cover both: a tiny expiry (+2s in case clock skew) AND past-cooldown wait.
  const expiryTs = nowMs + 2_000n;
  const sleepMs = Number(cooldownMs) + 3_000;

  // Re-use existing expired order if present.
  if (ctx.fixture.expiredOpenOrderId) {
    try {
      const o = await getChainOrderView(ctx.client, {
        orderId: BigInt(ctx.fixture.expiredOpenOrderId),
      });
      if (
        o.accountId === accountId &&
        o.kind === "OPEN" &&
        o.expiryTs < nowMs &&
        o.selfCancelAfterTs < nowMs
      ) {
        ctx.log("stage expired-rescue", `reuse expiredOpenOrderId=${o.orderId}`);
      } else {
        ctx.setFixture({ expiredOpenOrderId: undefined });
      }
    } catch {
      ctx.setFixture({ expiredOpenOrderId: undefined });
    }
  }

  const needOpen = !ctx.fixture.expiredOpenOrderId;
  let needClose = !ctx.fixture.expiredPendingClosePositionId;

  if (ctx.fixture.expiredPendingClosePositionId) {
    try {
      const p = await getPosition(ctx.client, {
        positionId: BigInt(ctx.fixture.expiredPendingClosePositionId),
      });
      if (
        p.accountId === accountId &&
        p.status === "PENDING_CLOSE" &&
        p.closeExpiryTs < nowMs &&
        p.closeSelfCancelAfterTs < nowMs
      ) {
        ctx.log("stage expired-rescue", `reuse expiredPendingClosePositionId=${p.positionId}`);
        needClose = false;
      } else {
        ctx.setFixture({ expiredPendingClosePositionId: undefined });
      }
    } catch {
      ctx.setFixture({ expiredPendingClosePositionId: undefined });
    }
  }
  if (!needOpen && !needClose) return;

  if (ctx.dryRun) {
    ctx.log("stage expired-rescue", `would place + sleep ${sleepMs}ms (dry-run)`);
    return;
  }

  // 1. Place a short-expiry open order for selfCancelOrder rescue.
  let placedOpenId: bigint | undefined;
  if (needOpen) {
    const before = await getOrderCursor(ctx.client);
    await executeTx(
      ctx.client,
      ctx.owner,
      (tx) => {
        placeOrder(ctx.client, tx, {
          accountId,
          marketId: labelToBytes(E2E_OPEN_MARKET_LABEL),
          selection: "YES",
          maxSpend: 1_000n,
          minShares: 1n,
          priceCapBps: SEED_FILLABLE_PRICE_CAP_BPS,
          expiryTs,
        });
      },
      "placeOrder (expired-rescue open)",
      ctx.log,
    );
    const after = await getOrderCursor(ctx.client);
    placedOpenId = (await inferNextId(before, after)) ?? undefined;
    if (placedOpenId === undefined)
      throw new Error("stageExpiredRescue: could not infer expiredOpenOrderId");
    ctx.log(
      "stage expired-rescue",
      `placed expiredOpenOrderId=${placedOpenId} (expires in 2s, cooldown ${cooldownMs}ms)`,
    );
  }

  // 2. Set up a position with PENDING_CLOSE whose close-order has short expiry.
  let pendingId: bigint | undefined;
  if (needClose) {
    if (!ctx.keeper) {
      ctx.log("stage expired-rescue", "skip close-rescue arm — no keeper key");
    } else {
      const beforeOrder = await getOrderCursor(ctx.client);
      await executeTx(
        ctx.client,
        ctx.owner,
        (tx) => {
          placeOrder(ctx.client, tx, {
            accountId,
            marketId: labelToBytes(E2E_OPEN_MARKET_LABEL),
            selection: "YES",
            maxSpend: 1_000n,
            minShares: 1n,
            priceCapBps: SEED_FILLABLE_PRICE_CAP_BPS,
            expiryTs: FAR_FUTURE, // open order stays open long enough to be filled
          });
        },
        "placeOrder (for expired close-rescue)",
        ctx.log,
      );
      const afterOrder = await getOrderCursor(ctx.client);
      const orderId = await inferNextId(beforeOrder, afterOrder);
      if (orderId === undefined) throw new Error("stageExpiredRescue: could not infer orderId");
      const beforePos = await getPositionCursor(ctx.client);
      await executeTx(
        ctx.client,
        ctx.keeper,
        (tx) => fillOrder(ctx.client, tx, { orderId, ...SEED_MIN_FILL }),
        "fillOrder (expired close-rescue)",
        ctx.log,
      );
      const afterPos = await getPositionCursor(ctx.client);
      pendingId = (await inferNextId(beforePos, afterPos)) ?? undefined;
      if (pendingId === undefined)
        throw new Error("stageExpiredRescue: could not infer positionId");
      // requestClose with short expiry.
      await executeTx(
        ctx.client,
        ctx.owner,
        (tx) =>
          requestClose(ctx.client, tx, {
            positionId: pendingId!,
            minProceeds: 1n,
            expiryTs: BigInt(Date.now()) + 2_000n,
          }),
        "requestClose (expired-rescue)",
        ctx.log,
      );
      ctx.log(
        "stage expired-rescue",
        `placed expiredPendingClosePositionId=${pendingId} (close expires in 2s)`,
      );
    }
  }

  // 3. Sleep through cooldown + expiry.
  if (placedOpenId !== undefined || pendingId !== undefined) {
    ctx.log("stage expired-rescue", `sleeping ${sleepMs}ms for cooldown + expiry…`);
    await new Promise((r) => setTimeout(r, sleepMs));
  }

  const patch: Partial<SeedFixture> = {};
  if (placedOpenId !== undefined) patch.expiredOpenOrderId = placedOpenId.toString();
  if (pendingId !== undefined) patch.expiredPendingClosePositionId = pendingId.toString();
  if (Object.keys(patch).length > 0) ctx.setFixture(patch);
}

// ---- Admin stages (require AdminCap holder == owner) -------------------------

async function ownerHoldsAdminCap(ctx: SeedContext, cap: string): Promise<boolean> {
  try {
    const res = await ctx.client.grpcClient.getObject({ objectId: cap });
    const owner = res.object?.owner;
    if (!owner) return false;
    if (owner.$kind === "AddressOwner") {
      return owner.AddressOwner.toLowerCase() === ctx.ownerAddress.toLowerCase();
    }
    return false;
  } catch {
    return false;
  }
}

function requirePredictionAdminCap(ctx: SeedContext): string {
  return ctx.client.predictionAdminCap();
}

/** Admin bump of `min_reserve` by +1 then back to original (round-trip, idempotent). */
export async function stageBumpMinReserve(ctx: SeedContext): Promise<void> {
  const cap = requirePredictionAdminCap(ctx);
  if (!(await ownerHoldsAdminCap(ctx, cap))) {
    ctx.log("stage min-reserve", "skip — owner is not the AdminCap holder");
    return;
  }
  const reg = await getRegistry(ctx.client);
  const original = reg.minReserve;
  const bumped = original + 1n;
  if (ctx.dryRun) {
    ctx.log(
      "stage min-reserve",
      `would setMinReserve ${original} → ${bumped} → ${original} (dry-run)`,
    );
    return;
  }
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) => setMinReserve(ctx.client, tx, { adminCap: cap, newReserve: bumped }),
    `setMinReserve (${original} → ${bumped})`,
    ctx.log,
  );
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) => setMinReserve(ctx.client, tx, { adminCap: cap, newReserve: original }),
    `setMinReserve (${bumped} → ${original})`,
    ctx.log,
  );
}

/** Admin bump of `order_cancel_cooldown_ms` (round-trip). */
export async function stageBumpCooldown(ctx: SeedContext): Promise<void> {
  const cap = requirePredictionAdminCap(ctx);
  if (!(await ownerHoldsAdminCap(ctx, cap))) {
    ctx.log("stage cooldown", "skip — owner is not the AdminCap holder");
    return;
  }
  const reg = await getRegistry(ctx.client);
  const original = reg.orderCancelCooldownMs;
  const bumped = original + 1n;
  if (ctx.dryRun) {
    ctx.log(
      "stage cooldown",
      `would setOrderCancelCooldownMs ${original} → ${bumped} → ${original} (dry-run)`,
    );
    return;
  }
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) => setOrderCancelCooldownMs(ctx.client, tx, { adminCap: cap, cooldownMs: bumped }),
    `setCooldown (${original} → ${bumped})`,
    ctx.log,
  );
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) => setOrderCancelCooldownMs(ctx.client, tx, { adminCap: cap, cooldownMs: original }),
    `setCooldown (${bumped} → ${original})`,
    ctx.log,
  );
}

/** Admin pause + unpause of `openMarketIdHex` (round-trip). */
export async function stagePauseRoundtrip(ctx: SeedContext): Promise<void> {
  const cap = requirePredictionAdminCap(ctx);
  if (!(await ownerHoldsAdminCap(ctx, cap))) {
    ctx.log("stage pause", "skip — owner is not the AdminCap holder");
    return;
  }
  if (ctx.dryRun) {
    ctx.log("stage pause", "would pause + unpause (dry-run)");
    return;
  }
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) =>
      pauseMarket(ctx.client, tx, { adminCap: cap, marketId: labelToBytes(E2E_OPEN_MARKET_LABEL) }),
    "pauseMarket",
    ctx.log,
  );
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) =>
      unpauseMarket(ctx.client, tx, {
        adminCap: cap,
        marketId: labelToBytes(E2E_OPEN_MARKET_LABEL),
      }),
    "unpauseMarket",
    ctx.log,
  );
}

/** Admin add + remove of a dummy keeper address (round-trip). */
export async function stageKeeperRoundtrip(ctx: SeedContext): Promise<void> {
  const cap = requirePredictionAdminCap(ctx);
  if (!(await ownerHoldsAdminCap(ctx, cap))) {
    ctx.log("stage keeper", "skip — owner is not the AdminCap holder");
    return;
  }
  if (ctx.dryRun) {
    ctx.log("stage keeper", "would addKeeper + removeKeeper (dry-run)");
    return;
  }
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) => addKeeper(ctx.client, tx, { adminCap: cap, keeper: PTB_DUMMY.delegate }),
    "addKeeper(dummy)",
    ctx.log,
  );
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) => removeKeeper(ctx.client, tx, { adminCap: cap, keeper: PTB_DUMMY.delegate }),
    "removeKeeper(dummy)",
    ctx.log,
  );
}

/** Admin depositSettlement + adminWithdraw (back to original balance). */
export async function stageTreasuryRoundtrip(ctx: SeedContext): Promise<void> {
  const cap = requirePredictionAdminCap(ctx);
  if (!(await ownerHoldsAdminCap(ctx, cap))) {
    ctx.log("stage treasury", "skip — owner is not the AdminCap holder");
    return;
  }
  if (ctx.dryRun) {
    ctx.log("stage treasury", "would depositSettlement + adminWithdraw (dry-run)");
    return;
  }
  const usd = await listBestWalletCoin(
    ctx.client,
    ctx.ownerAddress,
    ctx.client.settlementCoinType(),
    1n,
  );
  if (!usd) {
    throw new Error(`No settlement coin in wallet ${ctx.ownerAddress}`);
  }
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) => {
      const [pay] = tx.splitCoins(tx.object(usd.objectId), [1n]);
      depositSettlement(ctx.client, tx, { adminCap: cap, payment: pay });
    },
    "depositSettlement(1)",
    ctx.log,
  );
  await executeTx(
    ctx.client,
    ctx.owner,
    (tx) =>
      adminWithdraw(ctx.client, tx, {
        adminCap: cap,
        amount: 1n,
        recipient: ctx.ownerAddress,
      }),
    "adminWithdraw(1)",
    ctx.log,
  );
}

// ---- Stage registry ----------------------------------------------------------

export const STAGE_REGISTRY = {
  account: stageAccount,
  deposit: stageDeposit,
  "place-open": stagePlaceOpen,
  fill: stageFill,
  "request-close": stageRequestClose,
  "place-and-resolve": stagePlaceAndResolve,
  "expired-rescue": stageExpiredRescue,
  "min-reserve": stageBumpMinReserve,
  cooldown: stageBumpCooldown,
  pause: stagePauseRoundtrip,
  keeper: stageKeeperRoundtrip,
  treasury: stageTreasuryRoundtrip,
} as const;

export type StageName = keyof typeof STAGE_REGISTRY;

export const PRESETS: Record<string, StageName[]> = {
  /** Minimum state to make E2E discovery happy: account + 1 OPEN order + 1 OPEN position + 1 PENDING_CLOSE position. */
  baseline: ["account", "deposit", "place-open", "fill", "request-close"],
  /** Adds a resolved market with a claimable position (covers `claim` E2E). */
  "with-claim": ["account", "deposit", "place-open", "fill", "request-close", "place-and-resolve"],
  /**
   * Adds rescue-path preconditions (expired orders) so `selfCancelOrder` / `selfCancelClose`
   * E2E tests can succeed. Adds ~33s wall-time per seed run for the cooldown sleep.
   */
  "with-rescue": [
    "account",
    "deposit",
    "place-open",
    "fill",
    "request-close",
    "place-and-resolve",
    "expired-rescue",
  ],
  /** Everything an owner+keeper can do without admin rights. */
  full: [
    "account",
    "deposit",
    "place-open",
    "fill",
    "request-close",
    "place-and-resolve",
    "expired-rescue",
  ],
  /** Admin round-trips (requires owner to hold AdminCap). */
  admin: ["min-reserve", "cooldown", "pause", "keeper", "treasury"],
};

/** Resolve a comma-separated stage list or a single preset name to an ordered stage array. */
export function resolveStages(input: string): StageName[] {
  const trimmed = input.trim();
  if (trimmed in PRESETS) return PRESETS[trimmed]!;
  const names = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const name of names) {
    if (!(name in STAGE_REGISTRY)) {
      throw new Error(
        `Unknown seed stage "${name}". Known stages: ${Object.keys(STAGE_REGISTRY).join(", ")}. ` +
          `Or use a preset: ${Object.keys(PRESETS).join(", ")}.`,
      );
    }
  }
  return names as StageName[];
}

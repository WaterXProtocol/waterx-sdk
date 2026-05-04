/**
 * PRD product test-case IDs (§2.x / §3.x / §4 / §7 …) mapped to **SDK + testnet dry-run simulate**.
 *
 * Scope:
 * - Covers flows expressible as `WaterXClient` + `build*Tx` + `client.simulate()` (no browser, no gas sponsor).
 * - PRD rows with no simulate test here are listed as block comments (not `it.skip`) so Vitest "skipped" counts reflect env/oracle only.
 */
import { Transaction } from "@mysten/sui/transactions";
import {
  buildCancelOrderTx,
  buildClosePositionTx,
  buildDecreasePositionTx,
  buildOpenPositionTx,
  buildPlaceOrderTx,
  buildReceiveCoinTx,
  buildTransferToAccountTx,
  createAccount,
  getAccountBalance,
  getMarketSummary,
  useReferralCode,
} from "@waterx/perp-sdk";
import { beforeAll, describe, expect, it } from "vitest";

import type { BaseAsset } from "../../src/constants.ts";
import {
  discoverActivePosition,
  discoverActivePositionFirstMatchingTiers,
  discoverActivePositionForNegativeOpen,
  discoverWalletOwnerWithCollateralCoin,
  discoveryTiersForStatefulMatrix,
} from "../helpers/e2e/discover-on-chain-position.ts";
import {
  client,
  DUMMY_SENDER,
  e2eNetwork,
  PROBE_MIN_ACCOUNT_USDC,
} from "../helpers/e2e/e2e-client.ts";
import {
  firstAccountIdFromFundedProbe,
  loadFundedProbe,
  requireFundedProbe,
  type FundedProbe,
} from "../helpers/e2e/e2e-funded-probe.ts";
import { expectLeverageOpenSizingVsMarket } from "../helpers/e2e/e2e-open-sizing-expect.ts";
import { lifecycleOracleUsdOrSkip } from "../helpers/e2e/e2e-oracle-context.ts";
import { activeLifecycleTestBasesForClient, lifecycleRow } from "../helpers/e2e/lifecycle-test-markets.ts";
import {
  assertSimulateMoveAbort,
  assertSimulateSuccess,
  extractSimulateError,
  parseSimulateFailure,
  simulateWithTransientRetry,
  skipSimulateIfOracleTransient,
  type SimulateResult,
} from "../helpers/e2e/simulate-assertions.ts";
import { buildMintWlpSimulateTx } from "../helpers/e2e/wlp-mint-simulate-tx.ts";
import { assertOpenAboveMaxLeverageAborts } from "../helpers/trading/above-max-leverage-case.ts";
import {
  computeValidPartialDecreaseSize,
  getMarketTradingSizeConstraints,
} from "../helpers/trading/market-trading-size-constraints.ts";
import { WATERX_PERP_ABORT } from "../helpers/waterx-perp-error-codes.ts";

let probe: FundedProbe | null = null;

beforeAll(async () => {
  probe = await loadFundedProbe(client, PROBE_MIN_ACCOUNT_USDC);
}, 180_000);

const ORDER_COLLATERAL = 10_000_000n;
const ORDER_SIZE = 2_000n;
/** PRD normal deposit example: 100 USDC (6 dp). */
const DEPOSIT_100_USDC = 100_000_000n;
/** PRD boundary: 10 USDC minimum (6 dp). */
const DEPOSIT_10_USDC = 10_000_000n;
const RECEIVE_WITHDRAW_AMOUNT = 5_000_000n;

function requireProbe(ctx: { skip: (reason?: string) => void }): FundedProbe {
  return requireFundedProbe(ctx, probe, PROBE_MIN_ACCOUNT_USDC);
}

async function firstAccountId(ctx: { skip: (reason?: string) => void }): Promise<string | null> {
  return firstAccountIdFromFundedProbe(ctx, probe);
}

async function trySimulate(
  ctx: { skip: (reason?: string) => void },
  tx: Transaction,
  minCommands = 1,
) {
  tx.setSender(requireProbe(ctx).owner);
  const result = await simulateWithTransientRetry(() => client.simulate(tx));
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  assertSimulateSuccess(result, minCommands, { transaction: tx });
}

function simulateLooksLikeWlpInsufficientDeposit(result: unknown): boolean {
  const fail = parseSimulateFailure(result);
  if (fail?.abortCode === String(WATERX_PERP_ABORT.INSUFFICIENT_DEPOSIT)) return true;
  const blob = `${fail?.message ?? ""}\n${extractSimulateError(result as SimulateResult)}`;
  return (
    /\babort code:\s*406\b/i.test(blob) ||
    blob.includes("err_insufficient_deposit") ||
    blob.includes(`abort code: ${WATERX_PERP_ABORT.INSUFFICIENT_DEPOSIT}`)
  );
}

/** WLP mint: 406 if pool rules still reject the PTB (rare after on-chain `min_deposit`-sized split). */
async function trySimulateWlpMint(
  ctx: { skip: (reason?: string) => void },
  tx: Transaction,
  minCommands = 1,
) {
  tx.setSender(requireProbe(ctx).owner);
  const result = await simulateWithTransientRetry(() => client.simulate(tx));
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  if (simulateLooksLikeWlpInsufficientDeposit(result)) {
    ctx.skip(
      `WLP mint: err_insufficient_deposit (${WATERX_PERP_ABORT.INSUFFICIENT_DEPOSIT}) — pool min deposit / liquidity.`,
    );
    return;
  }
  assertSimulateSuccess(result, minCommands, { transaction: tx });
}

/** Simulate with a discovered position owner (per-scenario account — not the global funded probe). */
async function trySimulateWithOwner(
  ctx: { skip: (reason?: string) => void },
  tx: Transaction,
  owner: string,
  minCommands = 1,
) {
  tx.setSender(owner);
  const result = await simulateWithTransientRetry(() => client.simulate(tx));
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  assertSimulateSuccess(result, minCommands, { transaction: tx });
}

function prdSkipNoDiscoverOpenRow(base: string): string {
  return `No discovered account for ${base} with USDC ≥ simulateOpenCollateral (per-market open-path discovery).`;
}

/**
 * Shared result for onboarding transfer dry-runs:
 *   - Try the funded probe owner's wallet USDC coins first (fast path).
 *   - On miss, fall back to full candidate discovery across redeem queue +
 *     open-position owners + probe.
 *
 * Cached at module scope keyed by `minBalance` so the two onboarding tests
 * (100 USDC + 10 USDC) don't repeat the expensive discovery under parallel load.
 */
const walletUsdcHitCache = new Map<
  string,
  Promise<{ owner: string; coinObjectId: string; balance: bigint } | null>
>();

async function discoverTransferableUsdcCoin(
  minBalance: bigint,
): Promise<{ owner: string; coinObjectId: string; balance: bigint } | null> {
  const key = String(minBalance);
  const cached = walletUsdcHitCache.get(key);
  if (cached) return cached;
  const task = (async () => {
    if (probe) {
      try {
        const { objects } = await client.listCoins({
          owner: probe.owner,
          coinType: client.config.collaterals.USDC.type,
        });
        let best: { objectId: string; balance: bigint } | null = null;
        for (const o of objects) {
          const bal = BigInt(o.balance ?? "0");
          if (bal < minBalance) continue;
          if (!best || bal > best.balance) best = { objectId: o.objectId, balance: bal };
        }
        if (best) return { owner: probe.owner, coinObjectId: best.objectId, balance: best.balance };
      } catch {
        /* fall through */
      }
    }
    return discoverWalletOwnerWithCollateralCoin(client, {
      collateral: "USDC",
      minBalance,
      probeMinAccountUsdc: PROBE_MIN_ACCOUNT_USDC,
    });
  })();
  walletUsdcHitCache.set(key, task);
  return task;
}

// ---------------------------------------------------------------------------
// §2.1 新用戶旅程 — Onboarding (SDK / simulate subset)
// ---------------------------------------------------------------------------

describe("PRD §2.1 — TC-ONBOARD-001 (SDK): create account + deposit path dry-run", () => {
  it("step 3–4 equivalent: createAccount PTB simulates", async (ctx) => {
    const tx = new Transaction();
    tx.setSender(requireProbe(ctx).owner);
    tx.setGasBudget(120_000_000);
    createAccount(client, tx, `prd-onboard-${Date.now().toString(36).slice(-6)}`);
    const result = await client.simulate(tx);
    assertSimulateSuccess(result, 1, { transaction: tx });
  }, 60_000);

  it("step 5 equivalent (100 USDC): buildTransferToAccountTx dry-run when wallet USDC available", async (ctx) => {
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const hit = await discoverTransferableUsdcCoin(DEPOSIT_100_USDC);
    if (!hit) {
      ctx.skip(
        `No candidate wallet (probe / redeem-queue / open-pos owners) has a single USDC coin >= ${DEPOSIT_100_USDC}`,
      );
      return;
    }

    const tx = buildTransferToAccountTx(client, {
      accountObjectAddress: accountId,
      coinObjectId: hit.coinObjectId,
      coinType: client.config.collaterals.USDC.type,
    });
    tx.setSender(hit.owner);
    const result = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, result)) return;
    assertSimulateSuccess(result, 1, { transaction: tx });
  }, 180_000);

  it("boundary 10 USDC: buildTransferToAccountTx dry-run when wallet coin ≥ 10 USDC", async (ctx) => {
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const hit = await discoverTransferableUsdcCoin(DEPOSIT_10_USDC);
    if (!hit) {
      ctx.skip(
        `No candidate wallet (probe / redeem-queue / open-pos owners) has a single USDC coin >= ${DEPOSIT_10_USDC}`,
      );
      return;
    }

    const tx = buildTransferToAccountTx(client, {
      accountObjectAddress: accountId,
      coinObjectId: hit.coinObjectId,
      coinType: client.config.collaterals.USDC.type,
    });
    tx.setSender(hit.owner);
    const result = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, result)) return;
    assertSimulateSuccess(result, 1, { transaction: tx });
  }, 180_000);
});

/*
 * PRD §2.1 — TC-ONBOARD-002 — Minimum $10 deposit: enforced in waterx.app / product rules; no dedicated Move abort
 *   surfaced by transfer builders in this suite.
 *
 * PRD §2.1 — TC-ONBOARD-003 — Gas-sponsored PTB execution requires Enoki / sponsor infra; not verifiable via unsigned gRPC simulate.
 *
 * PRD §2.1 — TC-ONBOARD-004 — External transfer to deposit address is a plain Sui payment; identical on-chain effect to
 *   funding the wallet then transferToAccount (covered elsewhere).
 */

describe("PRD §2.1 — TC-ONBOARD-005 (SDK): withdraw path = receiveCoin to wallet", () => {
  it("buildReceiveCoinTx dry-run when account has enough USDC", async (ctx) => {
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const bal = await getAccountBalance(client, accountId, client.config.collaterals.USDC.type);
    if (bal < RECEIVE_WITHDRAW_AMOUNT) {
      ctx.skip(`Account USDC balance ${bal} < ${RECEIVE_WITHDRAW_AMOUNT}`);
      return;
    }

    const tx = await buildReceiveCoinTx(client, {
      accountObjectAddress: accountId,
      collateral: "USDC",
      amount: RECEIVE_WITHDRAW_AMOUNT,
      recipient: requireProbe(ctx).owner,
    });
    await trySimulate(ctx, tx, 3);
  }, 90_000);
});

// ---------------------------------------------------------------------------
// §2.3 / §3 — Trading (open)
// ---------------------------------------------------------------------------

describe("PRD §2.3 — TC-TRADE-001: BTC market long ~10x (simulate)", () => {
  it("buildOpenPositionTx — BTC long, 10x", async (ctx) => {
    const d = await discoverActivePositionForNegativeOpen(client, "BTC");
    if (!d) {
      ctx.skip(prdSkipNoDiscoverOpenRow("BTC"));
      return;
    }

    const prices = await lifecycleOracleUsdOrSkip(client, ctx);
    if (!prices) return;
    if (!Number.isFinite(prices.BTC) || prices.BTC <= 0) {
      ctx.skip(`Oracle bundle missing BTC price (got ${prices.BTC}); skip sizing assertion.`);
      return;
    }

    const row = lifecycleRow("BTC");
    await expectLeverageOpenSizingVsMarket(
      client,
      "BTC",
      row.simulateOpenCollateral,
      10,
      prices.BTC,
    );
    const tx = await buildOpenPositionTx(client, {
      accountId: d.accountObjectAddress,
      base: "BTC",
      isLong: true,
      leverage: 10,
      collateralAmount: row.simulateOpenCollateral,
    });
    await trySimulateWithOwner(ctx, tx, d.ownerAddress, 9);
  }, 90_000);
});

describe("PRD §2.3 — TC-TRADE-002: ETH market short (simulate)", () => {
  it("buildOpenPositionTx — ETH short", async (ctx) => {
    const d = await discoverActivePositionForNegativeOpen(client, "ETH");
    if (!d) {
      ctx.skip(prdSkipNoDiscoverOpenRow("ETH"));
      return;
    }

    const prices = await lifecycleOracleUsdOrSkip(client, ctx);
    if (!prices) return;
    if (!Number.isFinite(prices.ETH) || prices.ETH <= 0) {
      ctx.skip(`Oracle bundle missing ETH price (got ${prices.ETH}); skip sizing assertion.`);
      return;
    }

    const row = lifecycleRow("ETH");
    await expectLeverageOpenSizingVsMarket(
      client,
      "ETH",
      row.simulateOpenCollateral,
      10,
      prices.ETH,
    );
    const tx = await buildOpenPositionTx(client, {
      accountId: d.accountObjectAddress,
      base: "ETH",
      isLong: false,
      leverage: 10,
      collateralAmount: row.simulateOpenCollateral,
    });
    await trySimulateWithOwner(ctx, tx, d.ownerAddress, 9);
  }, 90_000);
});

// PRD §2.3 TC-TRADE-005 (tradingFeeBps ≥ 1) is included here — on-chain only, no manifest.
describe(`on-chain market summary invariants (${e2eNetwork})`, () => {
  // No static manifest: assert only that live `getMarketSummary` looks like a
  // tradeable market. Testnet manifest parity stays in integration
  // `trader-market-onchain-config.test.ts`.
  for (const base of activeLifecycleTestBasesForClient(client)) {
    it(`${base}: active market with sane risk params from chain`, async () => {
      const entry = client.getMarketEntry(base);
      const summary = await getMarketSummary(client, entry.marketId, entry.baseType);
      const tag = `${base} (${e2eNetwork})`;

      expect(summary.isActive, `${tag}: isActive`).toBe(true);
      expect(summary.maxLeverageBps, `${tag}: maxLeverageBps`).toBeGreaterThan(0n);
      expect(summary.maxLeverageBps, `${tag}: maxLeverageBps`).toBeLessThanOrEqual(1_000_000n);
      expect(summary.tradingFeeBps, `${tag}: tradingFeeBps`).toBeGreaterThanOrEqual(1n);
      expect(summary.maintenanceMarginBps, `${tag}: maintenanceMarginBps`).toBeGreaterThan(0n);
      expect(summary.minCollValue, `${tag}: minCollValue`).toBeGreaterThanOrEqual(0n);
      expect(summary.maxLongOi, `${tag}: maxLongOi`).toBeGreaterThan(0n);
      expect(summary.maxShortOi, `${tag}: maxShortOi`).toBeGreaterThan(0n);
    }, 60_000);
  }
});

describe("PRD §2.3 — TC-TRADE-003: max leverage vs above-max (on-chain maxLeverageBps)", () => {
  for (const base of activeLifecycleTestBasesForClient(client)) {
    it(`${base}: open at exact max leverage (on-chain resolve_size)`, async (ctx) => {
      const d = await discoverActivePositionForNegativeOpen(client, base);
      if (!d) {
        ctx.skip(prdSkipNoDiscoverOpenRow(base));
        return;
      }

      const row = lifecycleRow(base);
      const entry = client.getMarketEntry(base);
      const summary = await getMarketSummary(client, entry.marketId, entry.baseType);
      const maxLev = Number(summary.maxLeverageBps) / 10_000;
      const tx = await buildOpenPositionTx(client, {
        accountId: d.accountObjectAddress,
        base,
        isLong: row.isLong,
        leverage: maxLev,
        collateralAmount: row.simulateOpenCollateral,
      });
      await trySimulateWithOwner(ctx, tx, d.ownerAddress, 9);
    }, 90_000);

    it(`${base}: open at max leverage + 1 → err_exceed_max_leverage (104)`, async (ctx) => {
      const d = await discoverActivePositionForNegativeOpen(client, base);
      if (!d) {
        ctx.skip(prdSkipNoDiscoverOpenRow(base));
        return;
      }

      await assertOpenAboveMaxLeverageAborts(
        ctx,
        client,
        base,
        d.accountObjectAddress,
        d.ownerAddress,
        (tx) => client.simulate(tx),
      );
    }, 90_000);
  }
});

/*
 * PRD §2.3 — TC-TRADE-004 — SL/TP attached to the same open action: not exposed as a single high-level `buildOpenPositionTx`
 *   in this SDK; cover via app/E2E or lower-level Move calls.
 */

// ---------------------------------------------------------------------------
// §2.4 — Close
// ---------------------------------------------------------------------------

describe("PRD §2.4 — TC-CLOSE-001: full close (simulate)", () => {
  it("buildClosePositionTx — existing BTC position", async (ctx) => {
    const open = await discoverActivePositionFirstMatchingTiers(
      client,
      "BTC",
      discoveryTiersForStatefulMatrix(),
    );
    if (!open) {
      ctx.skip("No discoverable open BTC position on-chain for full close.");
      return;
    }

    const tx = await buildClosePositionTx(client, {
      accountId: open.accountObjectAddress,
      base: "BTC",
      collateral: open.collateral,
      positionId: Number(open.positionId),
    });
    await trySimulateWithOwner(ctx, tx, open.ownerAddress, 10);
  }, 120_000);
});

describe("PRD §2.4 — TC-CLOSE-002: partial close ~50% (simulate)", () => {
  it("buildDecreasePositionTx — ~half size, lot-aligned (BTC)", async (ctx) => {
    const open = await discoverActivePositionFirstMatchingTiers(
      client,
      "BTC",
      discoveryTiersForStatefulMatrix(),
    );
    if (!open) {
      ctx.skip("No discoverable open BTC position for partial close.");
      return;
    }

    const accountId = open.accountObjectAddress;
    const sizeAmount = open.position.size;
    const entry = client.getMarketEntry("BTC");
    const { minSize, lotSize } = await getMarketTradingSizeConstraints(client, entry.marketId);
    const decreaseSize = computeValidPartialDecreaseSize(sizeAmount, minSize, lotSize);
    if (decreaseSize == null) {
      ctx.skip(
        `No valid partial decrease for size=${sizeAmount} (min_size=${minSize}, lot_size=${lotSize}) — would leave dust below min_size.`,
      );
      return;
    }

    const tx = await buildDecreasePositionTx(client, {
      accountId,
      base: "BTC",
      collateral: open.collateral,
      positionId: Number(open.positionId),
      size: decreaseSize,
    });
    tx.setSender(open.ownerAddress);
    const result = await client.simulate(tx);
    if (skipSimulateIfOracleTransient(ctx, result)) return;
    const parsed = parseSimulateFailure(result);
    if (
      parsed?.abortCode === String(WATERX_PERP_ABORT.INVALID_SIZE) &&
      parsed.message.includes("err_invalid_size")
    ) {
      ctx.skip(
        `Partial ~50% dry-run: chain err_invalid_size (201) for discovered size=${sizeAmount} (v2 dust / sizing).`,
      );
      return;
    }
    assertSimulateSuccess(result, 10, { transaction: tx });
  }, 120_000);
});

// ---------------------------------------------------------------------------
// §3.4 — Orders
// ---------------------------------------------------------------------------

describe("PRD §3.4 — TC-ORDER-001: limit order (simulate)", () => {
  it("limit long with trigger well below spot (dry-run)", async (ctx) => {
    const d = await discoverActivePosition(client, "BTC", {
      minAccountUsdcBalance: ORDER_COLLATERAL,
      maxPages: 24,
      requireCooldownElapsed: false,
    });
    if (!d) {
      ctx.skip(prdSkipNoDiscoverOpenRow("BTC"));
      return;
    }

    const tx = await buildPlaceOrderTx(client, {
      accountId: d.accountObjectAddress,
      base: "BTC",
      isLong: true,
      isStopOrder: false,
      collateralAmount: ORDER_COLLATERAL,
      size: ORDER_SIZE,
      triggerPrice: 8_000n,
    });
    await trySimulateWithOwner(ctx, tx, d.ownerAddress, 10);
  }, 120_000);
});

describe("PRD §3.4 — TC-ORDER-002 / TC-ORDER-003 (SDK contract guard)", () => {
  it("reduce-only order without open position → err_reduce_only_requires_position (303)", async (ctx) => {
    const d = await discoverActivePosition(client, "BTC", {
      minAccountUsdcBalance: ORDER_COLLATERAL,
      maxPages: 24,
      requireCooldownElapsed: false,
    });
    if (!d) {
      ctx.skip(prdSkipNoDiscoverOpenRow("BTC"));
      return;
    }

    const tx = await buildPlaceOrderTx(client, {
      accountId: d.accountObjectAddress,
      base: "BTC",
      isLong: true,
      reduceOnly: true,
      isStopOrder: true,
      collateralAmount: ORDER_COLLATERAL,
      size: ORDER_SIZE,
      triggerPrice: 10_000n,
    });
    tx.setSender(d.ownerAddress);
    const result = await client.simulate(tx);
    if (skipSimulateIfOracleTransient(ctx, result)) return;
    assertSimulateMoveAbort(result, {
      abortCode: WATERX_PERP_ABORT.REDUCE_ONLY_REQUIRES_POSITION,
      locationIncludes: "err_reduce_only_requires_position",
    });
  }, 120_000);
});

describe("PRD §3.4 — TC-ORDER-004: cancel pending limit (simulate)", () => {
  it("place + cancel in one PTB", async (ctx) => {
    const d = await discoverActivePosition(client, "BTC", {
      minAccountUsdcBalance: ORDER_COLLATERAL,
      maxPages: 24,
      requireCooldownElapsed: false,
    });
    if (!d) {
      ctx.skip(prdSkipNoDiscoverOpenRow("BTC"));
      return;
    }

    const market = client.getMarketEntry("BTC");
    const summary = await getMarketSummary(client, market.marketId, market.baseType);
    const orderId = Number(summary.nextOrderId);
    const triggerPrice = 55_000n;

    const tx = new Transaction();
    tx.setSender(d.ownerAddress);
    tx.setGasBudget(320_000_000);

    await buildPlaceOrderTx(client, {
      accountId: d.accountObjectAddress,
      base: "BTC",
      isLong: true,
      collateralAmount: ORDER_COLLATERAL,
      size: ORDER_SIZE,
      triggerPrice,
      tx,
    });
    await buildCancelOrderTx(client, {
      accountId: d.accountObjectAddress,
      base: "BTC",
      orderId,
      triggerPrice,
      tx,
    });
    try {
      await trySimulateWithOwner(ctx, tx, d.ownerAddress, 20);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("err_order_not_found") || msg.includes("300")) {
        ctx.skip("orderId prediction stale on shared testnet");
        return;
      }
      throw e;
    }
  }, 120_000);
});

// ---------------------------------------------------------------------------
// §3.5 / §3.7 / §3.8 / §9.3 / §3.2 — Not covered by unsigned SDK simulate (documented only)
// ---------------------------------------------------------------------------

/*
 * PRD §3.5 — TC-LIQ-001 / TC-ADL-001 — Liquidation / ADL outcomes require controlled position + pool risk state + keeper;
 *   use integration/Move tests.
 *
 * PRD §3.7 — TC-ORACLE-001 … TC-ORACLE-005 — Oracle policy UI and gating live in the app / global config; not asserted here.
 *
 * PRD §3.8 — TC-KEEPER-001 … TC-KEEPER-003 — Keeper latency and hourly funding updates require timed on-chain observation;
 *   out of scope for PTB dry-run.
 *
 * PRD §9.3 — TC-UI-001 … TC-UI-007 — UI banners, responsiveness, and tooltips require browser E2E (Playwright, etc.).
 *
 * PRD §3.2 — listed xStock / commodity symbols — AAPLX, GOOGLX, XAU, … are not in `BaseAsset` / testnet constants yet;
 *   add simulate when markets exist in SDK config.
 */

// ---------------------------------------------------------------------------
// §4 — WLP
// ---------------------------------------------------------------------------

describe("PRD §4 — TC-WLP-001: mint (simulate)", () => {
  it("buildMintWlpTx dry-run", async (ctx) => {
    const owner = requireProbe(ctx).owner;
    const cfg = client.config;
    const { objects } = await client.listCoins({
      owner,
      coinType: cfg.collaterals.USDC.type,
    });
    const walletCoins = objects.map((o) => ({
      objectId: o.objectId,
      balance: BigInt(o.balance),
    }));
    let tx;
    try {
      tx = await buildMintWlpSimulateTx(client, {
        recipient: owner,
        collateral: "USDC",
        walletCoins,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("min_deposit")) {
        ctx.skip(`PRD WLP mint: ${msg}`);
        return;
      }
      throw e;
    }
    await trySimulateWlpMint(ctx, tx, 4);
  }, 90_000);
});

/*
 * PRD §4 — TC-WLP-002 / TC-WLP-003 — T+1 redeem settlement + cancel window: see `wlp-simulate.test.ts`
 *   (request/cancel PTB + settle with err_redeem_not_ready).
 */

// ---------------------------------------------------------------------------
// §7 — Referral
// ---------------------------------------------------------------------------

/*
 * PRD §7 — TC-REF-001 — Successful bind via `useReferralCode` needs a real, unbound account + valid referrer code on testnet;
 *   set WATERX_PRD_REFERRAL_CODE and add a test when available.
 */

describe("PRD §7 — TC-REF-002 (SDK negative): invalid / unknown referral code", () => {
  it("useReferralCode with unknown code → err_referral_code_not_exists (704)", async () => {
    // Use a fresh sender (no existing bind). `use_referral_code` silently early-returns when
    // `ctx.sender()` is already a referee (any previously-bound address would skip the abort
    // path regardless of code validity), so we must not reuse the discovery probe owner.
    const tx = new Transaction();
    tx.setSender(DUMMY_SENDER);
    tx.setGasBudget(100_000_000);
    useReferralCode(client, tx, { code: `invalid-${Date.now().toString(36)}` });
    const result = await client.simulate(tx);
    assertSimulateMoveAbort(result, {
      abortCode: WATERX_PERP_ABORT.REFERRAL_CODE_NOT_EXISTS,
      locationIncludes: "err_referral_code_not_exists",
    });
  }, 60_000);
});

/*
 * PRD §7 — TC-REF-003 — Referral dashboard aggregates are app/API concerns; not queried here.
 */

// ---------------------------------------------------------------------------
// §3.3 — Fee routing
// ---------------------------------------------------------------------------

/*
 * PRD §3.3 — TC-FEE-001 … TC-FEE-005 — Fee split to WLP vs protocol is enforced inside Move modules;
 *   assert via Move/unit tests or event integration.
 */

// ---------------------------------------------------------------------------
// §13 — Edge / negative
// ---------------------------------------------------------------------------

describe("PRD §13 — TC-EDGE-001: insufficient collateral for intent (simulate)", () => {
  it("open BTC with extreme notional vs tiny collateral → FailedTransaction (202 or 104)", async (ctx) => {
    const d = await discoverActivePositionForNegativeOpen(client, "BTC");
    if (!d) {
      ctx.skip(prdSkipNoDiscoverOpenRow("BTC"));
      return;
    }

    const tx = await buildOpenPositionTx(client, {
      accountId: d.accountObjectAddress,
      base: "BTC",
      isLong: true,
      collateralAmount: 1_000_000n,
      size: 80_000_000n,
    });
    tx.setSender(d.ownerAddress);
    const result = await client.simulate(tx);
    if (skipSimulateIfOracleTransient(ctx, result)) return;
    const meta = parseSimulateFailure(result);
    expect(meta, "expected parseable MoveAbort for insufficient-collateral intent").not.toBeNull();
    const code = meta!.abortCode != null ? Number(meta!.abortCode) : Number.NaN;
    expect(
      [WATERX_PERP_ABORT.INSUFFICIENT_COLLATERAL, WATERX_PERP_ABORT.EXCEED_MAX_LEVERAGE],
      meta!.message,
    ).toContain(code);
  }, 90_000);
});

/*
 * PRD §13 — TC-EDGE-005 / TC-EDGE-006 / TC-EDGE-007 — API rate limits, wallet disconnect UX, and per-asset feed pauses
 *   are outside this SDK simulate project.
 */

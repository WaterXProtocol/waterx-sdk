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
  buildMintWlpTx,
  buildOpenPositionTx,
  buildPlaceOrderTx,
  buildReceiveCoinTx,
  buildTransferToAccountTx,
  createAccount,
  getAccountBalance,
  getAccountsByOwner,
  getMarketSummary,
  TESTNET_TYPES,
  useReferralCode,
} from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { MARKET_DEFINITIONS } from "../../scripts/market-params.ts";
import type { BaseAsset } from "../../src/constants.ts";
import { expectLeverageOpenSizingVsMarket } from "../helpers/e2e-open-sizing-expect.ts";
import { lifecycleOracleUsdOrSkip } from "../helpers/e2e-oracle-context.ts";
import { INTEGRATION_REFERENCE_WALLET_ADDRESS } from "../helpers/integration-reference-wallet.ts";
import { activeLifecycleTestBases, lifecycleRow } from "../helpers/lifecycle-test-markets.ts";
import { resolveE2eOpenPosition } from "../helpers/resolve-e2e-open-position.ts";
import { pickE2eAccountIdForOwner } from "../helpers/resolve-e2e-reference-account.ts";
import {
  assertSimulateMoveAbort,
  assertSimulateSuccess,
  parseSimulateFailure,
  skipSimulateIfOracleTransient,
} from "../helpers/simulate-assertions.ts";
import { client } from "../helpers/testnet.ts";
import { WATERX_PERP_ABORT } from "../helpers/waterx-perp-error-codes.ts";

const OWNER = INTEGRATION_REFERENCE_WALLET_ADDRESS;

const ORDER_COLLATERAL = 10_000_000n;
const ORDER_SIZE = 2_000n;
/** PRD normal deposit example: 100 USDC (6 dp). */
const DEPOSIT_100_USDC = 100_000_000n;
/** PRD boundary: 10 USDC minimum (6 dp). */
const DEPOSIT_10_USDC = 10_000_000n;
const RECEIVE_WITHDRAW_AMOUNT = 5_000_000n;

async function firstAccountId(ctx: { skip: (reason?: string) => void }): Promise<string | null> {
  const accounts = await getAccountsByOwner(client, OWNER);
  if (!accounts.length) {
    ctx.skip(`No WaterX UserAccount on testnet for ${OWNER}; run pnpm create-testnet-account.`);
    return null;
  }
  try {
    return pickE2eAccountIdForOwner(OWNER, accounts);
  } catch (e) {
    ctx.skip(e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function trySimulate(
  ctx: { skip: (reason?: string) => void },
  tx: Transaction,
  minCommands = 1,
) {
  tx.setSender(OWNER);
  const result = await client.simulate(tx);
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  assertSimulateSuccess(result, minCommands, { transaction: tx });
}

// ---------------------------------------------------------------------------
// §2.1 新用戶旅程 — Onboarding (SDK / simulate subset)
// ---------------------------------------------------------------------------

describe("PRD §2.1 — TC-ONBOARD-001 (SDK): create account + deposit path dry-run", () => {
  it("step 3–4 equivalent: createAccount PTB simulates", async () => {
    const tx = new Transaction();
    tx.setSender(OWNER);
    tx.setGasBudget(120_000_000);
    createAccount(client, tx, `prd-onboard-${Date.now().toString(36).slice(-6)}`);
    const result = await client.simulate(tx);
    assertSimulateSuccess(result, 1, { transaction: tx });
  }, 60_000);

  it("step 5 equivalent (100 USDC): buildTransferToAccountTx dry-run when wallet USDC available", async (ctx) => {
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const walletCoins = await client.listCoins({ owner: OWNER, coinType: TESTNET_TYPES.USDC });
    const coin = walletCoins.objects.find((c) => BigInt(c.balance ?? "0") >= DEPOSIT_100_USDC);
    if (!coin) {
      ctx.skip(`No wallet USDC coin >= ${DEPOSIT_100_USDC} for ${OWNER}`);
      return;
    }

    const tx = buildTransferToAccountTx(client, {
      accountObjectAddress: accountId,
      coinObjectId: coin.objectId,
      coinType: TESTNET_TYPES.USDC,
    });
    await trySimulate(ctx, tx, 1);
  }, 60_000);

  it("boundary 10 USDC: buildTransferToAccountTx dry-run when wallet coin ≥ 10 USDC", async (ctx) => {
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const walletCoins = await client.listCoins({ owner: OWNER, coinType: TESTNET_TYPES.USDC });
    const coin = walletCoins.objects.find((c) => BigInt(c.balance ?? "0") >= DEPOSIT_10_USDC);
    if (!coin) {
      ctx.skip(`No wallet USDC coin >= ${DEPOSIT_10_USDC} for ${OWNER}`);
      return;
    }

    const tx = buildTransferToAccountTx(client, {
      accountObjectAddress: accountId,
      coinObjectId: coin.objectId,
      coinType: TESTNET_TYPES.USDC,
    });
    await trySimulate(ctx, tx, 1);
  }, 60_000);
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

    const bal = await getAccountBalance(client, accountId, TESTNET_TYPES.USDC);
    if (bal < RECEIVE_WITHDRAW_AMOUNT) {
      ctx.skip(`Account USDC balance ${bal} < ${RECEIVE_WITHDRAW_AMOUNT}`);
      return;
    }

    const tx = await buildReceiveCoinTx(client, {
      accountObjectAddress: accountId,
      collateral: "USDC",
      amount: RECEIVE_WITHDRAW_AMOUNT,
      recipient: OWNER,
    });
    await trySimulate(ctx, tx, 3);
  }, 90_000);
});

// ---------------------------------------------------------------------------
// §2.3 / §3 — Trading (open)
// ---------------------------------------------------------------------------

describe("PRD §2.3 — TC-TRADE-001: BTC market long ~10x (simulate)", () => {
  it("buildOpenPositionTx — BTC long, 10x", async (ctx) => {
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const prices = await lifecycleOracleUsdOrSkip(client, ctx);
    if (!prices) return;

    const row = lifecycleRow("BTC");
    await expectLeverageOpenSizingVsMarket(
      client,
      "BTC",
      row.simulateOpenCollateral,
      10,
      prices.BTC,
    );
    const tx = await buildOpenPositionTx(client, {
      accountId,
      base: "BTC",
      isLong: true,
      leverage: 10,
      collateralAmount: row.simulateOpenCollateral,
    });
    await trySimulate(ctx, tx, 9);
  }, 90_000);
});

describe("PRD §2.3 — TC-TRADE-002: ETH market short (simulate)", () => {
  it("buildOpenPositionTx — ETH short", async (ctx) => {
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const prices = await lifecycleOracleUsdOrSkip(client, ctx);
    if (!prices) return;

    const row = lifecycleRow("ETH");
    await expectLeverageOpenSizingVsMarket(
      client,
      "ETH",
      row.simulateOpenCollateral,
      10,
      prices.ETH,
    );
    const tx = await buildOpenPositionTx(client, {
      accountId,
      base: "ETH",
      isLong: false,
      leverage: 10,
      collateralAmount: row.simulateOpenCollateral,
    });
    await trySimulate(ctx, tx, 9);
  }, 90_000);
});

describe("PRD §2.3 — TC-TRADE-003: max leverage vs above-max (per MARKET_DEFINITIONS / testnet markets)", () => {
  for (const base of activeLifecycleTestBases()) {
    it(`${base}: open at exact max leverage (on-chain resolve_size)`, async (ctx) => {
      const accountId = await firstAccountId(ctx);
      if (!accountId) return;

      const row = lifecycleRow(base);
      const entry = client.getMarketEntry(base);
      const summary = await getMarketSummary(client, entry.marketId, entry.baseType);
      expect(
        summary.maxLeverageBps,
        `${base}: testnet maxLeverageBps should match MARKET_DEFINITIONS`,
      ).toBe(BigInt(MARKET_DEFINITIONS[base].maxLeverageBps));

      const maxLev = Number(summary.maxLeverageBps) / 10_000;
      const tx = await buildOpenPositionTx(client, {
        accountId,
        base,
        isLong: row.isLong,
        leverage: maxLev,
        collateralAmount: row.simulateOpenCollateral,
      });
      await trySimulate(ctx, tx, 9);
    }, 90_000);

    it(`${base}: open at max leverage + 1 → err_exceed_max_leverage (104)`, async (ctx) => {
      const accountId = await firstAccountId(ctx);
      if (!accountId) return;

      const entry = client.getMarketEntry(base);
      const summary = await getMarketSummary(client, entry.marketId, entry.baseType);
      const aboveMaxLev = Number(summary.maxLeverageBps) / 10_000 + 1;

      const row = lifecycleRow(base);
      const tx = await buildOpenPositionTx(client, {
        accountId,
        base,
        isLong: row.isLong,
        leverage: aboveMaxLev,
        collateralAmount: row.simulateOpenCollateral,
      });
      tx.setSender(OWNER);
      const result = await client.simulate(tx);
      if (skipSimulateIfOracleTransient(ctx, result)) return;
      assertSimulateMoveAbort(result, {
        abortCode: WATERX_PERP_ABORT.EXCEED_MAX_LEVERAGE,
        locationIncludes: "err_exceed_max_leverage",
      });
    }, 90_000);
  }
});

/*
 * PRD §2.3 — TC-TRADE-004 — SL/TP attached to the same open action: not exposed as a single high-level `buildOpenPositionTx`
 *   in this SDK; cover via app/E2E or lower-level Move calls.
 */

describe("PRD §2.3 — TC-TRADE-005: base fee vs PRD (crypto testnet set)", () => {
  it("MARKET_DEFINITIONS tradingFeeBps = 3 (0.03%) for all SDK BaseAsset entries", () => {
    const bases = Object.keys(MARKET_DEFINITIONS) as BaseAsset[];
    for (const b of bases) {
      expect(MARKET_DEFINITIONS[b].tradingFeeBps, b).toBe(3);
    }
  });
});

// ---------------------------------------------------------------------------
// §2.4 — Close
// ---------------------------------------------------------------------------

describe("PRD §2.4 — TC-CLOSE-001: full close (simulate)", () => {
  it("buildClosePositionTx — existing BTC position", async (ctx) => {
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const open = await resolveE2eOpenPosition(client, accountId, "BTC");
    if (!open) {
      ctx.skip("No open BTC position for reference account (fixed id or bootstrap).");
      return;
    }

    const tx = await buildClosePositionTx(client, {
      accountId,
      base: "BTC",
      positionId: Number(open.positionId),
    });
    await trySimulate(ctx, tx, 10);
  }, 120_000);
});

describe("PRD §2.4 — TC-CLOSE-002: partial close ~50% (simulate)", () => {
  it("buildDecreasePositionTx — ~half size, lot-aligned (BTC)", async (ctx) => {
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const open = await resolveE2eOpenPosition(client, accountId, "BTC");
    if (!open) {
      ctx.skip("No open BTC position for reference account (fixed id or bootstrap).");
      return;
    }

    // v2 has no lot size — take a half-size step directly.
    const sizeAmount = open.info.size;
    const half = sizeAmount / 2n;
    if (half <= 0n || half >= sizeAmount) {
      ctx.skip(`Cannot derive ~50% step (size=${sizeAmount})`);
      return;
    }

    const tx = await buildDecreasePositionTx(client, {
      accountId,
      base: "BTC",
      positionId: Number(open.positionId),
      size: half,
    });
    await trySimulate(ctx, tx, 10);
  }, 120_000);
});

// ---------------------------------------------------------------------------
// §3.4 — Orders
// ---------------------------------------------------------------------------

describe("PRD §3.4 — TC-ORDER-001: limit order (simulate)", () => {
  it("limit long with trigger well below spot (dry-run)", async (ctx) => {
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const usdcBalance = await getAccountBalance(client, accountId, TESTNET_TYPES.USDC);
    if (usdcBalance < ORDER_COLLATERAL) {
      ctx.skip(`Insufficient account USDC: have ${usdcBalance}, need ${ORDER_COLLATERAL}`);
      return;
    }

    const tx = await buildPlaceOrderTx(client, {
      accountId,
      base: "BTC",
      isLong: true,
      isStopOrder: false,
      collateralAmount: ORDER_COLLATERAL,
      size: ORDER_SIZE,
      triggerPrice: 8_000n,
    });
    await trySimulate(ctx, tx, 10);
  }, 120_000);
});

describe("PRD §3.4 — TC-ORDER-002 / TC-ORDER-003 (SDK contract guard)", () => {
  it("reduce-only order without open position → err_reduce_only_requires_position (303)", async (ctx) => {
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const usdcBalance = await getAccountBalance(client, accountId, TESTNET_TYPES.USDC);
    if (usdcBalance < ORDER_COLLATERAL) {
      ctx.skip(`Insufficient account USDC: have ${usdcBalance}, need ${ORDER_COLLATERAL}`);
      return;
    }

    const tx = await buildPlaceOrderTx(client, {
      accountId,
      base: "BTC",
      isLong: true,
      reduceOnly: true,
      isStopOrder: true,
      collateralAmount: ORDER_COLLATERAL,
      size: ORDER_SIZE,
      triggerPrice: 10_000n,
    });
    tx.setSender(OWNER);
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
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const usdcBalance = await getAccountBalance(client, accountId, TESTNET_TYPES.USDC);
    if (usdcBalance < ORDER_COLLATERAL) {
      ctx.skip(`Insufficient account USDC: have ${usdcBalance}, need ${ORDER_COLLATERAL}`);
      return;
    }

    const market = client.getMarketEntry("BTC");
    const summary = await getMarketSummary(client, market.marketId, market.baseType);
    const orderId = Number(summary.nextOrderId);
    const triggerPrice = 55_000n;

    const tx = new Transaction();
    tx.setSender(OWNER);
    tx.setGasBudget(320_000_000);

    await buildPlaceOrderTx(client, {
      accountId,
      base: "BTC",
      isLong: true,
      collateralAmount: ORDER_COLLATERAL,
      size: ORDER_SIZE,
      triggerPrice,
      tx,
    });
    await buildCancelOrderTx(client, {
      accountId,
      base: "BTC",
      orderId,
      triggerPrice,
      tx,
    });
    try {
      await trySimulate(ctx, tx, 20);
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
    const cfg = client.config;
    const { objects } = await client.listCoins({
      owner: OWNER,
      coinType: cfg.collaterals.USDC.type,
    });
    if (!objects.length) {
      ctx.skip(`No wallet-level USDC at ${OWNER}.`);
      return;
    }

    const tx = await buildMintWlpTx(client, {
      depositCoin: objects[0]!.objectId,
      recipient: OWNER,
      collateral: "USDC",
    });
    await trySimulate(ctx, tx, 4);
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
    const tx = new Transaction();
    tx.setSender(OWNER);
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
    const accountId = await firstAccountId(ctx);
    if (!accountId) return;

    const tx = await buildOpenPositionTx(client, {
      accountId,
      base: "BTC",
      isLong: true,
      collateralAmount: 1_000_000n,
      size: 80_000_000n,
    });
    tx.setSender(OWNER);
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

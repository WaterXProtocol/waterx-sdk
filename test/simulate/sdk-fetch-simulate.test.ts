/** Testnet simulate / gRPC reads; no keys required (CI-safe). */
import {
  getAccountBalance,
  getAccountCoins,
  getAccountDelegates,
  getAccountObjectId,
  getAccountsByOwner,
  getMarketCooldownMs,
  getMarketSummary,
  getPoolSummary,
  getPosition,
  getTokenPoolSummary,
  positionExists,
  selectCoinsForAmount,
  TESTNET_MARKETS,
  TESTNET_OBJECTS,
  TESTNET_TYPES,
} from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { computeLeverageDerivedSize } from "../helpers/compute-leverage-size";
import { expectMarketOiFieldsParsed } from "../helpers/market-summary-assertions.ts";
import {
  assertSimulateSuccess,
  skipSimulateIfOracleTransient,
} from "../helpers/simulate-assertions.ts";
import {
  buildResizeSizingProbeTransaction,
  parseResizeSizingProbeResult,
} from "../helpers/simulate-resize-size.ts";
import { client, DUMMY_SENDER } from "../helpers/testnet";

describe("SDK fetch API — simulate / ledger (testnet)", () => {
  it("client exposes USDC + USDSUI collateral assets", () => {
    const assets = client.getCollateralAssets().map((x) => x.asset);
    expect(assets).toContain("USDC");
    expect(assets).toContain("USDSUI");
  });

  it("DUMMY_SENDER is a well-formed 32-byte hex address", () => {
    expect(DUMMY_SENDER).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it("getMarketSummary (BTC, ETH)", async () => {
    const btc = await getMarketSummary(
      client,
      TESTNET_MARKETS.BTC.marketId,
      TESTNET_MARKETS.BTC.baseType,
    );
    expectMarketOiFieldsParsed(btc);
    expect(btc.maxLeverageBps).toBeGreaterThan(0n);

    const eth = await getMarketSummary(
      client,
      TESTNET_MARKETS.ETH.marketId,
      TESTNET_MARKETS.ETH.baseType,
    );
    expectMarketOiFieldsParsed(eth);
    expect(eth.isActive).toBe(true);
  });

  it("getMarketCooldownMs (all TESTNET_MARKETS)", async () => {
    for (const [base, market] of Object.entries(TESTNET_MARKETS)) {
      const cooldown = await getMarketCooldownMs(client, market.marketId);
      expect(cooldown).toBeGreaterThanOrEqual(0n);
      expect(typeof cooldown).toBe("bigint");
      expect(base.length > 0).toBe(true);
    }
  });

  it.each([
    {
      marketId: TESTNET_MARKETS.BTC.marketId,
      baseType: TESTNET_MARKETS.BTC.baseType,
      label: "BTC",
    },
    {
      marketId: TESTNET_MARKETS.ETH.marketId,
      baseType: TESTNET_MARKETS.ETH.baseType,
      label: "ETH",
    },
  ])(
    "computeLeverageDerivedSize returns a positive size ($label)",
    async ({ marketId, baseType }) => {
      // v2 removed lot/min size; just sanity-check derivation is positive.
      await getMarketSummary(client, marketId, baseType);
      const size = computeLeverageDerivedSize({
        collateralAmount: 500_000_000n,
        leverage: 2,
        approxPrice: 50_000,
      });
      expect(size).toBeGreaterThan(0n);
    },
  );

  it("on-chain resize probe returns positive size (all TESTNET_MARKETS, one simulate)", async (ctx) => {
    const bases = Object.keys(TESTNET_MARKETS) as (keyof typeof TESTNET_MARKETS)[];
    const { tx, resizeCommandIndexByBase } = await buildResizeSizingProbeTransaction(
      client,
      bases,
      { collateralAmount: 500_000_000n, leverage: 2 },
    );
    const result = await client.simulate(tx);
    if (skipSimulateIfOracleTransient(ctx, result)) return;
    assertSimulateSuccess(result, tx.getData().commands.length, { transaction: tx });
    const sizes = parseResizeSizingProbeResult(result, bases, resizeCommandIndexByBase);
    // v2 removed lot/min size; just require a positive result.
    for (const base of bases) {
      expect(sizes[base]!, `${base}: resize > 0`).toBeGreaterThan(0n);
    }
  }, 120_000);

  it("getPoolSummary totalLpSupply / tvlUsd", async () => {
    const pool = await getPoolSummary(client);
    expect(pool.totalLpSupply).toBeGreaterThanOrEqual(0n);
    expect(pool.tvlUsd).toBeGreaterThanOrEqual(0n);
  });

  it("getPoolSummary", async () => {
    const p = await getPoolSummary(client);
    expect(p.isActive).toBe(true);
    expect(p.tokenCount).toBeGreaterThan(0n);
  });

  it("getTokenPoolSummary(0)", async () => {
    const t = await getTokenPoolSummary(client, 0);
    expect(t.tokenDecimal).toBeGreaterThan(0);
  });

  it("getAccountsByOwner (protocol ADMIN_CAP address)", async () => {
    const rows = await getAccountsByOwner(client, TESTNET_OBJECTS.ADMIN_CAP);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("account helpers when owner has at least one account", async () => {
    const accounts = await getAccountsByOwner(client, TESTNET_OBJECTS.ADMIN_CAP);
    if (accounts.length === 0) return;

    const accountId = accounts[0]!.accountId;
    const owner = accounts[0]!.ownerAddress;
    expect(await getAccountObjectId(client, owner, accountId)).toBe(
      accounts[0]!.accountObjectAddress,
    );

    const delegates = await getAccountDelegates(client, owner, accountId);
    expect(Array.isArray(delegates)).toBe(true);

    for (const collateralType of [TESTNET_TYPES.USDC, TESTNET_TYPES.USDSUI]) {
      const coins = await getAccountCoins(client, accountId, collateralType);
      expect(Array.isArray(coins)).toBe(true);

      const balance = await getAccountBalance(client, accountId, collateralType);
      expect(balance >= 0n).toBe(true);

      const picked = await selectCoinsForAmount(client, accountId, collateralType, 0n);
      expect(picked.totalBalance >= 0n).toBe(true);
    }
  });

  it("positionExists", async () => {
    const exists = await positionExists(
      client,
      TESTNET_MARKETS.BTC.marketId,
      0n,
      TESTNET_MARKETS.BTC.baseType,
    );
    expect(typeof exists).toBe("boolean");
  });

  it("getPosition when position exists for id 0", async () => {
    const id = 0n;
    if (
      !(await positionExists(
        client,
        TESTNET_MARKETS.BTC.marketId,
        id,
        TESTNET_MARKETS.BTC.baseType,
      ))
    )
      return;
    const pos = await getPosition(
      client,
      TESTNET_MARKETS.BTC.marketId,
      id,
      TESTNET_MARKETS.BTC.baseType,
    );
    expect(pos.positionId).toBe(id);
    expect(pos.accountObjectAddress).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(pos.marketId).toBeDefined();
  });
});

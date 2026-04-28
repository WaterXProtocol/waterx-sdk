/** E2E network simulate / gRPC reads; no keys required (CI-safe). */
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
  PythCache,
  selectCoinsForAmount,
} from "@waterx/perp-sdk";
import { beforeAll, describe, expect, it } from "vitest";

import { MAINNET_OBJECTS, TESTNET_OBJECTS } from "../../src/constants.ts";
import { client, DUMMY_SENDER, e2eNetwork } from "../helpers/e2e/e2e-client.ts";
import { warmPythHermesForBases } from "../helpers/e2e/e2e-oracle-context.ts";
import { isOracleTransientFailureMessage } from "../helpers/e2e/simulate-assertions.ts";
import { computeLeverageDerivedSize } from "../helpers/trading/compute-leverage-size";
import { expectMarketOiFieldsParsed } from "../helpers/trading/market-summary-assertions.ts";
import { simulateResizeDerivedSizesForBases } from "../helpers/trading/simulate-resize-size.ts";

const protocolObjects = e2eNetwork === "mainnet" ? MAINNET_OBJECTS : TESTNET_OBJECTS;

describe(`SDK fetch API — simulate / ledger (${e2eNetwork})`, () => {
  let btcSummary: Awaited<ReturnType<typeof getMarketSummary>>;
  let ethSummary: Awaited<ReturnType<typeof getMarketSummary>>;

  beforeAll(async () => {
    const btcEntry = client.getMarketEntry("BTC");
    const ethEntry = client.getMarketEntry("ETH");
    [btcSummary, ethSummary] = await Promise.all([
      getMarketSummary(client, btcEntry.marketId, btcEntry.baseType),
      getMarketSummary(client, ethEntry.marketId, ethEntry.baseType),
    ]);
  });

  it("client exposes USDC collateral", () => {
    const assets = client.getCollateralAssets().map((x) => x.asset);
    expect(assets).toContain("USDC");
    // Testnet deployment also enables USDSUI as a second collateral (mainnet
    // manifest currently lists USDC only). Guard so this doesn't regress if
    // USDSUI is removed from testnet config without intent.
    if (e2eNetwork === "testnet") {
      expect(assets, "testnet: USDSUI collateral should be exposed").toContain("USDSUI");
    }
  });

  it("DUMMY_SENDER is a well-formed 32-byte hex address", () => {
    expect(DUMMY_SENDER).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it("getMarketSummary (BTC, ETH)", async () => {
    expectMarketOiFieldsParsed(btcSummary);
    expect(btcSummary.maxLeverageBps).toBeGreaterThan(0n);

    expectMarketOiFieldsParsed(ethSummary);
    expect(ethSummary.isActive).toBe(true);
  });

  it("getMarketCooldownMs (all configured markets)", async () => {
    for (const { asset } of client.getBaseAssets()) {
      const m = client.getMarketEntry(asset);
      const cooldown = await getMarketCooldownMs(client, m.marketId);
      expect(cooldown).toBeGreaterThanOrEqual(0n);
      expect(typeof cooldown).toBe("bigint");
    }
  });

  it.each(["BTC", "ETH"] as const)(
    "computeLeverageDerivedSize returns a positive size (%s)",
    async () => {
      const size = computeLeverageDerivedSize({
        collateralAmount: 500_000_000n,
        leverage: 2,
        approxPrice: 50_000,
      });
      expect(size).toBeGreaterThan(0n);
    },
  );

  it("on-chain resize probe returns positive size (all markets, per-base + retry)", async (ctx) => {
    const bases = client
      .getBaseAssets()
      .map((b) => b.asset)
      .sort((a, b) => {
        if (a === "BTC") return -1;
        if (b === "BTC") return 1;
        return a.localeCompare(b);
      });
    /**
     * One `resolve_size` probe per base (small PTB) + shared {@link PythCache}.
     * Hermes warm populates cache; retries cover public-RPC / aggregate flakiness (204).
     *
     * Per-base outcomes are tracked independently: a transient Pyth/aggregator
     * miss on a single base (e.g. SPYX stale feed) no longer skips the whole
     * test — only if **every** base fails transient do we `ctx.skip`.
     */
    const params = { collateralAmount: 500_000_000n, leverage: 2 } as const;
    const pythCache = new PythCache();
    await warmPythHermesForBases(client, pythCache, bases);
    const maxAttempts = 3;

    const succeeded: string[] = [];
    const transientFailures: string[] = [];

    for (const base of bases) {
      let lastMsg = "";
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const sizes = await simulateResizeDerivedSizesForBases(client, [base], params, {
            pythCache,
          });
          expect(sizes[base]!, `${base}: resize > 0`).toBeGreaterThan(0n);
          lastMsg = "";
          break;
        } catch (e) {
          lastMsg = e instanceof Error ? e.message : String(e);
          if (!isOracleTransientFailureMessage(lastMsg)) throw e;
          await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        }
      }
      if (lastMsg) {
        transientFailures.push(`${base}: ${lastMsg.split("\n")[0]}`);
      } else {
        succeeded.push(base);
      }
    }

    if (succeeded.length === 0) {
      ctx.skip(
        `Oracle feed/aggregate failed (transient) for all ${bases.length} bases: ` +
          transientFailures.join(" | "),
      );
      return;
    }
    if (transientFailures.length > 0) {
      console.warn(
        `[sdk-fetch-simulate] resize probe: ${succeeded.length}/${bases.length} bases OK, ` +
          `transient oracle failures: ${transientFailures.join(" | ")}`,
      );
    }
    expect(
      succeeded.length,
      "at least one base's resize probe should return a positive size",
    ).toBeGreaterThan(0);
  }, 120_000);

  it("getPoolSummary (single fetch: TVL, supply, activity)", async () => {
    const p = await getPoolSummary(client);
    expect(p.totalLpSupply).toBeGreaterThanOrEqual(0n);
    expect(p.tvlUsd).toBeGreaterThanOrEqual(0n);
    expect(p.isActive).toBe(true);
    expect(p.tokenCount).toBeGreaterThan(0n);
  });

  it("getTokenPoolSummary(0)", async () => {
    const t = await getTokenPoolSummary(client, 0);
    expect(t.tokenDecimal).toBeGreaterThan(0);
  });

  it("getAccountsByOwner (protocol ADMIN_CAP address)", async () => {
    const rows = await getAccountsByOwner(client, protocolObjects.ADMIN_CAP);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("account helpers when owner has at least one account", async () => {
    const accounts = await getAccountsByOwner(client, protocolObjects.ADMIN_CAP);
    if (accounts.length === 0) return;

    const accountId = accounts[0]!.accountId;
    const owner = accounts[0]!.ownerAddress;
    expect(await getAccountObjectId(client, owner, accountId)).toBe(
      accounts[0]!.accountObjectAddress,
    );

    const delegates = await getAccountDelegates(client, owner, accountId);
    expect(Array.isArray(delegates)).toBe(true);

    for (const { coinType } of client.getCollateralAssets()) {
      const coins = await getAccountCoins(client, accountId, coinType);
      expect(Array.isArray(coins)).toBe(true);

      const balance = await getAccountBalance(client, accountId, coinType);
      expect(balance >= 0n).toBe(true);

      const picked = await selectCoinsForAmount(client, accountId, coinType, 0n);
      expect(picked.totalBalance >= 0n).toBe(true);
    }
  });

  it("positionExists", async () => {
    const m = client.getMarketEntry("BTC");
    const exists = await positionExists(client, m.marketId, 0n, m.baseType);
    expect(typeof exists).toBe("boolean");
  });

  it("getPosition when position exists for id 0", async () => {
    const m = client.getMarketEntry("BTC");
    const id = 0n;
    if (!(await positionExists(client, m.marketId, id, m.baseType))) return;
    const pos = await getPosition(client, m.marketId, id, m.baseType);
    expect(pos.positionId).toBe(id);
    expect(pos.accountObjectAddress).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(pos.marketId).toBeDefined();
  });
});

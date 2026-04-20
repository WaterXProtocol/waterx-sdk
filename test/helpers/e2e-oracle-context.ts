import { Transaction } from "@mysten/sui/transactions";
import {
  PYTH_PRICE_FEED_IDS,
  PYTH_TESTNET_FEED_IDS,
  PythCache,
  updatePythPrices,
  type WaterXClient,
} from "@waterx/perp-sdk";

import type { BaseAsset } from "../../src/constants.ts";
import { activeLifecycleTestBases } from "./lifecycle-test-markets.ts";
import { fetchSimulatedUsdPricesForBases } from "./oracle-simulate-multi-asset.ts";

/**
 * Probes oracle USD prices for all lifecycle bases via a single simulate TX.
 *
 * Before probing, issues a Hermes update inside the simulate TX so that Pyth
 * `PriceInfoObject`s carry fresh data — avoids `err_total_weight_not_enough (204)`
 * when on-chain prices are stale.  A shared `PythCache` is used so Hermes +
 * on-chain reads are fetched once across all feeds.
 *
 * If Hermes is unreachable or the simulate fails, the test is skipped.
 */
export async function lifecycleOracleUsdOrSkip(
  client: WaterXClient,
  ctx: { skip: (reason?: string) => void },
): Promise<Record<BaseAsset, number> | null> {
  const bases = activeLifecycleTestBases();
  if (bases.length === 0) return {} as Record<BaseAsset, number>;

  const cache = new PythCache();

  // Pre-warm: execute a Hermes-fed simulate TX so on-chain Pyth reads inside
  // `fetchSimulatedUsdPricesForBases` see fresh prices.  If Hermes is down the
  // simulate will still attempt using stale on-chain data; if that also fails
  // the outer catch skips the test.
  try {
    const pythCfg = client.config.pythConfig;
    const feedIdTable =
      client.config.network === "TESTNET" ? PYTH_TESTNET_FEED_IDS : PYTH_PRICE_FEED_IDS;
    const feedSet = new Set<string>();
    for (const base of bases) {
      const m = client.getMarketEntry(base);
      const fid = feedIdTable[m.feedKey]?.replace(/^0x/, "");
      if (fid) feedSet.add(fid);
    }

    if (pythCfg && feedSet.size > 0) {
      const warmTx = new Transaction();
      warmTx.setSender("0x1111111111111111111111111111111111111111111111111111111111111111");
      warmTx.setGasBudget(1_200_000_000);
      await updatePythPrices(warmTx, client.grpcClient, pythCfg, [...feedSet], cache);

      // Simulate to verify Hermes data is valid (parse/verify + update calls succeed).
      await client.grpcClient.simulateTransaction({
        transaction: warmTx,
        include: { effects: true },
      });
    }
  } catch (e) {
    // Hermes flaky — fall through and let the oracle probe try with stale data.
    // If that also fails the outer catch will skip the test.
    void e;
  }

  try {
    const prices = await fetchSimulatedUsdPricesForBases(client, bases, { pythCache: cache });
    if (Object.keys(prices).length === 0) {
      ctx.skip("Oracle bundle simulate failed: no base prices resolved");
      return null;
    }
    return prices;
  } catch (e) {
    ctx.skip(
      `Oracle bundle simulate failed (Hermes/Pyth): ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}

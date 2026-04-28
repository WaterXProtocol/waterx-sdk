import { Transaction } from "@mysten/sui/transactions";
import {
  PYTH_PRICE_FEED_IDS,
  PYTH_TESTNET_FEED_IDS,
  PythCache,
  updatePythPrices,
  type WaterXClient,
} from "@waterx/perp-sdk";

import type { BaseAsset } from "../../../src/constants.ts";
import { DUMMY_SENDER } from "./e2e-client.ts";
import { activeLifecycleTestBases } from "./lifecycle-test-markets.ts";
import { fetchSimulatedUsdPricesForBases } from "./oracle-simulate-multi-asset.ts";

/**
 * Hermes → Pyth update + simulate so on-chain `PriceInfoObject`s are fresh before
 * resize / `addPriceFeeds` probes. Include **collateral** feeds (USDC/USDSUI) so
 * `resolve_size` paths do not hit `err_total_weight_not_enough` (204) on stale
 * collateral aggregates.
 */
export async function warmPythHermesForBases(
  client: WaterXClient,
  cache: PythCache,
  bases: readonly BaseAsset[],
): Promise<void> {
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
    for (const col of Object.values(client.config.collaterals)) {
      const fid = feedIdTable[col.feedKey]?.replace(/^0x/, "");
      if (fid) feedSet.add(fid);
    }

    if (pythCfg && feedSet.size > 0) {
      const warmTx = new Transaction();
      warmTx.setSender(DUMMY_SENDER);
      warmTx.setGasBudget(1_200_000_000);
      await updatePythPrices(warmTx, client.grpcClient, pythCfg, [...feedSet], cache);

      await client.grpcClient.simulateTransaction({
        transaction: warmTx,
        include: { effects: true },
      });
    }
  } catch {
    /* Hermes flaky — callers retry with stale on-chain data */
  }
}

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
/**
 * Retry up to `attempts` times (fresh `PythCache` each attempt) before
 * declaring the oracle bundle unavailable. Parallel forks easily trigger
 * transient 204 `err_total_weight_not_enough` on shared Hermes / on-chain feeds.
 */
export async function lifecycleOracleUsdOrSkip(
  client: WaterXClient,
  ctx: { skip: (reason?: string) => void },
  attempts = 3,
): Promise<Record<BaseAsset, number> | null> {
  const bases = activeLifecycleTestBases();
  if (bases.length === 0) return {} as Record<BaseAsset, number>;

  let lastErrorMsg: string | null = null;
  for (let i = 0; i < Math.max(1, attempts); i++) {
    const cache = new PythCache();
    await warmPythHermesForBases(client, cache, bases);
    try {
      const prices = await fetchSimulatedUsdPricesForBases(client, bases, { pythCache: cache });
      if (Object.keys(prices).length > 0) return prices;
      lastErrorMsg = "no base prices resolved";
    } catch (e) {
      lastErrorMsg = e instanceof Error ? e.message : String(e);
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 400 + i * 600));
    }
  }
  ctx.skip(`Oracle bundle simulate failed (${attempts} attempts): ${lastErrorMsg}`);
  return null;
}

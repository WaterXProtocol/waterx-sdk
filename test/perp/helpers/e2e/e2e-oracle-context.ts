import { Transaction } from "@mysten/sui/transactions";
import { PythCache, updatePythPrices, type PerpClient } from "@waterx/sdk";

import { DUMMY_SENDER } from "./e2e-client.ts";
import { activeLifecycleTickersForClient } from "./lifecycle-test-markets.ts";
import { fetchSimulatedUsdPricesForBases } from "./oracle-simulate-multi-asset.ts";

function normalizeFeedId(hex?: string): string | undefined {
  if (!hex) return undefined;
  return hex.replace(/^0x/i, "").toLowerCase();
}

/**
 * Hermes → Pyth price update inside one simulate so `PriceInfoObject`s are touched before trading probes.
 * Uses configured `pyth_rule.feeds` for lifecycle tickers + pool collateral tickers.
 */
export async function warmPythHermesForTickers(
  client: PerpClient,
  cache: PythCache,
  tickers: readonly string[],
): Promise<void> {
  try {
    const feeds = client.config.packages.pyth_rule?.feeds ?? {};
    const feedSet = new Set<string>();
    for (const t of tickers) {
      const fid = normalizeFeedId(feeds[t]?.feed_id);
      if (fid) feedSet.add(fid);
    }
    const poolTokens = client.config.packages.wlp?.pool_tokens ?? {};
    for (const poolTicker of Object.keys(poolTokens)) {
      const fid = normalizeFeedId(feeds[poolTicker]?.feed_id);
      if (fid) feedSet.add(fid);
    }

    if (feedSet.size > 0) {
      const warmTx = new Transaction();
      warmTx.setSender(DUMMY_SENDER);
      warmTx.setGasBudget(1_200_000_000);
      // Standalone dry-run simulate, no TradingRequest to reimburse a
      // sponsor fund against — pay the Pyth update fee from tx.gas.
      await updatePythPrices(warmTx, client, [...feedSet], cache, undefined, true);
      await client.simulate(warmTx);
    }
  } catch {
    /* Hermes flaky — callers proceed with on-chain state */
  }
}

/**
 * Hint USD table for lifecycle tickers (no bucket oracle bundle).
 * Optionally warms Hermes+Pyth once per attempt via {@link warmPythHermesForTickers}.
 */
export async function lifecycleOracleUsdOrSkip(
  client: PerpClient,
  ctx: { skip: (reason?: string) => void },
  attempts = 3,
): Promise<Record<string, number> | null> {
  const tickers = activeLifecycleTickersForClient(client);
  if (tickers.length === 0) return {} as Record<string, number>;

  let lastErrorMsg: string | null = null;
  for (let i = 0; i < Math.max(1, attempts); i++) {
    const cache = new PythCache();
    await warmPythHermesForTickers(client, cache, tickers);
    try {
      const prices = await fetchSimulatedUsdPricesForBases(client, tickers, { pythCache: cache });
      if (Object.keys(prices).length > 0) return prices;
      lastErrorMsg = "no ticker prices resolved";
    } catch (e) {
      lastErrorMsg = e instanceof Error ? e.message : String(e);
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, 400 + i * 600));
    }
  }
  ctx.skip(`Oracle hint bundle failed (${attempts} attempts): ${lastErrorMsg}`);
  return null;
}

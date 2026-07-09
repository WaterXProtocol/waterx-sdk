/**
 * Read-only: deployed tickers return parsable `MarketData` with sane leverage cap.
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { MarketDataView } from "../../../../src/perp/fetch.ts";
import { getMarketData } from "../../../../src/perp/fetch.ts";
import { activeLifecycleTickersForClient } from "../../helpers/e2e/lifecycle-test-markets.ts";
import { activeE2ePersistentPerpTickers } from "../helpers/e2e-persistent-state.ts";
import { client, clientInit } from "../setup.ts";

function saneMarket(md: MarketDataView, ticker: string): void {
  const maxLevRaw = (md as { max_leverage_bps?: string | number | bigint }).max_leverage_bps;
  expect(BigInt(maxLevRaw ?? 0)).toBeGreaterThan(0n);
  const inactive = (md as { is_active?: boolean }).is_active === false;
  if (inactive) {
    throw new Error(`${ticker}: market inactive`);
  }
}

describe("Integration: on-chain MarketData smoke (read-only)", () => {
  beforeAll(async () => {
    await clientInit();
  });

  it("lifecycle + persistent tickers (when deployed)", async () => {
    const uniq = new Set<string>([
      ...activeLifecycleTickersForClient(client),
      ...activeE2ePersistentPerpTickers(),
    ]);
    expect(uniq.size).toBeGreaterThan(0);
    let checked = 0;
    for (const ticker of uniq) {
      if (!(ticker in (client.config.packages.waterx_perp.markets ?? {}))) continue;
      const md = await getMarketData(client, { ticker });
      saneMarket(md, ticker);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

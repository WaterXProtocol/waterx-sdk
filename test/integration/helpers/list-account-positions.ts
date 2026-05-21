import type { WaterXClient } from "../../../src/client.ts";
import type { PositionDataView } from "../../../src/fetch.ts";
import { getAccountPositions } from "../../../src/fetch.ts";
import {
  posAccountObjectAddress,
  posPositionIdBigInt,
  posSize,
} from "../../helpers/e2e/discover-on-chain-position.ts";
import { lifecycleTickerRow } from "../../helpers/e2e/lifecycle-test-markets.ts";

export type AccountPositionRow = {
  ticker: string;
  positionId: bigint;
  info: PositionDataView;
};

/**
 * Open wxa positions for `accountId` via `view::account_positions`.
 */
export async function listAccountPositionsInMarket(
  client: WaterXClient,
  accountId: string,
  ticker: string,
): Promise<AccountPositionRow[]> {
  void client.getMarket(ticker);
  const row = lifecycleTickerRow(ticker);
  const basePriceUsd = BigInt(Math.max(1, Math.round(row.approxUsdHint)));

  const positions = await getAccountPositions(client, {
    ticker,
    accountObjectAddress: accountId,
    basePriceUsd,
    collateralPriceUsd: 1n,
  });

  const want = accountId.replace(/^0x/i, "").toLowerCase();
  const out: AccountPositionRow[] = [];
  for (const p of positions) {
    const addr = posAccountObjectAddress(p).replace(/^0x/i, "").toLowerCase();
    if (addr !== want) continue;
    const sz = posSize(p);
    if (sz <= 0n) continue;
    out.push({
      ticker,
      positionId: posPositionIdBigInt(p),
      info: p,
    });
  }
  return out;
}

export async function listAllConfiguredAccountPositions(
  client: WaterXClient,
  accountId: string,
  tickers: readonly string[],
): Promise<AccountPositionRow[]> {
  const rows: AccountPositionRow[] = [];
  for (const t of tickers) {
    if (!client.config.packages.waterx_perp.markets?.[t]) continue;
    const part = await listAccountPositionsInMarket(client, accountId, t);
    rows.push(...part);
  }
  return rows;
}

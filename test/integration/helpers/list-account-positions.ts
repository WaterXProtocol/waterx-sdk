import type { WaterXClient } from "../../../src/client.ts";
import type { BaseAsset } from "../../../src/constants.ts";
import { getMarketSummary, getPosition, positionExists } from "../../../src/fetch.ts";
import type { PositionDataView } from "../../../src/view-types.ts";

function sameAddress(a: string, b: string): boolean {
  const na = a.replace(/^0x/i, "").toLowerCase();
  const nb = b.replace(/^0x/i, "").toLowerCase();
  return na === nb;
}

/** Avoid unbounded simulate loops on busy markets; raise if you know position_id is higher. */
const DEFAULT_MAX_POSITION_IDS_TO_SCAN = 4096;

export type AccountPositionRow = {
  base: BaseAsset;
  positionId: number;
  info: PositionDataView;
};

/**
 * Lists open (non-zero size) positions for `accountId` in one market by scanning position ids.
 * Scans at most `maxScan` ids (0 .. min(nextPositionId, maxScan) - 1).
 */
export async function listAccountPositionsInMarket(
  client: WaterXClient,
  accountId: string,
  base: BaseAsset,
  maxScan: number = DEFAULT_MAX_POSITION_IDS_TO_SCAN,
): Promise<AccountPositionRow[]> {
  const entry = client.getMarketEntry(base);
  const summary = await getMarketSummary(client, entry.marketId, entry.baseType);
  const next = Number(summary.nextPositionId);
  const limit = Math.min(next, maxScan);
  const rows: AccountPositionRow[] = [];

  for (let pid = 0; pid < limit; pid++) {
    const exists = await positionExists(client, entry.marketId, pid, entry.baseType);
    if (!exists) continue;
    const info = await getPosition(client, entry.marketId, pid, entry.baseType);
    if (!sameAddress(info.accountObjectAddress, accountId)) continue;
    if (info.size === 0n) continue;
    rows.push({ base, positionId: pid, info });
  }

  return rows;
}

/** Smallest `position_id` among rows (all returned rows are non-zero size). */
export function minOpenPositionId(rows: AccountPositionRow[]): number | undefined {
  if (!rows.length) return undefined;
  return Math.min(...rows.map((r) => r.positionId));
}

/** All configured markets; same scan cap per market. */
export async function listAllAccountPositions(
  client: WaterXClient,
  accountId: string,
  maxScanPerMarket: number = DEFAULT_MAX_POSITION_IDS_TO_SCAN,
): Promise<AccountPositionRow[]> {
  const bases = Object.keys(client.config.markets) as BaseAsset[];
  const all: AccountPositionRow[] = [];
  for (const base of bases) {
    const part = await listAccountPositionsInMarket(client, accountId, base, maxScanPerMarket);
    all.push(...part);
  }
  return all;
}

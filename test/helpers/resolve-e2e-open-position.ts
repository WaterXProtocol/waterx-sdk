import type { WaterXClient } from "../../src/client.ts";
import type { BaseAsset } from "../../src/constants.ts";
import {
  getAccountPositions,
  getMarketSummary,
  getPosition,
  positionExists,
} from "../../src/fetch.ts";
import type { PositionDataView } from "../../src/view-types.ts";
import { readLocalFixedPositionIdsForAccount } from "./e2e-fixed-positions-persist.ts";
import { E2E_FIXED_OPEN_POSITION_IDS } from "./e2e-fixed-positions.ts";

function sameAccountAddress(a: string, b: string): boolean {
  return a.replace(/^0x/i, "").toLowerCase() === b.replace(/^0x/i, "").toLowerCase();
}

const ENV_KEY_BY_BASE: Partial<Record<BaseAsset, string>> = {
  BTC: "E2E_FIXED_BTC_POSITION_ID",
  ETH: "E2E_FIXED_ETH_POSITION_ID",
  SOL: "E2E_FIXED_SOL_POSITION_ID",
  SUI: "E2E_FIXED_SUI_POSITION_ID",
  DEEP: "E2E_FIXED_DEEP_POSITION_ID",
  WAL: "E2E_FIXED_WAL_POSITION_ID",
  AAPLX: "E2E_FIXED_AAPLX_POSITION_ID",
  GOOGLX: "E2E_FIXED_GOOGLX_POSITION_ID",
  METAX: "E2E_FIXED_METAX_POSITION_ID",
  NVDAX: "E2E_FIXED_NVDAX_POSITION_ID",
  QQQX: "E2E_FIXED_QQQX_POSITION_ID",
  SPYX: "E2E_FIXED_SPYX_POSITION_ID",
  TSLAX: "E2E_FIXED_TSLAX_POSITION_ID",
};

function fixedPositionIdForBase(base: BaseAsset, accountId: string): number | undefined {
  const fromTable = E2E_FIXED_OPEN_POSITION_IDS[base];
  if (fromTable != null && Number.isFinite(fromTable)) return fromTable;

  const envName = ENV_KEY_BY_BASE[base];
  if (envName) {
    const raw = process.env[envName]?.trim();
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }

  const fromLocal = readLocalFixedPositionIdsForAccount(accountId)[base];
  if (fromLocal != null && Number.isFinite(fromLocal)) return fromLocal;

  return undefined;
}

export type ResolveE2eOpenPositionOptions = {
  /**
   * How many latest global position ids to scan (newest first) when no fixed id matches.
   * @default 10n
   */
  recentWindow?: bigint;
  /**
   * When set, only accept positions with `collateralAmount > minCollateralExclusive`
   * (e.g. withdraw collateral dry-run).
   */
  minCollateralExclusive?: bigint;
};

/**
 * Resolve an open position for e2e simulate: optional pinned id from
 * {@link E2E_FIXED_OPEN_POSITION_IDS}, `E2E_FIXED_<BASE>_POSITION_ID`, then
 * `.e2e-fixed-positions.local.json` (same `accountId`), then fallback scan.
 */
export async function resolveE2eOpenPosition(
  client: WaterXClient,
  accountId: string,
  base: BaseAsset,
  options?: ResolveE2eOpenPositionOptions,
): Promise<{ positionId: bigint; info: PositionDataView } | null> {
  const recentWindow = options?.recentWindow ?? 10n;
  const minCol = options?.minCollateralExclusive;

  const m = client.getMarketEntry(base);
  const { marketId, baseType } = m;

  const tryId = async (
    id: bigint,
  ): Promise<{ positionId: bigint; info: PositionDataView } | null> => {
    if (!(await positionExists(client, marketId, id, baseType))) return null;
    const info = await getPosition(client, marketId, id, baseType);
    if (!sameAccountAddress(info.accountObjectAddress, accountId)) return null;
    if (info.size <= 0n) return null;
    if (minCol !== undefined && info.collateralAmount <= minCol) return null;
    return { positionId: id, info };
  };

  const fixed = fixedPositionIdForBase(base, accountId);
  if (fixed !== undefined) {
    const hit = await tryId(BigInt(fixed));
    if (hit) return hit;
  }

  // Use view::get_account_positions (goes through registry) with dummy price=1.
  // Position IDs and sizes are accurate regardless of price; only PnL fields are affected.
  try {
    const positions = await getAccountPositions(client, base, accountId, 1, 1);
    const sorted = [...positions].sort((a, b) =>
      a.positionId > b.positionId ? -1 : a.positionId < b.positionId ? 1 : 0,
    );
    for (const p of sorted) {
      if (p.size <= 0n) continue;
      if (minCol !== undefined && p.collateralAmount <= minCol) continue;
      return { positionId: p.positionId, info: p };
    }
  } catch {
    // Fallback to global scan if view call fails
  }

  const summary = await getMarketSummary(client, marketId, baseType);
  const next = summary.nextPositionId;
  if (next <= 0n) return null;

  let scanned = 0n;
  for (let id = next - 1n; id >= 0n && scanned < recentWindow; id--, scanned++) {
    const hit = await tryId(id);
    if (hit) return hit;
  }
  return null;
}

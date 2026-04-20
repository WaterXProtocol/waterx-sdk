import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { WaterXClient } from "../../src/client.ts";
import type { BaseAsset } from "../../src/constants.ts";
import { listAllAccountPositions } from "../integration/helpers/list-account-positions.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Local snapshot file; auto-updated by preflight / prepare / bootstrap (non-CI). */
export const E2E_FIXED_POSITIONS_LOCAL_JSON = path.join(
  repoRoot,
  ".e2e-fixed-positions.local.json",
);

export type E2eFixedPositionsLocalV1 = {
  version: 1;
  accountId: string;
  positions: Partial<Record<BaseAsset, number>>;
  disclaimer?: string;
};

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
}

/**
 * Pinned ids from local file — only if `accountId` matches (avoids wrong wallet after switch).
 */
export function readLocalFixedPositionIdsForAccount(
  accountId: string,
): Partial<Record<BaseAsset, number>> {
  if (!existsSync(E2E_FIXED_POSITIONS_LOCAL_JSON)) return {};
  try {
    const j = JSON.parse(
      readFileSync(E2E_FIXED_POSITIONS_LOCAL_JSON, "utf8"),
    ) as E2eFixedPositionsLocalV1;
    if (j.version !== 1 || !j.positions || typeof j.positions !== "object") return {};
    if (!j.accountId || normAddr(j.accountId) !== normAddr(accountId)) return {};
    return j.positions;
  } catch {
    return {};
  }
}

/** Skip auto-write in GitHub Actions or when `E2E_NO_LOCAL_FIXED_POSITIONS=1`. */
export function shouldAutoPersistLocalFixedPositions(): boolean {
  if (process.env.GITHUB_ACTIONS === "true") return false;
  if (process.env.E2E_NO_LOCAL_FIXED_POSITIONS === "1") return false;
  return true;
}

const DEFAULT_SCAN = 8192;

/**
 * Refresh `.e2e-fixed-positions.local.json` from chain (open positions only).
 * If a previously recorded id disappears, logs a warning (possible close / liquidation / scan cap).
 */
export async function persistE2eFixedPositionsLocal(opts: {
  client: WaterXClient;
  accountId: string;
  quiet?: boolean;
  maxScanPerMarket?: number;
  /**
   * When set, skips `listAllAccountPositions` (avoids huge RPC fan-out). Caller must ensure ids
   * are correct for their scan depth; use full scan or `E2E_LOCAL_FIXED_SCAN_MAX` if ids can exceed
   * the bootstrap/preflight scan cap.
   */
  positionsKnown?: Partial<Record<BaseAsset, number>>;
}): Promise<void> {
  const { accountId, quiet, positionsKnown } = opts;
  const maxScan =
    opts.maxScanPerMarket ?? Number(process.env.E2E_LOCAL_FIXED_SCAN_MAX ?? String(DEFAULT_SCAN));

  let before: Partial<Record<BaseAsset, number>> = {};
  if (existsSync(E2E_FIXED_POSITIONS_LOCAL_JSON)) {
    try {
      const prev = JSON.parse(
        readFileSync(E2E_FIXED_POSITIONS_LOCAL_JSON, "utf8"),
      ) as E2eFixedPositionsLocalV1;
      if (prev.version === 1 && normAddr(prev.accountId ?? "") === normAddr(accountId)) {
        before = prev.positions ?? {};
      }
    } catch {
      /* ignore */
    }
  }

  let positions: Partial<Record<BaseAsset, number>>;
  if (positionsKnown != null) {
    positions = { ...positionsKnown };
  } else {
    const rows = await listAllAccountPositions(opts.client, accountId, maxScan);
    positions = {};
    for (const r of rows) {
      const cur = positions[r.base];
      if (cur === undefined || r.positionId < cur) positions[r.base] = r.positionId;
    }
  }

  for (const base of Object.keys(before) as BaseAsset[]) {
    const oldId = before[base];
    const newId = positions[base];
    if (oldId != null && newId == null) {
      const scanHint =
        positionsKnown != null
          ? "ids from shallow scan — try `pnpm e2e:bootstrap-positions -- --full-local-scan` or raise E2E_LOCAL_FIXED_SCAN_MAX"
          : `raise E2E_LOCAL_FIXED_SCAN_MAX (now ${maxScan})`;
      const msg = `[e2e-fixed-local] ${base}: position_id ${oldId} no longer open — may be closed/liquidated, or ${scanHint}`;
      if (!quiet) console.warn(msg);
    } else if (oldId != null && newId != null && oldId !== newId) {
      if (!quiet)
        console.warn(`[e2e-fixed-local] ${base}: position_id changed ${oldId} → ${newId}`);
    }
  }

  const orderedPositions: Partial<Record<BaseAsset, number>> = {};
  for (const base of Object.keys(positions).sort() as BaseAsset[]) {
    const id = positions[base];
    if (id != null) orderedPositions[base] = id;
  }

  const payload: E2eFixedPositionsLocalV1 = {
    version: 1,
    accountId,
    positions: orderedPositions,
    disclaimer:
      "Auto-generated from public on-chain position ids. Safe to commit. Re-run preflight/bootstrap after closes/liquidations.",
  };

  writeFileSync(E2E_FIXED_POSITIONS_LOCAL_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  if (!quiet) {
    const detail =
      positionsKnown != null
        ? "reuse bootstrap/preflight scan (≤256 ids/market; use --full-local-scan for deep chain walk)"
        : `scan≤${maxScan}/market`;
    console.log(
      `[e2e-fixed-local] Wrote ${path.relative(repoRoot, E2E_FIXED_POSITIONS_LOCAL_JSON)} (${Object.keys(positions).length} market(s), ${detail})`,
    );
  }
}

import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "../../src/client.ts";
import type { BaseAsset } from "../../src/constants.ts";
import { buildOpenPositionTx } from "../../src/tx-builders.ts";
import {
  listAccountPositionsInMarket,
  minOpenPositionId,
} from "../integration/helpers/list-account-positions.ts";
import { assertSuccess, sleep } from "../integration/setup.ts";
import { activeE2ePersistentPerpBases, e2ePersistentPerpRow } from "./e2e-persistent-state.ts";

/** Same cap as bootstrap / prepare — avoids doubling with a deep scan. */
export const E2E_PERSISTENT_POSITION_SCAN_DEPTH = 256;

export type E2ePerpSlotLogStyle = "prepare" | "bootstrap";

type ExecBuiltTxWithCooldownRetries = (
  build: () => Promise<Transaction>,
  signer: Ed25519Keypair,
  opts?: {
    gasBudget?: number;
    maxAttempts?: number;
    retryDelayMs?: number;
    cooldownMarketIds?: string[];
  },
) => Promise<unknown>;

/**
 * Ensure one open perp per {@link activeE2ePersistentPerpBases} when missing (`force: false`),
 * or always open another when `force: true` (bootstrap-only).
 * Returns position ids seen during this run (for `persistE2eFixedPositionsLocal.positionsKnown`).
 */
export async function ensureE2ePersistentPerpSlots(opts: {
  client: WaterXClient;
  accountId: string;
  signer: Ed25519Keypair;
  dryRun: boolean;
  force: boolean;
  logStyle: E2ePerpSlotLogStyle;
  execBuiltTxWithCooldownRetries: ExecBuiltTxWithCooldownRetries;
}): Promise<Partial<Record<BaseAsset, number>>> {
  const { client, accountId, signer, dryRun, force, logStyle, execBuiltTxWithCooldownRetries } =
    opts;
  const positionsForLocal: Partial<Record<BaseAsset, number>> = {};
  const bases = activeE2ePersistentPerpBases();

  for (const base of bases) {
    let existing = await listAccountPositionsInMarket(
      client,
      accountId,
      base,
      E2E_PERSISTENT_POSITION_SCAN_DEPTH,
    );
    const recordLocalId = () => {
      const id = minOpenPositionId(existing);
      if (id !== undefined) positionsForLocal[base] = id;
    };

    if (existing.length && !force) {
      recordLocalId();
      if (logStyle === "prepare") {
        console.log(`[prepare] ${base}: open position OK (${existing.length})`);
      } else {
        console.log(
          `Skip ${base}: already ${existing.length} open position(s) (use --force to open another).`,
        );
      }
      continue;
    }

    const row = e2ePersistentPerpRow(base);
    const lev = row.simulateLeverage ?? row.leverage;
    const openParams = {
      accountId,
      base,
      isLong: row.isLong,
      leverage: lev,
      collateralAmount: row.openCollateral,
      size: row.openSize,
    };

    if (dryRun) {
      if (logStyle === "bootstrap") {
        console.log("[dry-run] Would open market base=%s params=%o", base, openParams);
      }
      continue;
    }

    const entry = client.getMarketEntry(base);
    if (logStyle === "prepare") {
      console.log(`[prepare] ${base}: opening missing e2e persistent position…`);
    }
    const result = await execBuiltTxWithCooldownRetries(
      () => buildOpenPositionTx(client, openParams),
      signer,
      { cooldownMarketIds: [entry.marketId] },
    );
    assertSuccess(result);
    const digest =
      typeof result === "object" && result !== null && "digest" in result
        ? String((result as { digest?: string }).digest ?? "")
        : "";
    if (logStyle === "prepare") {
      console.log(`[prepare] opened ${base} digest=${digest}`);
    } else {
      console.log(`Opened ${base} digest=${digest}`);
    }
    await sleep(2000);
    existing = await listAccountPositionsInMarket(
      client,
      accountId,
      base,
      E2E_PERSISTENT_POSITION_SCAN_DEPTH,
    );
    recordLocalId();
  }

  return positionsForLocal;
}

/**
 * Closes **one** perp position — can remove an e2e **persistent** slot if it picks the newest id.
 * Prefer `WATERX_INTEGRATION_CLOSE_BASE` + `WATERX_INTEGRATION_POSITION_ID` to target a scratch id.
 * Skipped unless `WATERX_INTEGRATION_CLOSE_ONE_POSITION=1`.
 */
import { getAccountsByOwner } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import type { BaseAsset } from "../../../src/constants.ts";
import { getPosition, positionExists } from "../../../src/fetch.ts";
import { buildClosePositionTx } from "../../../src/tx-builders.ts";
import { activeLifecycleTestBases } from "../../helpers/lifecycle-test-markets.ts";
import { listAccountPositionsInMarket } from "../helpers/list-account-positions.ts";
import {
  assertSuccess,
  client,
  execBuiltTxWithCooldownRetries,
  extractEvent,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../setup.ts";

function sameAddress(a: string, b: string): boolean {
  const na = a.replace(/^0x/i, "").toLowerCase();
  const nb = b.replace(/^0x/i, "").toLowerCase();
  return na === nb;
}

function parseBaseAsset(raw: string | undefined): BaseAsset | undefined {
  if (!raw?.trim()) return undefined;
  const u = raw.trim().toUpperCase();
  const bases: BaseAsset[] = ["BTC", "ETH", "SOL", "SUI", "DEEP", "WAL"];
  return bases.includes(u as BaseAsset) ? (u as BaseAsset) : undefined;
}

/** Same order as {@link activeLifecycleTestBases} — first open position wins. */
const AUTO_CLOSE_SCAN_ORDER: BaseAsset[] = activeLifecycleTestBases();

type SkipCtx = { skip: (reason?: string) => void };

async function tryPinnedPosition(
  ctx: SkipCtx,
  b: BaseAsset,
  pinnedRaw: string,
  accountId: string,
): Promise<{ base: BaseAsset; positionId: number } | null> {
  const pid = Number.parseInt(pinnedRaw, 10);
  if (!Number.isFinite(pid) || pid < 0) {
    throw new Error(`Invalid position id for ${b}: ${pinnedRaw}`);
  }
  const entry = client.getMarketEntry(b);
  const ex = await positionExists(client, entry.marketId, pid, entry.baseType);
  if (!ex) {
    ctx.skip(`Pinned position ${pid} does not exist on ${b} market.`);
    return null;
  }
  const info = await getPosition(client, entry.marketId, pid, entry.baseType);
  if (!sameAddress(info.accountObjectAddress, accountId) || info.size === 0n) {
    ctx.skip(`Pinned position ${pid} is not an open position for this account on ${b}.`);
    return null;
  }
  return { base: b, positionId: pid };
}

/**
 * WATERX_INTEGRATION_CLOSE_BASE + optional WATERX_INTEGRATION_POSITION_ID,
 * or legacy WATERX_INTEGRATION_BTC_POSITION_ID (BTC pin, optional),
 * or auto-scan configured lifecycle bases (see `test/helpers/lifecycle-test-markets.ts`).
 */
async function resolvePositionToClose(
  ctx: SkipCtx,
  accountId: string,
): Promise<{ base: BaseAsset; positionId: number } | null> {
  const closeBaseEnv = parseBaseAsset(process.env.WATERX_INTEGRATION_CLOSE_BASE);
  const genericPin = process.env.WATERX_INTEGRATION_POSITION_ID?.trim();
  const legacyBtcPin = process.env.WATERX_INTEGRATION_BTC_POSITION_ID?.trim();

  if (closeBaseEnv) {
    if (genericPin) {
      return tryPinnedPosition(ctx, closeBaseEnv, genericPin, accountId);
    }
    const rows = await listAccountPositionsInMarket(client, accountId, closeBaseEnv);
    if (!rows.length) {
      ctx.skip(
        `No open ${closeBaseEnv} position — open one or set WATERX_INTEGRATION_POSITION_ID.`,
      );
      return null;
    }
    rows.sort((a, b) => b.positionId - a.positionId);
    return { base: closeBaseEnv, positionId: rows[0]!.positionId };
  }

  if (legacyBtcPin) {
    return tryPinnedPosition(ctx, "BTC", legacyBtcPin, accountId);
  }

  for (const b of AUTO_CLOSE_SCAN_ORDER) {
    const rows = await listAccountPositionsInMarket(client, accountId, b);
    if (rows.length) {
      rows.sort((a, c) => c.positionId - a.positionId);
      return { base: b, positionId: rows[0]!.positionId };
    }
  }

  ctx.skip(
    "No open perp position in configured lifecycle markets (scan cap applies). " +
      "Open a position, or set WATERX_INTEGRATION_CLOSE_BASE (+ optional WATERX_INTEGRATION_POSITION_ID), " +
      "or legacy WATERX_INTEGRATION_BTC_POSITION_ID if closing BTC. " +
      "Edit `test/helpers/lifecycle-test-markets.ts` to change which bases are scanned.",
  );
  return null;
}

const integrationCloseOneEnabled =
  isIntegrationTraderConfigured() &&
  process.env.WATERX_INTEGRATION_CLOSE_ONE_POSITION?.trim() === "1";

describe.skipIf(!integrationCloseOneEnabled)(
  "Integration: close one open perp position (testnet, opt-in)",
  () => {
    it("closes a single open position (env-pinned, or first found across markets)", async (ctx) => {
      const trader = loadIntegrationTraderKeypair();
      const owner = trader.getPublicKey().toSuiAddress();

      const fromEnv = process.env.WATERX_INTEGRATION_ACCOUNT_ID?.trim();
      const accounts = fromEnv ? [] : await getAccountsByOwner(client, owner);
      const accountId = fromEnv ?? accounts[0]?.accountId;

      if (!accountId) {
        ctx.skip(
          "No UserAccount — set WATERX_INTEGRATION_ACCOUNT_ID or create an account for this wallet.",
        );
        return;
      }

      if (fromEnv) {
        const ok = (await getAccountsByOwner(client, owner)).some((a) => a.accountId === fromEnv);
        if (!ok) {
          throw new Error(
            `WATERX_INTEGRATION_ACCOUNT_ID=${fromEnv} is not listed for owner ${owner}.`,
          );
        }
      }

      const resolved = await resolvePositionToClose(ctx, accountId);
      if (!resolved) return;

      const { base, positionId } = resolved;
      const marketId = client.getMarketEntry(base).marketId;
      const result = await execBuiltTxWithCooldownRetries(
        () =>
          buildClosePositionTx(client, {
            accountId,
            base,
            positionId,
            acceptablePrice: 0n,
          }),
        trader,
        { cooldownMarketIds: [marketId] },
      );
      assertSuccess(result);
      const ev = extractEvent(result, "PositionClosed");
      expect(ev).toBeDefined();
    }, 300_000);
  },
);

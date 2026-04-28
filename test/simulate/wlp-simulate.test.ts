/** E2E: WLP builders simulate — sender from `getRedeemRequests` recipient when available. */
import {
  buildCancelRedeemWlpTx,
  buildRequestRedeemWlpTx,
  buildSettleRedeemWlpTx,
  getRedeemRequests,
} from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import type { CollateralAsset } from "../../src/constants.ts";
import {
  discoverFundedProbe,
  discoverWalletOwnerWithWlpCoin,
} from "../helpers/e2e/discover-on-chain-position.ts";
import { client, PROBE_MIN_ACCOUNT_USDC } from "../helpers/e2e/e2e-client.ts";
import { getWlpMinDepositForCollateral } from "../helpers/e2e/fetch-read-helpers-for-tests.ts";
import {
  assertSimulateSuccess,
  parseSimulateFailure,
  simulateWithTransientRetry,
} from "../helpers/e2e/simulate-assertions.ts";
import { buildMintWlpSimulateTx } from "../helpers/e2e/wlp-mint-simulate-tx.ts";

/** `waterx_perp::error::ERedeemNotReady` (407) or `ENoRedeemRequest` (408). */
const ERR_REDEEM_NOT_READY_ABORT = 407;
const ERR_NO_REDEEM_REQUEST_ABORT = 408;
/** Pool-side deposit gate; common on shared mainnet when min mint / liquidity moves. */
const ERR_INSUFFICIENT_DEPOSIT_ABORT = 406;

async function getNextRedeemId(): Promise<bigint> {
  const cfg = client.config;
  const poolObj = await client.grpcClient.getObject({
    objectId: cfg.wlpPool,
    include: { json: true },
  });
  const poolJson = poolObj.object?.json as Record<string, unknown> | null | undefined;
  if (!poolJson) return 0n;
  const fields =
    (poolJson.fields as Record<string, unknown> | undefined) ??
    (poolJson as Record<string, unknown>);
  const raw = fields.next_redeem_id ?? fields.nextRedeemId;
  if (raw === undefined || raw === null) return 0n;
  try {
    return BigInt(String(raw));
  } catch {
    return 0n;
  }
}

async function redeemQueueRecipient(): Promise<string | null> {
  const { requests } = await getRedeemRequests(client, 0, 50);
  return requests[0]?.recipient ?? null;
}

/**
 * Pick a sender / recipient for `buildMintWlpTx` simulate for a **specific** WLP collateral.
 *
 * `mint_wlp` spends **wallet** `Coin<collateral>` (not account TTO). The same address
 * can qualify for USDC mint (probe + USDC wallet) but hold **no** wallet USDSUI, so
 * we must gate on {@link getWlpMinDepositForCollateral} + `listCoins` for **that**
 * coin type — not USDC-only heuristics.
 *
 * Order (each step requires merged wallet balance ≥ pool `min_deposit` for `collateral`):
 *
 *   1. `WATERX_E2E_WLP_MINT_RECIPIENT` when it satisfies the check for this collateral.
 *   2. Funded probe owner (TTO USDC via discovery is unrelated; wallet row must match).
 *   3. Redeem-queue recipient when their **wallet** holds enough of this collateral.
 */
async function walletMergedRawTotal(owner: string, coinType: string): Promise<bigint> {
  const { objects } = await client.listCoins({ owner, coinType });
  return objects.reduce((s, o) => s + BigInt(o.balance), 0n);
}

async function mintSenderCandidateForCollateral(
  collateral: CollateralAsset,
): Promise<string | null> {
  const minDeposit = await getWlpMinDepositForCollateral(client, collateral);
  if (minDeposit <= 0n) return null;
  const coinType = client.getCollateral(collateral).type;

  const walletMeetsMin = async (owner: string | null | undefined): Promise<boolean> => {
    if (!owner) return false;
    const wallet = await walletMergedRawTotal(owner, coinType);
    return wallet >= minDeposit;
  };

  const envOverride = process.env.WATERX_E2E_WLP_MINT_RECIPIENT?.trim();
  if (envOverride && (await walletMeetsMin(envOverride))) return envOverride;

  try {
    const probe = await discoverFundedProbe(client, {
      minAccountUsdcBalance: PROBE_MIN_ACCOUNT_USDC,
    });
    if (probe && (await walletMeetsMin(probe.ownerAddress))) return probe.ownerAddress;
  } catch {
    /* ignore — fall back to redeem queue recipient */
  }

  const redeemRecipient = await redeemQueueRecipient();
  if (redeemRecipient && (await walletMeetsMin(redeemRecipient))) return redeemRecipient;

  return null;
}

const collateralAssets = client.getCollateralAssets().map((r) => r.asset) as CollateralAsset[];

describe("WLP SDK builders (simulate) — mint (opt-in skip)", () => {
  for (const collateral of collateralAssets) {
    it(`buildMintWlpTx — ${collateral} (mergeCoins + split on-chain min_deposit)`, async (ctx) => {
      const recipient = await mintSenderCandidateForCollateral(collateral);
      if (!recipient) {
        ctx.skip(
          `No WLP mint sender for ${collateral}: no address with wallet coins ≥ pool min_deposit (env override if set, funded probe owner, redeem-queue recipient).`,
        );
        return;
      }

      const c = client.getCollateral(collateral);
      const { objects } = await client.listCoins({ owner: recipient, coinType: c.type });
      const walletCoins = objects.map((o) => ({
        objectId: o.objectId,
        balance: BigInt(o.balance),
      }));
      const total = walletCoins.reduce((s, row) => s + row.balance, 0n);
      let tx;
      try {
        tx = await buildMintWlpSimulateTx(client, {
          recipient,
          collateral,
          walletCoins,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("min_deposit")) {
          ctx.skip(`WLP mint simulate: ${msg}`);
          return;
        }
        throw e;
      }
      const result = await simulateWithTransientRetry(() => client.simulate(tx));
      const fail = parseSimulateFailure(result);
      if (fail?.abortCode === String(ERR_INSUFFICIENT_DEPOSIT_ABORT)) {
        ctx.skip(
          `WLP mint: err_insufficient_deposit (${ERR_INSUFFICIENT_DEPOSIT_ABORT}) — split amount still below pool min_deposit or other pool gate (${collateral}).`,
        );
        return;
      }
      assertSimulateSuccess(result, 4, { transaction: tx });
    }, 90_000);
  }
});

describe("WLP SDK builders (simulate) — request + cancel", () => {
  for (const collateral of collateralAssets) {
    it(`buildRequestRedeemWlpTx + cancel — redeem ${collateral}`, async (ctx) => {
      const recipient =
        (await discoverWalletOwnerWithWlpCoin(client, {
          probeMinAccountUsdc: PROBE_MIN_ACCOUNT_USDC,
        })) ?? (await redeemQueueRecipient());
      if (!recipient) {
        ctx.skip(
          "No WLP redeem sender (WATERX_E2E_WLP_REDEEM_OWNER / funded probe / redeem-queue with wallet WLP).",
        );
        return;
      }

      const { objects: wlpCoins } = await client.listCoins({
        owner: recipient,
        coinType: client.config.wlpType,
      });
      if (!wlpCoins.length) {
        ctx.skip(`No wallet-level WLP at ${recipient.slice(0, 12)}…`);
        return;
      }

      const nextRedeemId = await getNextRedeemId();
      const tx = await buildRequestRedeemWlpTx(client, {
        lpCoin: wlpCoins[0]!.objectId,
        collateral,
        recipient,
      });
      buildCancelRedeemWlpTx(client, {
        requestId: nextRedeemId,
        tx,
      });
      tx.setSender(recipient);
      const result = await simulateWithTransientRetry(() => client.simulate(tx));
      assertSimulateSuccess(result, 3, { transaction: tx });
    }, 90_000);
  }
});

describe("buildSettleRedeemWlpTx (state-dependent simulate)", () => {
  for (const collateral of collateralAssets) {
    it(`settle — ${collateral} (407/408 or success)`, async (ctx) => {
      const recipient = await redeemQueueRecipient();
      if (!recipient) {
        ctx.skip("No redeem-queue recipient.");
        return;
      }

      const nextRedeemId = await getNextRedeemId();
      if (nextRedeemId <= 0n) {
        ctx.skip("No redeem requests ever created.");
        return;
      }
      const candidateId = nextRedeemId - 1n;

      const tx = await buildSettleRedeemWlpTx(client, { requestId: candidateId, collateral });
      tx.setSender(recipient);
      const result = await simulateWithTransientRetry(() => client.simulate(tx));
      try {
        assertSimulateSuccess(result, 4, {
          transaction: tx,
          allowFailedTransactionMoveAbort: {
            abortCode: ERR_REDEEM_NOT_READY_ABORT,
            locationIncludes: "err_redeem_not_ready",
          },
        });
      } catch {
        assertSimulateSuccess(result, 4, {
          transaction: tx,
          allowFailedTransactionMoveAbort: {
            abortCode: ERR_NO_REDEEM_REQUEST_ABORT,
            locationIncludes: "err_no_redeem_request",
          },
        });
      }
    }, 60_000);
  }
});

describe("WLP SDK builders (simulate) — sanity", () => {
  it("config lists at least one collateral for WLP", () => {
    expect(collateralAssets.length).toBeGreaterThan(0);
  });
});

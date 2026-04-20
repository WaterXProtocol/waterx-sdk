/** E2E: WLP builders simulate coverage — all configured collaterals (`WaterXClient.getCollateralAssets`). */
import {
  buildCancelRedeemWlpTx,
  buildMintWlpTx,
  buildRequestRedeemWlpTx,
  buildSettleRedeemWlpTx,
} from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import type { CollateralAsset } from "../../src/constants.ts";
import { e2eWalletCollateralMinForMintSimulate } from "../helpers/e2e-wlp-readiness.ts";
import { INTEGRATION_REFERENCE_WALLET_ADDRESS as OWNER } from "../helpers/integration-reference-wallet.ts";
import { assertSimulateSuccess } from "../helpers/simulate-assertions.ts";
import { client } from "../helpers/testnet.ts";

/** `waterx_perp::error::ERedeemNotReady` (407) or `ENoRedeemRequest` (408). */
const ERR_REDEEM_NOT_READY_ABORT = 407;
const ERR_NO_REDEEM_REQUEST_ABORT = 408;

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

const collateralAssets = client.getCollateralAssets().map((r) => r.asset) as CollateralAsset[];

describe("WLP SDK builders (simulate) — per collateral", () => {
  for (const collateral of collateralAssets) {
    it(`buildMintWlpTx — ${collateral} (wallet coin)`, async (ctx) => {
      const c = client.getCollateral(collateral);
      const minBal = e2eWalletCollateralMinForMintSimulate(collateral);
      const { objects } = await client.listCoins({
        owner: OWNER,
        coinType: c.type,
      });
      const usable = objects.find((o) => BigInt(o.balance) >= minBal);
      if (!usable) {
        ctx.skip(
          `No wallet-level ${collateral} coin ≥ ${minBal} at ${OWNER}. ` +
            `Run \`pnpm e2e:prepare\` or fund the wallet (not UserAccount TTO).`,
        );
        return;
      }

      const tx = await buildMintWlpTx(client, {
        depositCoin: usable.objectId,
        recipient: OWNER,
        collateral,
      });
      tx.setSender(OWNER);
      const result = await client.simulate(tx);
      assertSimulateSuccess(result, 4, { transaction: tx });
    }, 90_000);

    it(`buildRequestRedeemWlpTx + cancel — redeem ${collateral}`, async (ctx) => {
      const cfg = client.config;
      const { objects: wlpCoins } = await client.listCoins({
        owner: OWNER,
        coinType: cfg.wlpType,
      });
      if (!wlpCoins.length) {
        ctx.skip(`No wallet-level WLP at ${OWNER}. Mint WLP first (any collateral).`);
        return;
      }

      const nextRedeemId = await getNextRedeemId();
      const tx = await buildRequestRedeemWlpTx(client, {
        lpCoin: wlpCoins[0]!.objectId,
        collateral,
        recipient: OWNER,
      });
      buildCancelRedeemWlpTx(client, {
        requestId: nextRedeemId,
        tx,
      });
      tx.setSender(OWNER);
      const result = await client.simulate(tx);
      // request_redeem + account::request + cancel_redeem — three Move calls only.
      assertSimulateSuccess(result, 3, { transaction: tx });
    }, 90_000);
  }
});

describe("buildSettleRedeemWlpTx (state-dependent simulate)", () => {
  /**
   * Chain-dependent: settle only succeeds when the target redeem request is ≥ 24h old.
   * Expected abort codes:
   * - 407 (`err_redeem_not_ready`) — request exists but cooldown not elapsed
   * - 408 (`err_no_redeem_request`) — request already settled or doesn't exist
   */
  for (const collateral of collateralAssets) {
    it(`settle — ${collateral} (407/408 or success)`, async (ctx) => {
      const nextRedeemId = await getNextRedeemId();
      if (nextRedeemId <= 0n) {
        ctx.skip(
          "No redeem requests ever created. " +
            "Run buildRequestRedeemWlpTx on-chain first, then wait 24 h.",
        );
        return;
      }
      const candidateId = nextRedeemId - 1n;

      const tx = await buildSettleRedeemWlpTx(client, { requestId: candidateId, collateral });
      tx.setSender(OWNER);
      const result = await client.simulate(tx);
      try {
        assertSimulateSuccess(result, 4, {
          transaction: tx,
          allowFailedTransactionMoveAbort: {
            abortCode: ERR_REDEEM_NOT_READY_ABORT,
            locationIncludes: "err_redeem_not_ready",
          },
        });
      } catch {
        // Also accept 408 (no redeem request) — request may have been settled already
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

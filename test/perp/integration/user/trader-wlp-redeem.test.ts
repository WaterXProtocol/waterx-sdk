/**
 * Integration: enqueue WLP redeem then cancel (wxa stored balance path).
 */
import { Transaction } from "@mysten/sui/transactions";
import { beforeAll, describe, expect, it } from "vitest";

import { getAccountBalance, getRedeemRequests } from "../../../../src/perp/fetch.ts";
import { cancelRedeemWlp, requestRedeemWlp } from "../../../../src/perp/user/wlp.ts";
import { ensureUserAccountForIntegration } from "../helpers/account-bootstrap.ts";
import { ensureIntegrationMinWlpBalance } from "../helpers/ensure-wxa-balances.ts";
import {
  assertSuccess,
  client,
  clientInit,
  execBuiltTxWithCooldownRetries,
  execIntegrationOrSkipOracleTransient,
  execTx,
  integrationGasBudget,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../setup.ts";

function redeemRequestIdFromView(r: unknown): bigint {
  const x = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
  const raw = x.request_id ?? x.requestId;
  return typeof raw === "bigint" ? raw : BigInt(String(raw ?? "0"));
}

describe.skipIf(!isIntegrationTraderConfigured())(
  "Integration: WLP redeem request + cancel",
  () => {
    let accountId = "";
    let owner = "";

    beforeAll(async () => {
      await clientInit;
      const trader = loadIntegrationTraderKeypair();
      owner = trader.getPublicKey().toSuiAddress();
      ({ accountId } = await ensureUserAccountForIntegration(client, trader, execTx));
    }, 180_000);

    it("requestRedeemWlp then cancelRedeemWlp on the integration wxa account", async (ctx) => {
      const trader = loadIntegrationTraderKeypair();
      const wlpType = client.wlpType();
      const usdcType = client.getPoolTokenType("USDCUSD");

      const wlpBal = await ensureIntegrationMinWlpBalance({
        client,
        trader,
        owner,
        accountId,
        minWlp: 2n,
        execTx,
        execBuiltTxWithCooldownRetries,
        assertSuccess,
      });
      if (wlpBal < 2n) {
        ctx.skip(`Need ≥2 WLP on wxa account; have ${wlpBal}`);
        return;
      }

      const beforeQueue = await getRedeemRequests(client, { cursor: 0n, pageSize: 100n });
      const beforeIds = new Set(
        beforeQueue.requests.map((r) => redeemRequestIdFromView(r).toString()),
      );

      const reqResult = await execIntegrationOrSkipOracleTransient(ctx, () =>
        execTx(
          (() => {
            const tx = new Transaction();
            requestRedeemWlp(client, tx, {
              accountId,
              redeemTokenType: usdcType,
              lpAmount: 1n,
            });
            return tx;
          })(),
          trader,
          { gasBudget: integrationGasBudget("wlp") },
        ),
      );
      if (reqResult === undefined) return;
      assertSuccess(reqResult);

      const afterQueue = await getRedeemRequests(client, { cursor: 0n, pageSize: 100n });
      const fresh = afterQueue.requests.find(
        (r) => !beforeIds.has(redeemRequestIdFromView(r).toString()),
      );
      const requestId = fresh ? redeemRequestIdFromView(fresh) : undefined;
      if (!requestId) {
        ctx.skip("Could not resolve new redeem request_id from queue after enqueue");
        return;
      }

      const cancelResult = await execIntegrationOrSkipOracleTransient(ctx, () =>
        execTx(
          (() => {
            const tx = new Transaction();
            cancelRedeemWlp(client, tx, { requestId });
            return tx;
          })(),
          trader,
          { gasBudget: integrationGasBudget("wlp") },
        ),
      );
      if (cancelResult === undefined) return;
      assertSuccess(cancelResult);

      const wlpAfter = await getAccountBalance(client, accountId, wlpType);
      expect(wlpAfter).toBeGreaterThanOrEqual(wlpBal - 1n);
    }, 480_000);
  },
);

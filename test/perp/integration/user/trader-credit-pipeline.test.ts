/**
 * Integration: native custody mint + credit withdraw enqueue (wxa CREDIT path).
 */
import { Transaction } from "@mysten/sui/transactions";
import { beforeAll, describe, expect, it } from "vitest";

import { getAccountBalance } from "../../../../src/perp/fetch.ts";
import { buildRequestCreditWithdrawTx } from "../../../../src/perp/tx-builders.ts";
import { isCreditPipelineConfigured } from "../../helpers/e2e/e2e-custody.ts";
import { ensureIntegrationMinCreditBalance } from "../../helpers/integration/ensure-credit-balance.ts";
import { ensureUserAccountForIntegration } from "../helpers/account-bootstrap.ts";
import {
  assertSuccess,
  client,
  clientInit,
  execIntegrationOrSkipInsufficientSui,
  execTx,
  integrationGasBudget,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../setup.ts";

const WITHDRAW_AMOUNT = 500n;
const MIN_CREDIT = 2_000n;

describe.skipIf(!isIntegrationTraderConfigured())(
  "Integration: credit pipeline (custody mint + native withdraw enqueue)",
  () => {
    let accountId = "";
    let owner = "";
    let assetType = "";

    beforeAll(async () => {
      await clientInit;
      if (!isCreditPipelineConfigured(client)) return;
      assetType = client.getNativeAssets()[0]?.type ?? "";
      const trader = loadIntegrationTraderKeypair();
      owner = trader.getPublicKey().toSuiAddress();
      ({ accountId } = await ensureUserAccountForIntegration(client, trader, execTx));
    }, 180_000);

    it("mints CREDIT via mintCreditToAccount when wxa balance is low", async (ctx) => {
      if (!isCreditPipelineConfigured(client)) {
        ctx.skip("waterx_credit / native_custody not in deployment config");
        return;
      }
      if (!assetType) {
        ctx.skip("No native custody backing asset in config");
        return;
      }

      const trader = loadIntegrationTraderKeypair();
      const creditType = client.creditType();
      const before = await getAccountBalance(client, accountId, creditType);

      const after = await ensureIntegrationMinCreditBalance({
        client,
        trader,
        owner,
        accountId,
        minCredit: MIN_CREDIT,
        execTx,
        assertSuccess,
      });

      expect(after).toBeGreaterThanOrEqual(before);
      expect(after).toBeGreaterThanOrEqual(MIN_CREDIT);
    }, 300_000);

    it("buildRequestCreditWithdrawTx native route enqueues from wxa CREDIT", async (ctx) => {
      if (!isCreditPipelineConfigured(client)) {
        ctx.skip("waterx_credit / native_custody not in deployment config");
        return;
      }
      if (!client.config.packages.withdrawal_queue?.queue) {
        ctx.skip("withdrawal_queue.queue not in config");
        return;
      }
      if (!assetType) {
        ctx.skip("No native custody backing asset in config");
        return;
      }

      const trader = loadIntegrationTraderKeypair();
      const creditType = client.creditType();
      const bal = await ensureIntegrationMinCreditBalance({
        client,
        trader,
        owner,
        accountId,
        minCredit: MIN_CREDIT,
        execTx,
        assertSuccess,
      });
      if (bal < WITHDRAW_AMOUNT) {
        ctx.skip(`Need ≥${WITHDRAW_AMOUNT} CREDIT on wxa; have ${bal}`);
        return;
      }

      const before = await getAccountBalance(client, accountId, creditType);
      const tx = buildRequestCreditWithdrawTx(client, {
        accountId,
        amount: WITHDRAW_AMOUNT,
        recipient: owner,
        route: { kind: "native", assetType },
      });

      const result = await execIntegrationOrSkipInsufficientSui(
        ctx,
        () => execTx(tx, trader, { gasBudget: integrationGasBudget("creditWithdraw") }),
        owner,
      );
      if (result === undefined) return;
      assertSuccess(result);

      const after = await getAccountBalance(client, accountId, creditType);
      expect(after).toBeLessThanOrEqual(before - WITHDRAW_AMOUNT);
    }, 300_000);
  },
);

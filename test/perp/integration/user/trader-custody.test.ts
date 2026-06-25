/**
 * Integration: native custody mint CREDIT into wxa account (wallet backing asset → CREDIT balance).
 */
import { Transaction } from "@mysten/sui/transactions";
import { beforeAll, describe, expect, it } from "vitest";

import { getAccountBalance } from "../../../../src/perp/fetch.ts";
import { mintCreditToAccount } from "../../../../src/perp/user/custody.ts";
import { isCreditPipelineConfigured } from "../../helpers/e2e/e2e-custody.ts";
import {
  ensureUserAccountForIntegration,
  selectWalletCoinsCoveringAmount,
} from "../helpers/account-bootstrap.ts";
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

const CUSTODY_MINT_AMOUNT = 1_000n;

describe.skipIf(!isIntegrationTraderConfigured())(
  "Integration: native custody mintCreditToAccount",
  () => {
    let accountId = "";
    let owner = "";
    let assetType = "";
    let creditType = "";

    beforeAll(async () => {
      await clientInit;
      if (!isCreditPipelineConfigured(client)) return;
      assetType = client.getNativeAssets()[0]?.type ?? "";
      creditType = client.creditType();
      const trader = loadIntegrationTraderKeypair();
      owner = trader.getPublicKey().toSuiAddress();
      ({ accountId } = await ensureUserAccountForIntegration(client, trader, execTx));
    }, 180_000);

    it("mints CREDIT into the integration wxa account from wallet backing coin", async (ctx) => {
      const trader = loadIntegrationTraderKeypair();
      if (!isCreditPipelineConfigured(client)) {
        ctx.skip("waterx_credit / native_custody not in deployment config");
        return;
      }
      if (!assetType) {
        ctx.skip("No native custody backing asset in config");
        return;
      }

      const wallet = await selectWalletCoinsCoveringAmount(
        client,
        owner,
        assetType,
        CUSTODY_MINT_AMOUNT,
      );
      if (wallet.totalBalance < CUSTODY_MINT_AMOUNT) {
        ctx.skip(
          `Need wallet Coin<${assetType.split("::").slice(-1)[0]}> ≥ ${CUSTODY_MINT_AMOUNT}`,
        );
        return;
      }

      const before = await getAccountBalance(client, accountId, creditType);

      const tx = new Transaction();
      const [part] = tx.splitCoins(tx.object(wallet.coins[0]!.objectId), [
        tx.pure.u64(CUSTODY_MINT_AMOUNT),
      ]);
      mintCreditToAccount(client, tx, {
        accountId,
        assetCoin: part!,
        assetType,
      });

      const result = await execIntegrationOrSkipInsufficientSui(ctx, () =>
        execTx(tx, trader, { gasBudget: integrationGasBudget("custodyMint") }),
      );
      if (result === undefined) return;
      assertSuccess(result);

      const after = await getAccountBalance(client, accountId, creditType);
      expect(after).toBeGreaterThanOrEqual(before + CUSTODY_MINT_AMOUNT);
    }, 240_000);
  },
);

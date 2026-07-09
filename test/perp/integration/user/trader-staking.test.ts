/**
 * Integration: stake then unstake 1 WLP on the integration wxa account.
 */
import { Transaction } from "@mysten/sui/transactions";
import { stake, unstake } from "@waterx/sdk";
import { beforeAll, describe, expect, it } from "vitest";

import { getAccountBalance } from "../../../../src/perp/fetch.ts";
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

describe.skipIf(!isIntegrationTraderConfigured())("Integration: staking stake + unstake", () => {
  let accountId = "";
  let owner = "";

  beforeAll(async () => {
    await clientInit();
    const trader = loadIntegrationTraderKeypair();
    owner = trader.getPublicKey().toSuiAddress();
    ({ accountId } = await ensureUserAccountForIntegration(client, trader, execTx));
  }, 180_000);

  it("stakes 1 WLP then unstakes 1 WLP", async (ctx) => {
    if (!client.config.packages.waterx_staking?.pools?.WLP) {
      ctx.skip("Staking pool WLP not deployed");
      return;
    }
    const trader = loadIntegrationTraderKeypair();
    const wlpType = client.wlpType();

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

    const stakeResult = await execIntegrationOrSkipOracleTransient(ctx, () =>
      execTx(
        (() => {
          const tx = new Transaction();
          stake(client, tx, {
            accountId,
            stakeAlias: "WLP",
            stakeType: wlpType,
            stakeAmount: 1n,
            rewarderTypes: [],
          });
          return tx;
        })(),
        trader,
        { gasBudget: integrationGasBudget("staking") },
      ),
    );
    if (stakeResult === undefined) return;
    assertSuccess(stakeResult);

    const unstakeResult = await execIntegrationOrSkipOracleTransient(ctx, () =>
      execTx(
        (() => {
          const tx = new Transaction();
          unstake(client, tx, {
            accountId,
            stakeAlias: "WLP",
            stakeType: wlpType,
            withdrawalAmount: 1n,
            rewarderTypes: [],
          });
          return tx;
        })(),
        trader,
        { gasBudget: integrationGasBudget("staking") },
      ),
    );
    if (unstakeResult === undefined) return;
    assertSuccess(unstakeResult);

    const after = await getAccountBalance(client, accountId, wlpType);
    expect(after).toBeGreaterThanOrEqual(wlpBal - 1n);
  }, 480_000);
});

/**
 * E2E: native custody vault reads + CREDIT mint/burn PTB builders (wxa account path).
 */
import { Transaction } from "@mysten/sui/transactions";
import {
  buildRedeemVaaTx,
  getCustodyAssetData,
  getCustodyVaultData,
  mintCredit,
  mintCreditFromRequest,
  mintCreditToAccount,
} from "@waterx/perp-sdk";
import { beforeAll, describe, expect, it } from "vitest";

import { client, DUMMY_SENDER, e2eNetwork } from "../helpers/e2e/e2e-client.ts";
import {
  creditPipelineSkipReason,
  CUSTODY_SIMULATE_AMOUNT,
  custodyWxaSkipReason,
  e2eSimulateGasBudget,
  isCreditPipelineConfigured,
  resolveCustodyWxaRow,
  UNREGISTERED_CUSTODY_ASSET_TYPE,
} from "../helpers/e2e/e2e-custody.ts";
import { loadFundedProbe } from "../helpers/e2e/e2e-funded-probe.ts";
import {
  assertSimulateFailed,
  assertSimulateSuccessOrSkipOracleAndState,
  simulateForTestOrSkip,
  simulateWithTransientRetry,
} from "../helpers/e2e/simulate-assertions.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { selectWalletCoinsCoveringAmount } from "../integration/helpers/account-bootstrap.ts";

const creditPipeline = isCreditPipelineConfigured(client);

describe.skipIf(!creditPipeline)(`custody (${e2eNetwork})`, () => {
  const assets = creditPipeline ? client.getNativeAssets() : [];
  const primaryAsset = assets[0]?.type;

  it("getCustodyVaultData reads creditSupply", async () => {
    const vault = await getCustodyVaultData(client);
    expect(vault.creditSupply).toBeGreaterThanOrEqual(0n);
  }, 90_000);

  it("getCustodyAssetData for each configured backing asset", async () => {
    for (const asset of assets) {
      const row = await getCustodyAssetData(client, asset.type);
      expect(row.registered).toBe(true);
      expect(row.mintFeeRate).toBeGreaterThanOrEqual(0n);
      expect(row.burnFeeRate).toBeGreaterThanOrEqual(0n);
    }
  }, 120_000);

  it("mintCredit composes one moveCall against live config package ids", () => {
    if (!primaryAsset) return;
    const tx = new Transaction();
    mintCredit(client, tx, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      assetCoin: tx.object(DUMMY_SENDER),
      assetType: primaryAsset,
    });
    expect(tx.getData().commands?.length).toBe(1);
  });

  it("mintCreditFromRequest composes one moveCall", () => {
    if (!primaryAsset) return;
    const tx = new Transaction();
    mintCreditFromRequest(client, tx, {
      depositRequest: tx.object(DUMMY_SENDER),
      assetType: primaryAsset,
    });
    expect(tx.getData().commands?.length).toBe(1);
  });

  it("mintCreditToAccount chains mint + consume_deposit_direct (two moveCalls)", () => {
    if (!primaryAsset) return;
    const tx = new Transaction();
    mintCreditToAccount(client, tx, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      assetCoin: tx.object(DUMMY_SENDER),
      assetType: primaryAsset,
    });
    expect(tx.getData().commands?.length).toBe(2);
  });
});

describe.skipIf(!creditPipeline)(`custody stateful mint (${e2eNetwork})`, () => {
  let wxa: { accountId: string; owner: string } | null;
  const assetType = client.getNativeAssets()[0]?.type;

  beforeAll(async () => {
    wxa = await resolveCustodyWxaRow(client);
  }, 180_000);

  it("simulates mintCreditToAccount when wxa env + wallet backing coin exist", async (ctx) => {
    const row = wxa;
    if (!row) {
      ctx.skip(custodyWxaSkipReason());
      return;
    }
    if (!assetType) {
      ctx.skip(creditPipelineSkipReason());
      return;
    }

    const wallet = await selectWalletCoinsCoveringAmount(
      client,
      row.owner,
      assetType,
      CUSTODY_SIMULATE_AMOUNT,
    );
    if (wallet.totalBalance < CUSTODY_SIMULATE_AMOUNT) {
      ctx.skip(
        `Wallet has no Coin<backing> ≥ ${CUSTODY_SIMULATE_AMOUNT} for ${assetType.split("::").slice(-1)[0]}`,
      );
      return;
    }

    const tx = new Transaction();
    const [part] = tx.splitCoins(tx.object(wallet.coins[0]!.objectId), [
      tx.pure.u64(CUSTODY_SIMULATE_AMOUNT),
    ]);
    mintCreditToAccount(client, tx, {
      accountId: row.accountId,
      assetCoin: part!,
      assetType,
    });
    tx.setSender(row.owner);
    tx.setGasBudget(e2eSimulateGasBudget());

    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    assertSimulateSuccessOrSkipOracleAndState(ctx, sim, 1, tx);
  }, 240_000);
});

describe.skipIf(!creditPipeline)(`custody negative simulate (${e2eNetwork})`, () => {
  let wxa: { accountId: string; owner: string } | null;
  const assetType = client.getNativeAssets()[0]?.type;

  beforeAll(async () => {
    wxa = await resolveCustodyWxaRow(client);
    if (!wxa) {
      const probe = await loadFundedProbe(client);
      if (probe) wxa = { accountId: probe.accountId, owner: probe.owner };
    }
  }, 180_000);

  it("mintCreditToAccount with zero backing amount fails simulate", async (ctx) => {
    const row = wxa;
    if (!row || !assetType) {
      ctx.skip(custodyWxaSkipReason());
      return;
    }

    const wallet = await selectWalletCoinsCoveringAmount(client, row.owner, assetType, 1n);
    if (wallet.coins.length === 0) {
      ctx.skip(`No wallet Coin<backing> for zero-mint negative probe`);
      return;
    }

    const tx = new Transaction();
    const [part] = tx.splitCoins(tx.object(wallet.coins[0]!.objectId), [tx.pure.u64(0)]);
    mintCreditToAccount(client, tx, {
      accountId: row.accountId,
      assetCoin: part!,
      assetType,
    });
    tx.setSender(row.owner);
    tx.setGasBudget(e2eSimulateGasBudget());

    const sim = await simulateForTestOrSkip(ctx, () => client.simulate(tx));
    if (sim === undefined) return;
    assertSimulateFailed(sim);
  }, 240_000);

  it("mintCreditToAccount with unregistered assetType fails simulate", async (ctx) => {
    const row = wxa;
    if (!row || !assetType) {
      ctx.skip(custodyWxaSkipReason());
      return;
    }

    const wallet = await selectWalletCoinsCoveringAmount(client, row.owner, assetType, 1n);
    if (wallet.coins.length === 0) {
      ctx.skip(`No wallet Coin<backing> for unregistered-asset negative probe`);
      return;
    }

    const tx = new Transaction();
    const [part] = tx.splitCoins(tx.object(wallet.coins[0]!.objectId), [tx.pure.u64(1)]);
    mintCreditToAccount(client, tx, {
      accountId: row.accountId,
      assetCoin: part!,
      assetType: UNREGISTERED_CUSTODY_ASSET_TYPE,
    });
    tx.setSender(row.owner);
    tx.setGasBudget(e2eSimulateGasBudget());

    const sim = await simulateForTestOrSkip(ctx, () => client.simulate(tx));
    if (sim === undefined) return;
    assertSimulateFailed(sim);
  }, 240_000);
});

describe.skipIf(!creditPipeline)(`custody misc builders (${e2eNetwork})`, () => {
  // Direct burn was removed from native_custody (now witness-gated and only
  // reachable via the withdrawal queue), so there is no user-side burnCredit
  // simulate. CREDIT-exit coverage lives in the withdrawal-queue tests.
  it("buildRedeemVaaTx is exported alongside custody mint path", () => {
    const tx = buildRedeemVaaTx(client, { vaaBytes: [0x01] });
    expect(tx.getData().commands?.length).toBe(2);
  });
});

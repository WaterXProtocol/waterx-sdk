import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "~predict/client.ts";
import {
  bucketFrameworkAccountCalls,
  predictionAccountDataCalls,
  predictionCalls,
  predictionGlobalConfigCalls,
  predictionOutcomeCalls,
  predictionPositionCalls,
  predictionViewCalls,
  waterxAccountCalls,
} from "~predict/index.ts";
import { beforeAll, describe, it } from "vitest";

import { createE2eClient, predictE2eNetwork } from "../helpers/e2e-context.ts";
import { expectSimulateSuccess } from "../helpers/simulate.ts";

describe(`generated namespace smoke (${predictE2eNetwork} simulate)`, () => {
  let client: PredictClient;

  beforeAll(async () => {
    client = await createE2eClient();
  }, 30_000);

  it("predictionViewCalls.registry", async () => {
    const tx = new Transaction();
    predictionViewCalls.registry({
      package: client.packageId(),
      arguments: { marketRegistry: client.marketRegistry() },
      typeArguments: [client.settlementCoinType()],
    })(tx);
    await expectSimulateSuccess(client, tx);
  });

  it("predictionCalls.nextOrderId", async () => {
    const tx = new Transaction();
    predictionCalls.nextOrderId({
      package: client.packageId(),
      arguments: { marketRegistry: client.marketRegistry() },
      typeArguments: [client.settlementCoinType()],
    })(tx);
    await expectSimulateSuccess(client, tx);
  });

  it("waterxAccountCalls.accountCount", async () => {
    const tx = new Transaction();
    waterxAccountCalls.accountCount({
      package: client.waterxAccountPackageId(),
      arguments: {
        registry: client.accountRegistry(),
        owner: "0x0000000000000000000000000000000000000000000000000000000000000000",
      },
    })(tx);
    await expectSimulateSuccess(client, tx);
  });

  it("bucketFrameworkAccountCalls.request", async () => {
    const tx = new Transaction();
    bucketFrameworkAccountCalls.request({
      package: client.bucketFrameworkPackageId(),
    })(tx);
    await expectSimulateSuccess(client, tx);
  });

  it("predictionGlobalConfigCalls.keeperAddresses", async () => {
    const tx = new Transaction();
    predictionGlobalConfigCalls.keeperAddresses({
      package: client.packageId(),
      arguments: { globalConfig: client.globalConfigId() },
    })(tx);
    await expectSimulateSuccess(client, tx);
  });

  it("predictionAccountDataCalls.permPlaceOrder", async () => {
    const tx = new Transaction();
    predictionAccountDataCalls.permPlaceOrder({
      package: client.packageId(),
    })(tx);
    await expectSimulateSuccess(client, tx);
  });

  it("predictionOutcomeCalls.yes", async () => {
    const tx = new Transaction();
    predictionOutcomeCalls.yes({
      package: client.packageId(),
    })(tx);
    await expectSimulateSuccess(client, tx);
  });

  it("predictionPositionCalls.selectionYes", async () => {
    const tx = new Transaction();
    predictionPositionCalls.selectionYes({
      package: client.packageId(),
    })(tx);
    await expectSimulateSuccess(client, tx);
  });
});

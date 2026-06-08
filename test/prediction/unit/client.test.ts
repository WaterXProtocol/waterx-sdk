import { Transaction } from "@mysten/sui/transactions";
import { PredictClient } from "~predict/client.ts";
import { describe, expect, it, vi } from "vitest";

import { TESTNET_FIXTURE_CONFIG, TESTNET_FIXTURE_IDS } from "../fixtures/testnet-config.ts";

describe("PredictClient", () => {
  it("testnet() fetches config and wires gRPC client", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => TESTNET_FIXTURE_CONFIG,
    }));

    const client = await PredictClient.testnet({
      grpcUrl: "https://fullnode.testnet.sui.io:443",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(client.network).toBe("TESTNET");
    expect(client.config).toBe(TESTNET_FIXTURE_CONFIG);
    expect(client.packageId()).toBe(TESTNET_FIXTURE_IDS.packageId);
    expect(client.predictionAdminCap()).toBe(TESTNET_FIXTURE_IDS.predictionAdminCap);
    expect(client.grpcClient).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("mainnet() keeps the interface but requires an explicit configUrl", async () => {
    await expect(PredictClient.mainnet()).rejects.toThrow(/requires opts\.configUrl/);
  });

  it("mainnet() accepts an explicit compatible configUrl", async () => {
    const mainnetFixture = { ...TESTNET_FIXTURE_CONFIG, network: "mainnet" };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mainnetFixture,
    }));

    const client = await PredictClient.mainnet({
      configUrl: "https://waterx.test/mainnet-prediction.json",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(client.network).toBe("MAINNET");
    expect(client.config).toBe(mainnetFixture);
    expect(client.packageId()).toBe(TESTNET_FIXTURE_IDS.packageId);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("constructor accepts raw waterx-config and network separately", () => {
    const client = new PredictClient("MAINNET", TESTNET_FIXTURE_CONFIG);
    expect(client.network).toBe("MAINNET");
    expect(client.config).toBe(TESTNET_FIXTURE_CONFIG);
  });

  it("exposes waterx-sdk-style package/object accessors", () => {
    const client = new PredictClient("TESTNET", TESTNET_FIXTURE_CONFIG);
    expect(client.packageIds()).toMatchObject({
      bucket_framework: TESTNET_FIXTURE_IDS.bucketFrameworkPackageId,
      waterx_account: TESTNET_FIXTURE_IDS.waterxAccountPackageId,
      waterx_prediction: TESTNET_FIXTURE_IDS.packageId,
    });
    expect(client.bucketFrameworkPackageId()).toBe(TESTNET_FIXTURE_IDS.bucketFrameworkPackageId);
    expect(client.waterxAccountPackageId()).toBe(TESTNET_FIXTURE_IDS.waterxAccountPackageId);
    expect(client.globalConfigId()).toBe(TESTNET_FIXTURE_IDS.globalConfig);
    expect(client.marketRegistry()).toBe(TESTNET_FIXTURE_IDS.marketRegistry);
    expect(client.accountRegistry()).toBe(TESTNET_FIXTURE_IDS.accountRegistry);
    expect(client.settlementCoinType()).toBe(TESTNET_FIXTURE_IDS.settlementCoinType);
    expect(client.waterxAccountAdminCap()).toBe(TESTNET_FIXTURE_IDS.waterxAccountAdminCap);
  });

  it("delegates RPC helpers to grpcClient", async () => {
    const client = new PredictClient("TESTNET", TESTNET_FIXTURE_CONFIG);
    const grpc = {
      getObject: vi.fn().mockResolvedValue({ objectId: "0x1" }),
      getObjects: vi.fn().mockResolvedValue({ objects: [] }),
      listOwnedObjects: vi
        .fn()
        .mockResolvedValue({ objects: [], hasNextPage: false, cursor: null }),
      listCoins: vi.fn().mockResolvedValue({ objects: [], hasNextPage: false, cursor: null }),
      getBalance: vi.fn().mockResolvedValue({ coinType: "0x2::sui::SUI", balance: "0" }),
      listDynamicFields: vi.fn().mockResolvedValue({ dynamicFields: [] }),
      getDynamicField: vi.fn().mockResolvedValue({ field: "ok" }),
      waitForTransaction: vi.fn().mockResolvedValue({ digest: "abc" }),
      simulateTransaction: vi.fn().mockResolvedValue({ ok: true }),
      signAndExecuteTransaction: vi.fn().mockResolvedValue({ digest: "def" }),
    };
    (client as unknown as { grpcClient: typeof grpc }).grpcClient = grpc;

    await expect(client.getObject("0x1")).resolves.toEqual({ objectId: "0x1" });
    await expect(client.getObjects(["0x1", "0x2"])).resolves.toEqual({ objects: [] });
    await expect(client.listOwnedObjects("0xowner")).resolves.toMatchObject({ objects: [] });
    await expect(
      client.listCoins({ owner: "0xowner", coinType: "0x2::sui::SUI" }),
    ).resolves.toMatchObject({
      objects: [],
    });
    await expect(
      client.getBalance({ owner: "0xowner", coinType: "0x2::sui::SUI" }),
    ).resolves.toMatchObject({
      coinType: "0x2::sui::SUI",
    });
    await expect(client.listDynamicFields("0xparent")).resolves.toMatchObject({
      dynamicFields: [],
    });
    await expect(
      client.getDynamicField("0xparent", { type: "u64", bcs: new Uint8Array([1]) }),
    ).resolves.toEqual({ field: "ok" });
    await expect(client.waitForTransaction("digest")).resolves.toEqual({ digest: "abc" });

    const tx = new Transaction();
    await client.simulate(tx);
    expect(grpc.simulateTransaction).toHaveBeenCalledWith({
      transaction: tx,
      include: { commandResults: true },
    });

    type SignerParam = Parameters<PredictClient["signAndExecuteTransaction"]>[0]["signer"];
    const signer = { toSuiAddress: () => "0xsigner", sign: vi.fn() } as unknown as SignerParam;
    await client.signAndExecuteTransaction({ signer, transaction: tx, include: { effects: true } });
    expect(grpc.signAndExecuteTransaction).toHaveBeenCalledWith({
      signer,
      transaction: tx,
      include: { effects: true },
    });
  });

  it("simulate retries on RESOURCE_EXHAUSTED then succeeds", async () => {
    const client = new PredictClient("TESTNET", TESTNET_FIXTURE_CONFIG);
    const ok = { $kind: "Success" as const };
    const rateLimitErr = Object.assign(new Error("too many requests"), {
      code: "RESOURCE_EXHAUSTED",
    });
    const simulateTransaction = vi
      .fn()
      .mockRejectedValueOnce(rateLimitErr)
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValueOnce(ok);
    (
      client as unknown as { grpcClient: { simulateTransaction: typeof simulateTransaction } }
    ).grpcClient = { simulateTransaction };

    const tx = new Transaction();
    await expect(client.simulate(tx)).resolves.toEqual(ok);
    expect(simulateTransaction).toHaveBeenCalledTimes(3);
  });

  it("simulate rethrows non-rate-limit errors immediately", async () => {
    const client = new PredictClient("TESTNET", TESTNET_FIXTURE_CONFIG);
    const simulateTransaction = vi.fn().mockRejectedValue(new Error("invalid transaction"));
    (
      client as unknown as { grpcClient: { simulateTransaction: typeof simulateTransaction } }
    ).grpcClient = { simulateTransaction };

    const tx = new Transaction();
    await expect(client.simulate(tx)).rejects.toThrow(/invalid transaction/);
    expect(simulateTransaction).toHaveBeenCalledTimes(1);
  });
});

import {
  createMainnetConfig,
  createTestnetConfig,
  MAINNET_OBJECTS,
  MAINNET_PACKAGE_IDS,
  MAINNET_TYPES,
  PYTH_HERMES_ENDPOINT,
  PYTH_STATE_ID,
  PYTH_WORMHOLE_STATE_ID,
  TESTNET_OBJECTS,
  TESTNET_PACKAGE_IDS,
  TESTNET_TYPES,
  WaterXClient,
} from "@waterx/perp-sdk";
import { describe, expect, it, vi } from "vitest";

describe("createTestnetConfig", () => {
  it("returns NETWORK TESTNET and all required string fields non-empty", () => {
    const c = createTestnetConfig();
    expect(c.network).toBe("TESTNET");
    expect(c.packageId.length).toBeGreaterThan(10);
    expect(c.rewardDistributorPackageId).toBe(TESTNET_PACKAGE_IDS.REWARD_DISTRIBUTOR);
    expect(c.rewardDistributorId).toBe(TESTNET_OBJECTS.REWARD_DISTRIBUTOR);
    expect(c.rewardDistributorRewardTokenTypes).toEqual([TESTNET_TYPES.SUI]);
    expect(c.globalConfig.startsWith("0x")).toBe(true);
    expect(c.accountRegistry.startsWith("0x")).toBe(true);
    expect(c.wlpPool.startsWith("0x")).toBe(true);
    expect(c.markets.BTC.marketId.startsWith("0x")).toBe(true);
    expect(c.markets.ETH.marketId.startsWith("0x")).toBe(true);
    expect(c.collaterals.USDC.type).toContain("::");
    expect(c.wlpType).toContain("::");
    expect(c.markets.BTC.baseType).toContain("::");
    expect(c.markets.ETH.baseType).toContain("::");
    expect(c.pythConfig?.pythStateId.startsWith("0x")).toBe(true);
    expect(c.pythConfig?.wormholeStateId.startsWith("0x")).toBe(true);
    expect(c.pythConfig?.hermesEndpoint).toMatch(/^https:\/\//);
  });
});

describe("createMainnetConfig", () => {
  it("returns NETWORK MAINNET wired to MAINNET_* constants", () => {
    const c = createMainnetConfig();
    expect(c.network).toBe("MAINNET");
    expect(c.packageId).toBe(MAINNET_PACKAGE_IDS.WATERX_PERP);
    expect(c.rewardDistributorPackageId).toBe(MAINNET_PACKAGE_IDS.REWARD_DISTRIBUTOR);
    expect(c.bucketOraclePackageId).toBe(MAINNET_PACKAGE_IDS.BUCKET_ORACLE);
    expect(c.bucketFrameworkPackageId).toBe(MAINNET_PACKAGE_IDS.BUCKET_FRAMEWORK);
    expect(c.pythRulePackageId).toBe(MAINNET_PACKAGE_IDS.PYTH_RULE);
    expect(c.pythRuleConfigId).toBe(MAINNET_OBJECTS.PYTH_RULE_CONFIG);
    expect(c.pythSponsorRulePackageId).toBe(MAINNET_PACKAGE_IDS.PYTH_SPONSOR_RULE);
    expect(c.pythSponsorId).toBe(MAINNET_OBJECTS.PYTH_SPONSOR);
    expect(c.globalConfig).toBe(MAINNET_OBJECTS.GLOBAL_CONFIG);
    expect(c.referralTable).toBe(MAINNET_OBJECTS.REFERRAL_TABLE);
    expect(c.accountRegistry).toBe(MAINNET_OBJECTS.ACCOUNT_REGISTRY);
    expect(c.wlpPool).toBe(MAINNET_OBJECTS.WLP_POOL);
    expect(c.rewardDistributorId).toBe(MAINNET_OBJECTS.REWARD_DISTRIBUTOR);
    expect(c.wlpType).toBe(MAINNET_TYPES.WLP);
    expect(c.rewardDistributorRewardTokenTypes).toEqual([MAINNET_TYPES.SUI]);
    expect(c.pythConfig?.pythStateId).toBe(PYTH_STATE_ID.MAINNET);
    expect(c.pythConfig?.wormholeStateId).toBe(PYTH_WORMHOLE_STATE_ID.MAINNET);
    expect(c.pythConfig?.hermesEndpoint).toBe(PYTH_HERMES_ENDPOINT.MAINNET);
  });
});

describe("WaterXClient", () => {
  it("testnet() uses testnet config", () => {
    const client = WaterXClient.testnet();
    expect(client.config.network).toBe("TESTNET");
    expect(client.config.packageId).toBe(createTestnetConfig().packageId);
    expect(client.grpcClient).toBeDefined();
  });

  it("testnet({ grpcUrl }) overrides config.grpcUrl", () => {
    const url = "https://fullnode.custom.example:443";
    const client = WaterXClient.testnet({ grpcUrl: url });
    expect(client.config.grpcUrl).toBe(url);
  });

  it("mainnet() uses mainnet config", () => {
    const client = WaterXClient.mainnet();
    expect(client.config.network).toBe("MAINNET");
    expect(client.config.packageId).toBe(createMainnetConfig().packageId);
    expect(client.config.grpcUrl).toBeUndefined();
    expect(client.grpcClient).toBeDefined();
  });

  it("mainnet({ grpcUrl }) overrides config.grpcUrl", () => {
    const url = "https://fullnode.mainnet.example:443";
    const client = WaterXClient.mainnet({ grpcUrl: url });
    expect(client.config.grpcUrl).toBe(url);
    expect(client.config.network).toBe("MAINNET");
  });

  it("getMarket returns BTC and ETH markets", () => {
    const client = WaterXClient.testnet();
    expect(client.getMarket("BTC")).toBe(client.config.markets.BTC.marketId);
    expect(client.getMarket("ETH")).toBe(client.config.markets.ETH.marketId);
  });

  it("getMarket throws for unknown base asset", () => {
    const client = WaterXClient.testnet();
    expect(() => client.getMarket("INVALID" as any)).toThrow(/Unknown base asset/);
  });

  it("getAggregator returns BTC, ETH, USDC, USDSUI aggregators", () => {
    const client = WaterXClient.testnet();
    expect(client.getAggregator("BTC")).toBe(client.config.markets.BTC.aggregatorId);
    expect(client.getAggregator("ETH")).toBe(client.config.markets.ETH.aggregatorId);
    expect(client.getAggregator("USDC")).toBe(client.config.collaterals.USDC.aggregatorId);
    expect(client.getAggregator("USDSUI")).toBe(client.config.collaterals.USDSUI.aggregatorId);
  });

  it("getCollateralAssets includes USDC and USDSUI", () => {
    const client = WaterXClient.testnet();
    const assets = client.getCollateralAssets().map((x) => x.asset);
    expect(assets).toContain("USDC");
    expect(assets).toContain("USDSUI");
  });

  it("getBaseAssets lists each market with base coin type", () => {
    const client = WaterXClient.testnet();
    const bases = client.getBaseAssets();
    const btc = bases.find((b) => b.asset === "BTC");
    expect(btc?.coinType).toBe(client.config.markets.BTC.baseType);
    expect(bases.length).toBeGreaterThanOrEqual(2);
  });

  it("getAggregator throws for unknown token", () => {
    const client = WaterXClient.testnet();
    expect(() => client.getAggregator("INVALID" as any)).toThrow(/Unknown base asset/);
  });
});

describe("WaterXClient gRPC delegates", () => {
  const owner = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

  it("forwards getObject / getObjects / listOwnedObjects", async () => {
    const client = WaterXClient.testnet();
    const getObject = vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({} as any);
    const getObjects = vi.spyOn(client.grpcClient, "getObjects").mockResolvedValue({} as any);
    const listOwned = vi.spyOn(client.grpcClient, "listOwnedObjects").mockResolvedValue({} as any);

    await client.getObject("0xo1");
    await client.getObjects(["0xa", "0xb"]);
    await client.listOwnedObjects(owner);

    expect(getObject).toHaveBeenCalledWith({ objectId: "0xo1" });
    expect(getObjects).toHaveBeenCalledWith({ objectIds: ["0xa", "0xb"] });
    expect(listOwned).toHaveBeenCalledWith({ owner });
  });

  it("forwards listCoins / getBalance", async () => {
    const client = WaterXClient.testnet();
    const listCoins = vi.spyOn(client.grpcClient, "listCoins").mockResolvedValue({} as any);
    const getBalance = vi.spyOn(client.grpcClient, "getBalance").mockResolvedValue({} as any);

    await client.listCoins({ owner, coinType: "0x::usdc::USDC" });
    await client.getBalance({ owner });

    expect(listCoins).toHaveBeenCalledWith({
      owner,
      coinType: "0x::usdc::USDC",
    });
    expect(getBalance).toHaveBeenCalledWith({ owner });
  });

  it("forwards listDynamicFields / getDynamicField / waitForTransaction", async () => {
    const client = WaterXClient.testnet();
    const ldf = vi.spyOn(client.grpcClient, "listDynamicFields").mockResolvedValue({} as any);
    const gdf = vi.spyOn(client.grpcClient, "getDynamicField").mockResolvedValue({} as any);
    const wait = vi.spyOn(client.grpcClient, "waitForTransaction").mockResolvedValue({} as any);

    const name = { type: "0x::m::T", bcs: new Uint8Array([0x78]) };
    await client.listDynamicFields("0xparent");
    await client.getDynamicField("0xparent", name);
    await client.waitForTransaction("digest0");

    expect(ldf).toHaveBeenCalledWith({ parentId: "0xparent" });
    expect(gdf).toHaveBeenCalledWith({ parentId: "0xparent", name });
    expect(wait).toHaveBeenCalledWith({ digest: "digest0" });
  });

  it("simulate forwards transaction with commandResults include", async () => {
    const client = WaterXClient.testnet();
    const sim = vi.spyOn(client.grpcClient, "simulateTransaction").mockResolvedValue({} as any);
    const { Transaction } = await import("@mysten/sui/transactions");
    const tx = new Transaction();

    await client.simulate(tx);

    expect(sim).toHaveBeenCalledWith({
      transaction: tx,
      include: { commandResults: true },
    });
  });

  it("signAndExecuteTransaction forwards params", async () => {
    const client = WaterXClient.testnet();
    const exec = vi
      .spyOn(client.grpcClient, "signAndExecuteTransaction")
      .mockResolvedValue({} as any);

    const payload = {
      transaction: {} as any,
      signer: {} as any,
      include: { rawEffects: true },
    };
    await client.signAndExecuteTransaction(payload as any);

    expect(exec).toHaveBeenCalledWith(payload);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { PerpClient } from "../../../src/perp/client.ts";
import { PredictClient } from "../../../src/prediction/client.ts";
import { Client } from "../../../src/sdk.ts";
import { createMockPredictClient } from "../../prediction/helpers/mock-client.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

describe("Client.create", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads both line clients with shared defaults", async () => {
    const perpStub = createUnitTestClient();
    const predictStub = createMockPredictClient();
    const perpCreate = vi.spyOn(PerpClient, "create").mockResolvedValue(perpStub);
    const predictCreate = vi.spyOn(PredictClient, "create").mockResolvedValue(predictStub);

    const client = await Client.create({
      network: "TESTNET",
      grpcUrl: "https://grpc.test:443",
      oracleSource: "pyth_rule",
      waterxConfigUrl: "https://waterx.test/testnet.json",
      cache: true,
    });

    expect(perpCreate).toHaveBeenCalledWith("TESTNET", {
      grpcUrl: "https://grpc.test:443",
      waterxConfigUrl: "https://waterx.test/testnet.json",
      cache: true,
      oracleSource: "pyth_rule",
    });
    expect(predictCreate).toHaveBeenCalledWith("TESTNET", {
      grpcUrl: "https://grpc.test:443",
      waterxConfigUrl: "https://waterx.test/testnet.json",
      cache: true,
    });
    expect(client.perp).toBe(perpStub);
    expect(client.predict).toBe(predictStub);
    expect(client.perp).toBeTypeOf("object");
    expect(client.predict).toBeTypeOf("object");
  });

  it("defaults to TESTNET when only the required oracleSource is passed", async () => {
    const perpCreate = vi.spyOn(PerpClient, "create").mockResolvedValue(createUnitTestClient());
    const predictCreate = vi
      .spyOn(PredictClient, "create")
      .mockResolvedValue(createMockPredictClient());

    await Client.create({ oracleSource: "pyth_rule" });

    expect(perpCreate).toHaveBeenCalledWith("TESTNET", {
      grpcUrl: undefined,
      waterxConfigUrl: undefined,
      cache: undefined,
      oracleSource: "pyth_rule",
    });
    expect(predictCreate).toHaveBeenCalledWith("TESTNET", {
      grpcUrl: undefined,
      waterxConfigUrl: undefined,
      cache: undefined,
    });
  });

  it("allows per-line network overrides and extra create options", async () => {
    const perpCreate = vi.spyOn(PerpClient, "create").mockResolvedValue(createUnitTestClient());
    const predictCreate = vi
      .spyOn(PredictClient, "create")
      .mockResolvedValue(createMockPredictClient());

    await Client.create({
      network: "TESTNET",
      oracleSource: "pyth_rule",
      perp: { network: "MAINNET", cache: false },
      predict: { network: "TESTNET", waterxConfigUrl: "https://waterx.test/predict.json" },
    });

    expect(perpCreate).toHaveBeenCalledWith("MAINNET", {
      grpcUrl: undefined,
      waterxConfigUrl: undefined,
      cache: false,
      oracleSource: "pyth_rule",
    });
    expect(predictCreate).toHaveBeenCalledWith("TESTNET", {
      grpcUrl: undefined,
      waterxConfigUrl: "https://waterx.test/predict.json",
      cache: undefined,
    });
  });

  it("forwards per-line options without clobbering shared opts", async () => {
    const perpCreate = vi.spyOn(PerpClient, "create").mockResolvedValue(createUnitTestClient());
    vi.spyOn(PredictClient, "create").mockResolvedValue(createMockPredictClient());

    await Client.create({
      grpcUrl: "https://shared.grpc:443",
      oracleSource: "pyth_rule",
      perp: { waterxConfigUrl: "https://waterx.test/perp.json" },
    });

    expect(perpCreate).toHaveBeenCalledWith("TESTNET", {
      grpcUrl: "https://shared.grpc:443",
      waterxConfigUrl: "https://waterx.test/perp.json",
      cache: undefined,
      oracleSource: "pyth_rule",
    });
  });
});

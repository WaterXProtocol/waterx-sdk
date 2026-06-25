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
      configUrl: "https://waterx.test/testnet.json",
      cache: true,
    });

    expect(perpCreate).toHaveBeenCalledWith("TESTNET", {
      grpcUrl: "https://grpc.test:443",
      configUrl: "https://waterx.test/testnet.json",
      cache: true,
    });
    expect(predictCreate).toHaveBeenCalledWith("TESTNET", {
      grpcUrl: "https://grpc.test:443",
      configUrl: "https://waterx.test/testnet.json",
      cache: true,
    });
    expect(client.perp).toBe(perpStub);
    expect(client.predict).toBe(predictStub);
    expect(client.perp).toBeTypeOf("object");
    expect(client.predict).toBeTypeOf("object");
  });

  it("defaults to TESTNET when opts are omitted", async () => {
    const perpCreate = vi.spyOn(PerpClient, "create").mockResolvedValue(createUnitTestClient());
    const predictCreate = vi
      .spyOn(PredictClient, "create")
      .mockResolvedValue(createMockPredictClient());

    await Client.create();

    expect(perpCreate).toHaveBeenCalledWith("TESTNET", {
      grpcUrl: undefined,
      configUrl: undefined,
      cache: undefined,
    });
    expect(predictCreate).toHaveBeenCalledWith("TESTNET", {
      grpcUrl: undefined,
      configUrl: undefined,
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
      perp: { network: "MAINNET", cache: false },
      predict: { network: "TESTNET", configUrl: "https://waterx.test/predict.json" },
    });

    expect(perpCreate).toHaveBeenCalledWith("MAINNET", {
      grpcUrl: undefined,
      configUrl: undefined,
      cache: false,
    });
    expect(predictCreate).toHaveBeenCalledWith("TESTNET", {
      grpcUrl: undefined,
      configUrl: "https://waterx.test/predict.json",
      cache: undefined,
    });
  });

  it("forwards per-line options without clobbering shared opts", async () => {
    const perpCreate = vi.spyOn(PerpClient, "create").mockResolvedValue(createUnitTestClient());
    vi.spyOn(PredictClient, "create").mockResolvedValue(createMockPredictClient());

    await Client.create({
      grpcUrl: "https://shared.grpc:443",
      perp: { configUrl: "https://waterx.test/perp.json" },
    });

    expect(perpCreate).toHaveBeenCalledWith("TESTNET", {
      grpcUrl: "https://shared.grpc:443",
      configUrl: "https://waterx.test/perp.json",
      cache: undefined,
    });
  });
});

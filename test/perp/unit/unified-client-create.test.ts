import { afterEach, describe, expect, it, vi } from "vitest";

import * as configModule from "../../../src/config.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import { PredictClient } from "../../../src/prediction/client.ts";
import { Client } from "../../../src/sdk.ts";
import { MOCK_TESTNET_CONFIG } from "../../helpers/fixtures/mock-testnet-config.ts";

/**
 * The umbrella loads the ONE consolidated `waterx-config` document itself and
 * constructs both line clients from it — there are no per-line `create()`
 * hops to intercept, so these cases spy on `loadConfig` (the args it receives
 * are the very option bag each line client is constructed with) and read the
 * outcome off the built clients.
 */
describe("Client.create", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the document ONCE for both line clients under shared defaults", async () => {
    const loadConfig = vi.spyOn(configModule, "loadConfig").mockResolvedValue(MOCK_TESTNET_CONFIG);

    const client = await Client.create({
      network: "TESTNET",
      grpcUrl: "https://grpc.test:443",
      waterxConfigUrl: "https://waterx.test/testnet.json",
      cache: true,
    });

    // Same network + same URL ⇒ one fetch serves both lines.
    expect(loadConfig).toHaveBeenCalledTimes(1);
    expect(loadConfig).toHaveBeenCalledWith(
      "TESTNET",
      expect.objectContaining({
        grpcUrl: "https://grpc.test:443",
        waterxConfigUrl: "https://waterx.test/testnet.json",
        cache: true,
      }),
    );
    expect(client.perp).toBeInstanceOf(PerpClient);
    expect(client.predict).toBeInstanceOf(PredictClient);
    expect(client.perp.network).toBe("TESTNET");
    expect(client.predict.network).toBe("TESTNET");
    expect(client.perp.config).toBe(MOCK_TESTNET_CONFIG);
    expect(client.predict.config).toBe(MOCK_TESTNET_CONFIG);
  });

  it("defaults both lines to TESTNET when nothing is passed", async () => {
    const loadConfig = vi.spyOn(configModule, "loadConfig").mockResolvedValue(MOCK_TESTNET_CONFIG);

    const client = await Client.create({});

    expect(loadConfig).toHaveBeenCalledTimes(1);
    expect(loadConfig).toHaveBeenCalledWith(
      "TESTNET",
      expect.objectContaining({ grpcUrl: undefined, waterxConfigUrl: undefined, cache: undefined }),
    );
    expect(client.perp.network).toBe("TESTNET");
    expect(client.predict.network).toBe("TESTNET");
  });

  it("allows per-line network overrides and extra create options (one load per line)", async () => {
    const loadConfig = vi.spyOn(configModule, "loadConfig").mockResolvedValue(MOCK_TESTNET_CONFIG);
    // A split-network setup warns that `client.account` follows the perp line.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const client = await Client.create({
      network: "TESTNET",
      perp: { network: "MAINNET", cache: false },
      predict: { network: "TESTNET", waterxConfigUrl: "https://waterx.test/predict.json" },
    });

    expect(loadConfig).toHaveBeenCalledTimes(2);
    expect(loadConfig).toHaveBeenNthCalledWith(
      1,
      "MAINNET",
      expect.objectContaining({ grpcUrl: undefined, waterxConfigUrl: undefined, cache: false }),
    );
    expect(loadConfig).toHaveBeenNthCalledWith(
      2,
      "TESTNET",
      expect.objectContaining({
        grpcUrl: undefined,
        waterxConfigUrl: "https://waterx.test/predict.json",
        cache: undefined,
      }),
    );
    expect(client.perp.network).toBe("MAINNET");
    expect(client.predict.network).toBe("TESTNET");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("split-network"));
  });

  it("forwards per-line options without clobbering shared opts", async () => {
    const loadConfig = vi.spyOn(configModule, "loadConfig").mockResolvedValue(MOCK_TESTNET_CONFIG);

    await Client.create({
      grpcUrl: "https://shared.grpc:443",
      perp: { waterxConfigUrl: "https://waterx.test/perp.json" },
    });

    // The perp line's own URL differs from the predict line's (unset) one, so
    // each line loads its own document — and the shared grpcUrl reaches both.
    expect(loadConfig).toHaveBeenCalledTimes(2);
    expect(loadConfig).toHaveBeenNthCalledWith(
      1,
      "TESTNET",
      expect.objectContaining({
        grpcUrl: "https://shared.grpc:443",
        waterxConfigUrl: "https://waterx.test/perp.json",
        cache: undefined,
      }),
    );
    expect(loadConfig).toHaveBeenNthCalledWith(
      2,
      "TESTNET",
      expect.objectContaining({ grpcUrl: "https://shared.grpc:443", waterxConfigUrl: undefined }),
    );
  });
});

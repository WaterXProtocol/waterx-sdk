import { PredictClient } from "~predict/client.ts";
import {
  clearConfigCache,
  defaultConfigUrl,
  loadConfig,
  type WaterxPredictionConfig,
} from "~predict/config.ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const remoteConfig = {
  network: "testnet",
  grpcUrl: "https://remote.grpc:443",
  packages: {
    bucket_framework: {
      published_at: "0xbucket",
    },
    waterx_account: {
      published_at: "0xaccount",
      admin_cap: "0xaccount_admin",
      account_registry: "0xaccount_registry",
    },
    waterx_prediction: {
      published_at: "0xprediction",
      admin_cap: "0xprediction_admin",
      global_config: "0xglobal",
      market_registries: {
        USD: "0xmarket_registry_usd",
      },
      settlement_coin_types: {
        USD: "0xusd::usd::USD",
      },
    },
  },
} satisfies WaterxPredictionConfig;

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

describe("waterx-config loader", () => {
  beforeEach(() => {
    clearConfigCache();
  });

  it("defaultConfigUrl points at waterx-config raw JSON", () => {
    expect(defaultConfigUrl("TESTNET")).toBe(
      "https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/testnet.json",
    );
  });

  it("loads and caches the remote prediction config", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(remoteConfig));
    const opts = {
      configUrl: "https://waterx.test/testnet.json",
      fetchImpl: fetchMock as unknown as typeof fetch,
      cache: true,
    };

    const first = await loadConfig("TESTNET", opts);
    const second = await loadConfig("TESTNET", opts);

    expect(first).toBe(remoteConfig);
    expect(second).toBe(remoteConfig);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects config from the wrong network", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ...remoteConfig,
        network: "mainnet",
      }),
    );

    await expect(
      loadConfig("TESTNET", {
        configUrl: "https://waterx.test/mainnet.json",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/declares network=mainnet/);
  });

  it("rejects config missing packages", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ network: "testnet" }));

    await expect(
      loadConfig("TESTNET", {
        configUrl: "https://waterx.test/bad.json",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/no packages object/);
  });

  it("rejects config missing account_registry", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ...remoteConfig,
        packages: {
          ...remoteConfig.packages,
          waterx_account: {
            published_at: "0xaccount",
          },
        },
      }),
    );

    await expect(
      loadConfig("TESTNET", {
        configUrl: "https://waterx.test/bad.json",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/account_registry/);
  });

  it("rejects config missing prediction global_config", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ...remoteConfig,
        packages: {
          ...remoteConfig.packages,
          waterx_prediction: {
            published_at: "0xprediction",
            market_registries: { USD: "0xregistry" },
          },
        },
      }),
    );

    await expect(
      loadConfig("TESTNET", {
        configUrl: "https://waterx.test/bad.json",
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/global_config/);
  });
});

describe("PredictClient remote config", () => {
  it("PredictClient.create fetches waterx-config", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(remoteConfig));

    const client = await PredictClient.create("TESTNET", {
      configUrl: "https://waterx.test/testnet.json",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(client.config).toBe(remoteConfig);
    expect(client.packageId()).toBe("0xprediction");
    expect(client.accountRegistry()).toBe("0xaccount_registry");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

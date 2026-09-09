import { PredictClient } from "~predict/client.ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearConfigCache } from "../../../src/config.ts";
import {
  MOCK_TESTNET_CONFIG,
  MOCK_TESTNET_CONFIG_RAW,
} from "../../helpers/fixtures/mock-testnet-config.ts";
import { TESTNET_FIXTURE_IDS } from "../fixtures/testnet-config.ts";

// The loader itself (retry / cache / strict parse) is covered once, in
// `test/perp/unit/config-load.test.ts` — both lines share it. This pins the
// prediction line's wiring onto it.

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe("PredictClient remote config", () => {
  beforeEach(() => {
    clearConfigCache();
  });

  it("PredictClient.create fetches the consolidated waterx-config document and reads it as-is", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(MOCK_TESTNET_CONFIG_RAW));

    const client = await PredictClient.create("TESTNET", {
      waterxConfigUrl: "https://waterx.test/testnet.json",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(client.config).toEqual(MOCK_TESTNET_CONFIG);
    expect(client.packageId()).toBe(TESTNET_FIXTURE_IDS.packageId);
    expect(client.accountRegistry()).toBe(TESTNET_FIXTURE_IDS.accountRegistry);
    expect(client.marketRegistry()).toBe(TESTNET_FIXTURE_IDS.marketRegistry);
    expect(client.settlementCoinType()).toBe(TESTNET_FIXTURE_IDS.settlementCoinType);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a legacy per-line document (no schema_version) — the strict parser is the only path", async () => {
    const legacy = {
      network: "testnet",
      packages: {
        bucket_framework: { published_at: TESTNET_FIXTURE_IDS.bucketFrameworkPackageId },
        waterx_account: {
          published_at: TESTNET_FIXTURE_IDS.waterxAccountPackageId,
          account_registry: TESTNET_FIXTURE_IDS.accountRegistry,
        },
        waterx_prediction: {
          published_at: TESTNET_FIXTURE_IDS.packageId,
          global_config: TESTNET_FIXTURE_IDS.globalConfig,
          market_registries: { USD: TESTNET_FIXTURE_IDS.marketRegistry },
        },
      },
    };
    await expect(
      PredictClient.create("TESTNET", {
        waterxConfigUrl: "https://waterx.test/testnet.json",
        fetchImpl: (async () => jsonResponse(legacy)) as unknown as typeof fetch,
      }),
    ).rejects.toThrow();
  });

  it("throws on an unknown settlement alias, naming the config path", () => {
    const client = new PredictClient("TESTNET", MOCK_TESTNET_CONFIG);
    expect(() => client.marketRegistry("EUR")).toThrow(
      /objects\.prediction\.market_registries\.EUR/,
    );
  });
});

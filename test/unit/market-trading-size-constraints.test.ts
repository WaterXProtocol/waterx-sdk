import { afterEach, describe, expect, it, vi } from "vitest";

import { WaterXClient } from "../../src/client.ts";
import { mockSuiAddress } from "../helpers/fixtures/sui-mock-fixtures.ts";
import { getMarketTradingSizeConstraints } from "../helpers/trading/market-trading-size-constraints.ts";

describe("getMarketTradingSizeConstraints", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads legacy min_size / lot_size from nested config.fields", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({
      object: {
        json: {
          fields: {
            config: {
              fields: {
                min_size: "1000",
                lot_size: 500,
              },
            },
          },
        },
      },
    } as any);

    await expect(getMarketTradingSizeConstraints(client, mockSuiAddress("a1"))).resolves.toEqual({
      minSize: 1000n,
      lotSize: 500n,
    });
  });

  it("v2: omits min_size/lot_size but has min_coll_value → unit step (1)", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({
      object: {
        json: {
          fields: {
            config: {
              fields: {
                min_coll_value: "300000000",
                cooldown_ms: 5000,
              },
            },
          },
        },
      },
    } as any);

    await expect(getMarketTradingSizeConstraints(client, mockSuiAddress("b2"))).resolves.toEqual({
      minSize: 1n,
      lotSize: 1n,
    });
  });

  it("throws when neither legacy nor v2 markers exist", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({
      object: {
        json: {
          fields: {
            config: { fields: { cooldown_ms: 0 } },
          },
        },
      },
    } as any);

    await expect(getMarketTradingSizeConstraints(client, mockSuiAddress("c3"))).rejects.toThrow(
      /cannot derive size constraints/,
    );
  });
});

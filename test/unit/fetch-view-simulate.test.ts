/**
 * Unit tests for `fetch.ts` view + gRPC paths not fully covered by `fetch-helpers.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { WaterXClient } from "../../src/client.ts";
import {
  getAccountsByOwner,
  getMarketCooldownMs,
  getMarketSummary,
  getPoolSummary,
  getPosition,
  getTokenPoolSummary,
  positionExists,
} from "../../src/fetch.ts";
import {
  MarketData as MarketDataBcs,
  PoolData as PoolDataBcs,
  PositionData as PositionInfoBcs,
  TokenPoolData as TokenPoolDataBcs,
} from "../../src/generated/waterx_perp/view.ts";
import { mockSuiAddress } from "../helpers/fixtures/sui-mock-fixtures.ts";

function clientWithViewPackageStub() {
  const client = WaterXClient.testnet();
  vi.spyOn(client, "getObject").mockResolvedValue({
    object: { type: `${client.config.packageId}::stub::Stub` },
  } as any);
  return client;
}

describe("fetch view simulate (mocked)", () => {
  const marketId = mockSuiAddress("a9");
  const baseType = "0x2::sui::SUI";
  const customLp = mockSuiAddress("aa");

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function defaultMarketData(overrides: Record<string, unknown> = {}) {
    return {
      market_id: marketId,
      base_token: { name: baseType },
      lp_token: { name: customLp },
      is_active: true,
      long_oi: 0n,
      short_oi: 0n,
      max_long_oi: 1n,
      max_short_oi: 1n,
      max_leverage_bps: 1n,
      trading_fee_bps: 1n,
      max_impact_fee_bps: 1n,
      allocated_lp_exposure_bps: 2_000n,
      impact_fee_curvature: 2n,
      impact_fee_scale: 1n,
      maintenance_margin_bps: 1n,
      min_coll_value: 1n,
      cooldown_ms: 0n,
      basic_funding_rate: 0n,
      funding_interval_ms: 0n,
      order_price_tick: 1n,
      cumulative_funding_sign: true,
      cumulative_funding_index: 0n,
      last_funding_timestamp: 0n,
      next_position_id: 0n,
      next_order_id: 0n,
      ...overrides,
    };
  }

  it("getMarketSummary maps BCS + uses default lp type", async () => {
    const client = clientWithViewPackageStub();
    const bytes = MarketDataBcs.serialize(
      defaultMarketData({
        long_oi: 11n,
        short_oi: 22n,
        max_long_oi: 33n,
        max_short_oi: 44n,
        max_leverage_bps: 500_000n,
        trading_fee_bps: 3n,
        maintenance_margin_bps: 150n,
        cumulative_funding_sign: false,
        cumulative_funding_index: 99n,
        next_position_id: 7n,
        next_order_id: 8n,
      }),
    ).toBytes();

    vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [{ returnValues: [{ bcs: Uint8Array.from(bytes) }] }],
    } as any);

    const m = await getMarketSummary(client, marketId, baseType);
    expect(m.longOi).toBe(11n);
    expect(m.tradingFeeBps).toBe(3n);
    expect(m.nextPositionId).toBe(7n);
    expect(m.nextOrderId).toBe(8n);
  });

  it("getMarketSummary passes custom lpTokenType into view call", async () => {
    const client = clientWithViewPackageStub();
    const bytes = MarketDataBcs.serialize(defaultMarketData()).toBytes();

    vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [{ returnValues: [{ bcs: Uint8Array.from(bytes) }] }],
    } as any);

    await getMarketSummary(client, marketId, baseType, customLp);

    const sim = vi.mocked(client.simulate).mock.calls[0]![0] as any;
    const tx = sim;
    const cmd = tx.getData().commands?.find((c: any) => c.$kind === "MoveCall");
    expect(cmd?.MoveCall?.typeArguments).toEqual([baseType, customLp]);
  });

  it("getAccountsByOwner throws on FailedTransaction (extractReturnBytes)", async () => {
    const client = clientWithViewPackageStub();
    vi.spyOn(client, "simulate").mockResolvedValue({
      $kind: "FailedTransaction",
      FailedTransaction: {
        status: { error: { message: "boom" } },
      },
    } as any);

    await expect(getAccountsByOwner(client, mockSuiAddress("f1"))).rejects.toThrow(
      /Simulate transaction failed: boom/,
    );
  });

  it("getPoolSummary maps PoolData BCS", async () => {
    const client = clientWithViewPackageStub();
    const bytes = PoolDataBcs.serialize({
      lp_token: { name: customLp },
      is_active: true,
      lp_decimal: 9,
      total_lp_supply: 1_000n,
      tvl_usd: 2_000n,
      token_count: 3n,
    }).toBytes();

    vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [{ returnValues: [{ bcs: Uint8Array.from(bytes) }] }],
    } as any);

    const p = await getPoolSummary(client);
    expect(p.totalLpSupply).toBe(1_000n);
    expect(p.tvlUsd).toBe(2_000n);
    expect(p.tokenCount).toBe(3n);
  });

  it("getTokenPoolSummary maps TokenPoolData BCS", async () => {
    const client = clientWithViewPackageStub();
    const bytes = TokenPoolDataBcs.serialize({
      token_type: { name: "0x2::sui::SUI" },
      token_decimal: 6,
      liquidity_amount: 10n,
      reserved_amount: 20n,
      value_usd: 30n,
      target_weight_bps: 5_000n,
      mint_fee_bps: 1n,
      burn_fee_bps: 2n,
      cumulative_borrow_rate: 3n,
      last_price_refresh_timestamp: 4n,
    }).toBytes();

    vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [{ returnValues: [{ bcs: Uint8Array.from(bytes) }] }],
    } as any);

    const t = await getTokenPoolSummary(client, 0);
    expect(t.liquidityAmount).toBe(10n);
    expect(t.targetWeightBps).toBe(5_000n);
  });

  it("getPosition maps PositionData BCS", async () => {
    const client = clientWithViewPackageStub();
    const acct = mockSuiAddress("a2");
    const bytes = PositionInfoBcs.serialize({
      position_id: 5n,
      account_object_address: acct,
      market_id: marketId,
      is_long: true,
      size: 100n,
      collateral_type: { name: "0x2::sui::SUI" },
      collateral_amount: 200n,
      collateral_decimal: 6,
      average_price: 50n,
      oracle_price: 0n,
      collateral_price: 0n,
      est_liq_price: 0n,
      leverage_bps: 10_000n,
      entry_borrow_index: 1n,
      entry_funding_sign: false,
      entry_funding_index: 0n,
      unrealized_trading_fee: 2n,
      unrealized_borrow_fee: 3n,
      unrealized_funding_fee: 4n,
      unrealized_funding_sign: true,
      pnl_positive: true,
      pnl: 0n,
      funding_fee_positive: false,
      funding_fee: 0n,
      borrow_fee: 0n,
      close_fee: 0n,
      linked_order_ids: [],
      linked_order_price_keys: [],
      create_timestamp: 1n,
      update_timestamp: 2n,
    }).toBytes();

    vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [{ returnValues: [{ bcs: Uint8Array.from(bytes) }] }],
    } as any);

    const p = await getPosition(client, marketId, 5n, baseType);
    expect(p.positionId).toBe(5n);
    expect(p.accountObjectAddress).toBe(acct);
    expect(p.size).toBe(100n);
  });

  it("positionExists parses bool return", async () => {
    const client = clientWithViewPackageStub();
    const bytes = new Uint8Array([1]);
    vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [{ returnValues: [{ bcs: bytes }] }],
    } as any);

    await expect(positionExists(client, marketId, 0n, baseType)).resolves.toBe(true);
  });
});

describe("getMarketCooldownMs (getObject JSON)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads cooldown_ms from nested fields.config.fields", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({
      object: {
        json: {
          fields: {
            config: {
              fields: {
                cooldown_ms: "3600000",
              },
            },
          },
        },
      },
    } as any);

    await expect(getMarketCooldownMs(client, mockSuiAddress("c1"))).resolves.toBe(3_600_000n);
  });

  it("reads flat config.cooldown_ms number", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({
      object: {
        json: {
          config: { cooldown_ms: 500 },
        },
      },
    } as any);

    await expect(getMarketCooldownMs(client, mockSuiAddress("c2"))).resolves.toBe(500n);
  });

  it("throws when object JSON missing", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({ object: {} } as any);

    await expect(getMarketCooldownMs(client, mockSuiAddress("c3"))).rejects.toThrow(
      /missing object JSON/,
    );
  });

  it("throws when config missing", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({
      object: { json: { fields: {} } },
    } as any);

    await expect(getMarketCooldownMs(client, mockSuiAddress("c4"))).rejects.toThrow(
      /has no config/,
    );
  });

  it("throws when cooldown_ms missing", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({
      object: {
        json: {
          fields: {
            config: { fields: {} },
          },
        },
      },
    } as any);

    await expect(getMarketCooldownMs(client, mockSuiAddress("c5"))).rejects.toThrow(
      /missing cooldown_ms/,
    );
  });

  it("throws on non-integer cooldown_ms string", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({
      object: {
        json: {
          config: { cooldown_ms: "1.5" },
        },
      },
    } as any);

    await expect(getMarketCooldownMs(client, mockSuiAddress("c6"))).rejects.toThrow(
      /unexpected cooldown_ms type/,
    );
  });
});

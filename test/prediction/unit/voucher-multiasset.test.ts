/** Voucher settlement routing, exact raw amounts and all public facade reads/builders, without RPC. */
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it, vi } from "vitest";

import {
  PositionSettlementView,
  VoucherAccountView,
} from "../../../src/generated/waterx_prediction/view.ts";
import { PredictClient } from "../../../src/prediction/client.ts";
import * as voucher from "../../../src/prediction/voucher.ts";
import { WaterXClient } from "../../../src/unified-client.ts";
import { assertDualPathTxCase } from "../../helpers/unified-dual-path.ts";
import { minimalPlaceOrderParams, PTB_DUMMY } from "../fixtures/ptb-params.ts";
import { VOUCHER_ASSETS, voucherConfig } from "../fixtures/voucher-config.ts";
import { listMoveCalls } from "../helpers/ptb.ts";
import { predictVoucherDualPathCases } from "../helpers/unified/predict-dual-path-voucher.ts";

const RAW = 9_007_199_254_740_993n;

describe.each(VOUCHER_ASSETS)("Voucher %s routing", (asset) => {
  const client = new PredictClient("TESTNET", voucherConfig(), { settlement: asset });
  const facade = WaterXClient.fromClients({} as never, client).predict;
  const registry = client.marketRegistry();
  const coinType = client.settlementCoinType();

  it.each(predictVoucherDualPathCases(client).map((entry) => [entry.name, entry] as const))(
    "%s: facade and free function produce identical PTBs",
    async (_, entry) => {
      await assertDualPathTxCase(entry, client, facade);
    },
  );

  it("uses this registry/type and exact u64 stake, without a cash sweep or debit", async () => {
    const tx = await facade.buildPlaceVoucherOrderTx({
      ...minimalPlaceOrderParams(client),
      maxSpend: RAW,
    });
    expect(listMoveCalls(tx).map((call) => call.function)).toEqual([
      "request",
      "selection_yes",
      "place_order_with_voucher",
    ]);
    const data = tx.getData();
    const call = data.commands.at(-1)?.MoveCall;
    expect(call?.typeArguments).toEqual([coinType]);
    const registryArg = call?.arguments[1];
    const amountArg = call?.arguments[5];
    if (registryArg?.$kind !== "Input" || amountArg?.$kind !== "Input")
      throw new Error("Expected ABI inputs");
    expect(data.inputs[registryArg.Input]?.UnresolvedObject?.objectId).toBe(registry);
    const pure = data.inputs[amountArg.Input]?.Pure;
    if (!pure) throw new Error("Expected pure u64");
    expect(bcs.u64().parse(Buffer.from(pure.bytes, "base64"))).toBe(RAW.toString());
  });

  it("decodes every facade read without losing raw units or changing the selected registry", async () => {
    const result = (bytes: Uint8Array) =>
      ({ commandResults: [{ returnValues: [{ bcs: bytes }] }] }) as Awaited<
        ReturnType<typeof client.simulate>
      >;
    const simulate = vi.spyOn(client, "simulate");
    try {
      simulate.mockResolvedValue(
        result(
          VoucherAccountView.serialize({
            market_registry_id: registry,
            settlement_coin_type: { name: coinType },
            account_id: PTB_DUMMY.accountId,
            available: RAW,
            reserved: RAW - 1n,
            paused: false,
          }).toBytes(),
        ),
      );
      expect(await facade.getVoucherAccount({ accountId: PTB_DUMMY.accountId })).toEqual({
        marketRegistryId: registry,
        settlementCoinType: coinType,
        accountId: PTB_DUMMY.accountId,
        available: RAW,
        reserved: RAW - 1n,
        paused: false,
      });
      simulate.mockResolvedValue(
        result(
          PositionSettlementView.serialize({
            position_id: RAW,
            is_voucher: true,
            gross_payout: 15n,
            cash_payout: 9n,
            voucher_refund: 0n,
          }).toBytes(),
        ),
      );
      expect(await facade.getPositionSettlement({ positionId: RAW })).toEqual({
        positionId: RAW,
        isVoucher: true,
        grossPayout: 15n,
        cashPayout: 9n,
        voucherRefund: 0n,
      });
      simulate.mockResolvedValue(result(bcs.u64().serialize(RAW).toBytes()));
      expect(await facade.getVoucherGrantBudget()).toBe(RAW);
      simulate.mockResolvedValue(result(bcs.bool().serialize(true).toBytes()));
      expect(await facade.isVoucherOrder({ orderId: RAW })).toBe(true);
      expect(await facade.isVoucherPosition({ positionId: RAW })).toBe(true);
      for (const [tx] of simulate.mock.calls) {
        expect(listMoveCalls(tx).at(-1)?.typeArguments).toEqual([coinType]);
        expect(
          tx.getData().inputs.some((input) => input.UnresolvedObject?.objectId === registry),
        ).toBe(true);
      }
      simulate.mockResolvedValue(
        result(bcs.vector(bcs.Address).serialize([PTB_DUMMY.delegate]).toBytes()),
      );
      expect(await facade.getVoucherGranters()).toEqual([PTB_DUMMY.delegate]);
      expect(listMoveCalls(simulate.mock.calls.at(-1)![0]).at(-1)?.function).toBe(
        "voucher_granters",
      );
    } finally {
      simulate.mockRestore();
    }
  });

  it("propagates failed or missing views instead of treating them as cash or zero credit", async () => {
    const simulate = vi.spyOn(client, "simulate").mockRejectedValue(new Error("RPC unavailable"));
    try {
      await expect(facade.getVoucherAccount({ accountId: PTB_DUMMY.accountId })).rejects.toThrow(
        "RPC unavailable",
      );
      await expect(facade.getPositionSettlement({ positionId: RAW })).rejects.toThrow(
        "RPC unavailable",
      );
      simulate.mockResolvedValue({ commandResults: [] } as unknown as Awaited<
        ReturnType<typeof client.simulate>
      >);
      await expect(facade.getVoucherGrantBudget()).rejects.toThrow("No return value");
    } finally {
      simulate.mockRestore();
    }
  });
});

it("honours explicit non-default registry/type overrides on voucher builds and reads", async () => {
  const client = new PredictClient("TESTNET", voucherConfig());
  const target = {
    marketRegistry: client.marketRegistry("WAL"),
    settlementCoinType: client.settlementCoinType("WAL"),
  };
  const tx = await voucher.buildPlaceVoucherOrderTx(client, {
    ...minimalPlaceOrderParams(client),
    ...target,
  });
  expect(listMoveCalls(tx).at(-1)?.typeArguments).toEqual([target.settlementCoinType]);
  expect(
    tx.getData().inputs.some((input) => input.UnresolvedObject?.objectId === target.marketRegistry),
  ).toBe(true);
  const simulate = vi.spyOn(client, "simulate").mockResolvedValue({
    commandResults: [{ returnValues: [{ bcs: bcs.bool().serialize(true).toBytes() }] }],
  } as Awaited<ReturnType<typeof client.simulate>>);
  try {
    expect(await voucher.isVoucherPosition(client, { positionId: 1n, ...target })).toBe(true);
    expect(listMoveCalls(simulate.mock.calls[0]![0]).at(-1)?.typeArguments).toEqual([
      target.settlementCoinType,
    ]);
  } finally {
    simulate.mockRestore();
  }
});

it("rejects an unknown settlement rather than falling back to USD", () => {
  const client = new PredictClient("TESTNET", voucherConfig(), { settlement: "UNKNOWN" });
  expect(() =>
    voucher.placeOrderWithVoucher(client, new Transaction(), minimalPlaceOrderParams(client)),
  ).toThrow();
});

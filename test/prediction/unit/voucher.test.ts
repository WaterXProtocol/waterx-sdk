import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it, vi } from "vitest";

import {
  PositionSettlementView,
  VoucherAccountView,
} from "../../../src/generated/waterx_prediction/view.ts";
import {
  addVoucherGranter,
  buildPlaceVoucherOrderTx,
  getPositionSettlement,
  getVoucherAccount,
  grantVoucher,
  isVoucherOrder,
  isVoucherPosition,
  placeOrderWithVoucher,
  removeVoucherGranter,
  revokeVoucher,
  setVoucherGrantBudget,
  setVoucherPaused,
} from "../../../src/prediction/voucher.ts";
import { minimalPlaceOrderParams } from "../fixtures/ptb-params.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import { listMoveCalls } from "../helpers/ptb.ts";

const client = createMockPredictClient();
const params = minimalPlaceOrderParams(client);
const admin = { adminCap: "0x123" };
const result = (bytes: Uint8Array) => ({ commandResults: [{ returnValues: [{ bcs: bytes }] }] });
describe("legacy Predict vouchers", () => {
  it("builds the 12-argument self-funded voucher ABI without a cash sweep or receiver", async () => {
    const tx = await buildPlaceVoucherOrderTx(client, params);
    const calls = listMoveCalls(tx);
    expect(calls.map((c) => c.function)).toEqual([
      "request",
      "selection_yes",
      "place_order_with_voucher",
    ]);
    expect(calls.at(-1)?.argumentKinds).toHaveLength(12);
    expect(calls.at(-1)?.typeArguments).toEqual([client.settlementCoinType()]);
    const receiverOverride = { ...params, receiverAccountId: "0x123" };
    expect(() => placeOrderWithVoucher(client, new Transaction(), receiverOverride)).toThrow(
      "receiver",
    );
  });
  it("grant uses AccountRequest authorization; admin operations use the cap and exact ABI", () => {
    const tx = new Transaction();
    grantVoucher(client, tx, { accountId: "0x123", amount: 9007199254740993n });
    expect(listMoveCalls(tx).map((c) => c.function)).toEqual(["request", "grant_voucher"]);
    expect(listMoveCalls(tx).at(-1)?.argumentKinds).toHaveLength(7);
    const capTx = new Transaction();
    revokeVoucher(client, capTx, { ...admin, accountId: "0x123", amount: 1n });
    setVoucherGrantBudget(client, capTx, { ...admin, grantBudget: 0n });
    setVoucherPaused(client, capTx, { ...admin, paused: true });
    addVoucherGranter(client, capTx, { ...admin, granter: "0x456" });
    removeVoucherGranter(client, capTx, { ...admin, granter: "0x456" });
    expect(listMoveCalls(capTx).map((c) => c.argumentKinds.length)).toEqual([5, 3, 3, 3, 3]);
    const amountInput = tx
      .getData()
      .inputs.filter((i) => i.Pure)
      .map((i) => i.Pure?.bytes);
    expect(amountInput).toContain(bcs.u64().serialize(9007199254740993n).toBase64());
  });
  it("decodes raw credits without number precision loss, independent of package upgrade version", async () => {
    const spy = vi.spyOn(client, "simulate").mockResolvedValue(
      result(
        VoucherAccountView.serialize({
          market_registry_id: client.marketRegistry(),
          settlement_coin_type: { name: client.settlementCoinType() },
          account_id: "0x123",
          available: "9007199254740993",
          reserved: "2",
          paused: false,
        }).toBytes(),
      ) as Awaited<ReturnType<typeof client.simulate>>,
    );
    expect((await getVoucherAccount(client, { accountId: "0x123" })).available).toBe(
      9007199254740993n,
    );
    spy.mockRestore();
  });
  it.each([
    [15n, 9n, 0n],
    [0n, 0n, 0n],
    [6n, 0n, 6n],
  ])("separates gross, cash and restored credit", async (gross, cash, refund) => {
    const spy = vi.spyOn(client, "simulate").mockResolvedValue(
      result(
        PositionSettlementView.serialize({
          position_id: "7",
          is_voucher: true,
          gross_payout: gross,
          cash_payout: cash,
          voucher_refund: refund,
        }).toBytes(),
      ) as Awaited<ReturnType<typeof client.simulate>>,
    );
    expect(await getPositionSettlement(client, { positionId: 7n })).toEqual({
      positionId: 7n,
      isVoucher: true,
      grossPayout: gross,
      cashPayout: cash,
      voucherRefund: refund,
    });
    spy.mockRestore();
  });
  it("does not classify a missing/read-failed position as cash", async () => {
    const spy = vi.spyOn(client, "simulate").mockRejectedValue(new Error("missing position"));
    await expect(getPositionSettlement(client, { positionId: 7n })).rejects.toThrow(
      "missing position",
    );
    spy.mockRestore();
  });
});

it("reads distinct live order/position markers with exact u64 ids, not config version guesses", async () => {
  const spy = vi
    .spyOn(client, "simulate")
    .mockResolvedValue(
      result(bcs.bool().serialize(true).toBytes()) as Awaited<ReturnType<typeof client.simulate>>,
    );
  expect(await isVoucherOrder(client, { orderId: 9007199254740993n })).toBe(true);
  expect(await isVoucherPosition(client, { positionId: 9007199254740994n })).toBe(true);
  const functions = spy.mock.calls.map(([tx]) => listMoveCalls(tx).at(-1)?.function);
  expect(functions).toEqual(["is_voucher_order", "is_voucher_position"]);
  spy.mockRejectedValue(new Error("deleted"));
  await expect(isVoucherOrder(client, { orderId: 42n })).rejects.toThrow("deleted");
  spy.mockRestore();
});

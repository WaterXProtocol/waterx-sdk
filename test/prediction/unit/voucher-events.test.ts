/** Independent byte fixtures for contract #171's event layout; never serialize with the decoder under test. */
import { describe, expect, it } from "vitest";

import { predictionEventTypes as events } from "../../../src/prediction/index.ts";

const registry = `0x${"11".repeat(32)}`;
const account = `0x${"22".repeat(32)}`;
const granter = `0x${"33".repeat(32)}`;
const raw = 9_007_199_254_740_993n;
const address = (value: string) => Buffer.from(value.slice(2), "hex");
const u64 = (value: bigint) => {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(value);
  return bytes;
};
// All test strings/vectors are <128 bytes, so their ULEB128 length is one byte.
const coin = "1::credit::USD";
const typeName = Buffer.concat([Buffer.from([coin.length]), Buffer.from(coin)]);
const ledger = [u64(raw + 1n), u64(2n), u64(3n), u64(4n), typeName];
const ledgerValue = {
  amount: (raw + 1n).toString(),
  available: "2",
  reserved: "3",
  event_ts: "4",
  settlement_coin_type: { name: coin },
};
const identity = [address(registry), address(account)];
const identityValue = { market_registry_id: registry, account_id: account };

describe("Voucher event ABI bytes (#171)", () => {
  it.each(["VoucherGranterAdded", "VoucherGranterRemoved"] as const)("%s", (name) => {
    expect(events[name].parse(Buffer.concat([address(registry), address(granter)]))).toEqual({
      global_config_id: registry,
      granter,
    });
  });

  it("VoucherGranted includes granter and remaining budget in contract order", () => {
    expect(
      events.VoucherGranted.parse(
        Buffer.concat([
          ...identity,
          address(granter),
          u64(1n),
          u64(2n),
          u64(3n),
          u64(raw),
          u64(4n),
          typeName,
        ]),
      ),
    ).toEqual({
      ...identityValue,
      granter,
      amount: "1",
      available: "2",
      reserved: "3",
      grant_budget: raw.toString(),
      event_ts: "4",
      settlement_coin_type: { name: coin },
    });
  });

  it("VoucherRevoked", () => {
    expect(events.VoucherRevoked.parse(Buffer.concat([...identity, ...ledger]))).toEqual({
      ...identityValue,
      ...ledgerValue,
    });
  });

  it.each(["VoucherReserved", "VoucherReleased"] as const)("%s", (name) => {
    expect(events[name].parse(Buffer.concat([...identity, u64(raw), ...ledger]))).toEqual({
      ...identityValue,
      order_id: raw.toString(),
      ...ledgerValue,
    });
  });

  it("VoucherRestored", () => {
    expect(events.VoucherRestored.parse(Buffer.concat([...identity, u64(raw), ...ledger]))).toEqual(
      { ...identityValue, position_id: raw.toString(), ...ledgerValue },
    );
  });

  it("VoucherConsumed distinguishes spent from unused released credit", () => {
    expect(
      events.VoucherConsumed.parse(
        Buffer.concat([
          ...identity,
          u64(raw),
          u64(raw + 1n),
          u64(6n),
          u64(4n),
          u64(20n),
          u64(0n),
          u64(7n),
          typeName,
        ]),
      ),
    ).toEqual({
      ...identityValue,
      order_id: raw.toString(),
      position_id: (raw + 1n).toString(),
      amount: "6",
      released_amount: "4",
      available: "20",
      reserved: "0",
      event_ts: "7",
      settlement_coin_type: { name: coin },
    });
  });

  it("VoucherPauseChanged", () => {
    expect(
      events.VoucherPauseChanged.parse(Buffer.concat([address(registry), Buffer.from([1])])),
    ).toEqual({ market_registry_id: registry, paused: true });
  });

  it("VoucherGrantBudgetChanged", () => {
    expect(
      events.VoucherGrantBudgetChanged.parse(Buffer.concat([address(registry), u64(raw)])),
    ).toEqual({ market_registry_id: registry, grant_budget: raw.toString() });
  });

  it.each(["VoucherOrderPlaced", "VoucherPositionCreated"] as const)("%s", (name) => {
    const idField = name === "VoucherOrderPlaced" ? "order_id" : "position_id";
    expect(
      events[name].parse(Buffer.concat([address(registry), u64(raw), address(account), u64(4n)])),
    ).toEqual({ ...identityValue, [idField]: raw.toString(), event_ts: "4" });
  });

  it.each([
    { variant: 0, outcome: "No", gross: 0n, cash: 0n, refund: 0n },
    { variant: 1, outcome: "Yes", gross: 15n, cash: 9n, refund: 0n },
    { variant: 2, outcome: "Invalid", gross: 6n, cash: 0n, refund: 6n },
  ])("VoucherPositionSettled $outcome", ({ variant, outcome, gross, cash, refund }) => {
    const bytes = Buffer.concat([
      ...identity,
      u64(raw),
      u64(5n),
      Buffer.from([2, 65, 66, variant]),
      u64(6n),
      u64(gross),
      u64(cash),
      u64(refund),
      u64(7n),
      typeName,
    ]);
    const decoded = events.VoucherPositionSettled.parse(bytes);
    expect(decoded).toMatchObject({
      ...identityValue,
      position_id: raw.toString(),
      market_key: "5",
      market_id: [65, 66],
      filled_cost: "6",
      gross_payout: gross.toString(),
      cash_paid: cash.toString(),
      voucher_returned: refund.toString(),
      event_ts: "7",
      settlement_coin_type: { name: coin },
    });
    expect(decoded.outcome.$kind).toBe(outcome);
  });
});

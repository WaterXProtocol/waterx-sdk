import type { PredictClient } from "~predict/client.ts";
import type { IdArgument, MarketIdInput } from "~predict/types.ts";

/** Shared dummy IDs — valid-length hex IDs for PTB shape / simulate tests. */
export const PTB_DUMMY = {
  accountId: "0xf036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc51",
  coin: "0xd036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc52",
  delegate: "0xe036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc53",
  recipient: "0xa036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc54",
  adminCap: "0xb036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc55",
} as const;

export function minimalPlaceOrderParams(_client: PredictClient) {
  return {
    accountId: PTB_DUMMY.accountId as IdArgument,
    maxSpend: 1_000n,
    marketId: "0x01" as MarketIdInput,
    selection: "YES" as const,
    minShares: 1n,
    priceCapBps: 5000n,
    expiryTs: 9_999_999_999_999n,
  };
}

export function minimalAccountOpsParams() {
  return {
    accountId: PTB_DUMMY.accountId as IdArgument,
    delegate: PTB_DUMMY.delegate,
    alias: "vitest-delegate",
    permissions: 0xffffffff,
  };
}

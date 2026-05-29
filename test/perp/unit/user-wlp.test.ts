import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import {
  cancelRedeemWlp,
  mintWlp,
  requestRedeemWlp,
  settleRedeemWlp,
  updateTokenValue,
} from "../../../src/user/wlp.ts";
import { MOCK_USDC_TYPE } from "../helpers/fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const client = createUnitTestClient();
const accountId = PTB_DUMMY_ACCOUNT_ID;

describe("user/wlp PTB builders (v3)", () => {
  it("mintWlp", () => {
    const tx = new Transaction();
    mintWlp(client, tx, {
      accountId,
      depositTokenType: MOCK_USDC_TYPE,
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("requestRedeemWlp + cancelRedeemWlp", () => {
    const tx = new Transaction();
    requestRedeemWlp(client, tx, {
      accountId,
      redeemTokenType: MOCK_USDC_TYPE,
      lpAmount: 1_000_000n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);

    const tx2 = new Transaction();
    cancelRedeemWlp(client, tx2, { requestId: 1n });
    expect(tx2.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("settleRedeemWlp", () => {
    const tx = new Transaction();
    settleRedeemWlp(client, tx, {
      redeemTokenType: MOCK_USDC_TYPE,
      requestId: 1n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("mintWlp throws when wlp_aum missing", () => {
    const bare = createUnitTestClient();
    delete bare.config.packages.wlp.wlp_aum;
    const tx = new Transaction();
    expect(() =>
      mintWlp(bare, tx, {
        accountId,
        depositTokenType: MOCK_USDC_TYPE,
        depositAmount: 1n,
        minLpAmount: 0n,
      }),
    ).toThrow(/wlp_aum/);
  });

  it("updateTokenValue", () => {
    const tx = new Transaction();
    updateTokenValue(client, tx, { tokenType: MOCK_USDC_TYPE });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });
});

import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import {
  mintCredit,
  mintCreditFromRequest,
  mintCreditToAccount,
} from "../../../src/account/funding/custody.ts";
import {
  MOCK_CREDIT_TYPE,
  MOCK_CUSTODY_ASSET_TYPE,
} from "../../helpers/fixtures/mock-testnet-config.ts";
import {
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_DEPOSIT_COIN,
} from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const client = createUnitTestClient();
const accountId = PTB_DUMMY_ACCOUNT_ID;

describe("user/custody PTB builders (native_custody)", () => {
  it("mintCredit emits one moveCall and returns the deposit request", () => {
    const tx = new Transaction();
    const req = mintCredit(client, tx, {
      accountId,
      assetCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      assetType: MOCK_CUSTODY_ASSET_TYPE,
    });
    expect(req).toBeDefined();
    expect(tx.getData().commands?.length).toBe(1);
  });

  it("mintCredit defaults the CREDIT type to client.creditType()", () => {
    expect(client.creditType()).toBe(MOCK_CREDIT_TYPE);
    const tx = new Transaction();
    mintCredit(client, tx, {
      accountId,
      assetCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      assetType: MOCK_CUSTODY_ASSET_TYPE,
      extraData: new Uint8Array([1, 2, 3]),
    });
    expect(tx.getData().commands?.length).toBe(1);
  });

  it("mintCreditFromRequest emits one moveCall and returns the credit request", () => {
    const tx = new Transaction();
    const depositRequest = tx.object(PTB_DUMMY_DEPOSIT_COIN);
    const req = mintCreditFromRequest(client, tx, {
      depositRequest,
      assetType: MOCK_CUSTODY_ASSET_TYPE,
      creditType: MOCK_CREDIT_TYPE,
    });
    expect(req).toBeDefined();
    expect(tx.getData().commands?.length).toBe(1);
  });

  it("mintCreditFromRequest defaults creditType to client.creditType()", () => {
    const tx = new Transaction();
    mintCreditFromRequest(client, tx, {
      depositRequest: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      assetType: MOCK_CUSTODY_ASSET_TYPE,
    });
    expect(tx.getData().commands?.length).toBe(1);
  });

  it("mintCreditToAccount chains mint + consume_deposit_direct", () => {
    const tx = new Transaction();
    mintCreditToAccount(client, tx, {
      accountId,
      assetCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      assetType: MOCK_CUSTODY_ASSET_TYPE,
    });
    expect(tx.getData().commands?.length).toBe(2);
  });
});

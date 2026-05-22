import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { WaterXClient } from "../../src/client.ts";
import {
  burnCredit,
  mintCredit,
  mintCreditFromRequest,
  mintCreditToAccount,
} from "../../src/user/custody.ts";
import {
  MOCK_CREDIT_TYPE,
  MOCK_CUSTODY_ASSET_TYPE,
  MOCK_TESTNET_CONFIG,
} from "../helpers/fixtures/mock-testnet-config.ts";
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

  it("burnCredit emits one moveCall and returns the redeemed coin", () => {
    const tx = new Transaction();
    const coin = burnCredit(client, tx, {
      accountId,
      creditCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      assetType: MOCK_CUSTODY_ASSET_TYPE,
    });
    expect(coin).toBeDefined();
    expect(tx.getData().commands?.length).toBe(1);
  });

  it("throws a clear error when the credit pipeline is not configured", () => {
    const noCredit = structuredClone(MOCK_TESTNET_CONFIG);
    delete noCredit.packages.waterx_credit;
    delete noCredit.packages.native_custody;
    const clientNoCredit = new WaterXClient("TESTNET", noCredit, {
      grpcUrl: "https://fullnode.test.invalid:443",
    });
    expect(() =>
      mintCredit(clientNoCredit, new Transaction(), {
        accountId,
        assetCoin: new Transaction().object(PTB_DUMMY_DEPOSIT_COIN),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
        creditType: MOCK_CREDIT_TYPE,
      }),
    ).toThrow(/waterx_credit is not configured/);
  });

  it("throws when native_custody vault is missing but credit is present", () => {
    const noCustody = structuredClone(MOCK_TESTNET_CONFIG);
    delete noCustody.packages.native_custody;
    const clientNoCustody = new WaterXClient("TESTNET", noCustody, {
      grpcUrl: "https://fullnode.test.invalid:443",
    });
    expect(() =>
      burnCredit(clientNoCustody, new Transaction(), {
        accountId,
        creditCoin: new Transaction().object(PTB_DUMMY_DEPOSIT_COIN),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      }),
    ).toThrow(/native_custody is not configured/);
  });

  it("mintCreditToAccount throws when waterx_credit is missing", () => {
    const noCredit = structuredClone(MOCK_TESTNET_CONFIG);
    delete noCredit.packages.waterx_credit;
    const clientNoCredit = new WaterXClient("TESTNET", noCredit, {
      grpcUrl: "https://fullnode.test.invalid:443",
    });
    expect(() =>
      mintCreditToAccount(clientNoCredit, new Transaction(), {
        accountId,
        assetCoin: new Transaction().object(PTB_DUMMY_DEPOSIT_COIN),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      }),
    ).toThrow(/waterx_credit is not configured/);
  });

  it("mintCreditToAccount throws when native_custody vault is missing", () => {
    const noCustody = structuredClone(MOCK_TESTNET_CONFIG);
    delete noCustody.packages.native_custody;
    const clientNoCustody = new WaterXClient("TESTNET", noCustody, {
      grpcUrl: "https://fullnode.test.invalid:443",
    });
    expect(() =>
      mintCreditToAccount(clientNoCustody, new Transaction(), {
        accountId,
        assetCoin: new Transaction().object(PTB_DUMMY_DEPOSIT_COIN),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      }),
    ).toThrow(/native_custody is not configured/);
  });
});

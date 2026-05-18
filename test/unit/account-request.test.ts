import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { makeSenderRequest } from "../../src/utils/account-request.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";
import { mockSuiAddress } from "../helpers/fixtures/sui-mock-fixtures.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const BUCKET_PKG = MOCK_TESTNET_CONFIG.packages.bucket_framework.published_at;

type MoveCallCmd = {
  MoveCall: { package?: string; module: string; function: string };
};

function firstMoveCall(tx: Transaction): MoveCallCmd | undefined {
  const cmd = tx.getData().commands?.[0];
  return cmd && "MoveCall" in cmd ? (cmd as MoveCallCmd) : undefined;
}

describe("makeSenderRequest", () => {
  const client = createUnitTestClient();

  it("calls account::request when bucketAccount is undefined", () => {
    const tx = new Transaction();
    makeSenderRequest(client, tx, undefined);
    const call = firstMoveCall(tx);
    expect(call?.MoveCall.package).toBe(BUCKET_PKG);
    expect(call?.MoveCall.module).toBe("account");
    expect(call?.MoveCall.function).toBe("request");
  });

  it("calls account::request_with_account when bucketAccount is an object id", () => {
    const tx = new Transaction();
    const bucketId = mockSuiAddress("cc");
    makeSenderRequest(client, tx, bucketId);
    const call = firstMoveCall(tx);
    expect(call?.MoveCall.function).toBe("request_with_account");
    expect(call?.MoveCall.package).toBe(BUCKET_PKG);
  });

  it("calls account::request_with_account when bucketAccount is a TransactionArgument", () => {
    const tx = new Transaction();
    const bucketArg = tx.object(mockSuiAddress("dd"));
    makeSenderRequest(client, tx, bucketArg);
    const call = firstMoveCall(tx);
    expect(call?.MoveCall.function).toBe("request_with_account");
    expect(call?.MoveCall.package).toBe(BUCKET_PKG);
  });

  it("string and TransactionArgument paths both differ from plain request", () => {
    const txPlain = new Transaction();
    makeSenderRequest(client, txPlain, undefined);

    const txString = new Transaction();
    makeSenderRequest(client, txString, mockSuiAddress("ee"));

    const txArg = new Transaction();
    makeSenderRequest(client, txArg, txArg.object(mockSuiAddress("ff")));

    expect(firstMoveCall(txPlain)?.MoveCall.function).toBe("request");
    expect(firstMoveCall(txString)?.MoveCall.function).toBe("request_with_account");
    expect(firstMoveCall(txArg)?.MoveCall.function).toBe("request_with_account");
  });
});

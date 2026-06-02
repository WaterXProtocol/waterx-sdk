import { describe, expect, it } from "vitest";

import { findObjectIdByType, registryAccountIdFromAccountCreated } from "../helpers/tx-result.ts";

describe("findObjectIdByType", () => {
  it("reads created objects from grpc effects + objectTypes", () => {
    const accountType =
      "0x2d9b1eb3958fad8ff619d30d959351ecce851fcea231fa362b36d52c76b339b5::account::Account";
    const accountId = "0xabc";
    const result = {
      $kind: "Transaction",
      Transaction: {
        digest: "0xdigest",
        effects: {
          changedObjects: [{ objectId: accountId, idOperation: "Created" }],
        },
        objectTypes: { [accountId]: accountType },
      },
    };
    expect(findObjectIdByType(result, "::account::Account")).toBe(accountId);
  });

  it("does not match AccountRegistry when using exactSuffix", () => {
    const registryType =
      "0x2d9b1eb3958fad8ff619d30d959351ecce851fcea231fa362b36d52c76b339b5::account::AccountRegistry";
    const registryId = "0xregistry";
    const result = {
      $kind: "Transaction",
      Transaction: {
        objectTypes: { [registryId]: registryType },
        effects: { changedObjects: [{ objectId: registryId, idOperation: "Mutated" }] },
      },
    };
    expect(findObjectIdByType(result, "::account::Account", { exactSuffix: true })).toBeUndefined();
  });
});

describe("registryAccountIdFromAccountCreated", () => {
  it("reads account_object_address from AccountCreated event", () => {
    const pkg = "0x2d9b1eb3958fad8ff619d30d959351ecce851fcea231fa362b36d52c76b339b5";
    const accountId = "0xed1ad624f24c36c234e9e9aac008c85ab6e104a8543746b85a001315a8b82e6f";
    const result = {
      $kind: "Transaction",
      Transaction: {
        events: [
          {
            eventType: `${pkg}::events::AccountCreated`,
            json: { account_object_address: accountId, alias: "seed", owner: "0x1" },
          },
        ],
      },
    };
    expect(registryAccountIdFromAccountCreated(result, pkg)).toBe(accountId);
  });
});

import { Transaction } from "@mysten/sui/transactions";
import { normalizeStructTag } from "@mysten/sui/utils";
import { describe, expect, it } from "vitest";

import {
  creditStackForAsset,
  creditStacks,
  resolveCreditStack,
} from "../../../src/account/credit-stack.ts";
import { enqueueWithdrawal } from "../../../src/account/funding/credit.ts";
import { mintCredit } from "../../../src/account/funding/custody.ts";
import {
  MOCK_CREDIT_TYPE,
  MOCK_CUSTODY_ASSET_TYPE,
  MOCK_SUI_CREDIT,
  MOCK_TESTNET_CONFIG,
} from "../../helpers/fixtures/mock-testnet-config.ts";
import {
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_DEPOSIT_COIN,
} from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const config = MOCK_TESTNET_CONFIG;
const client = createUnitTestClient();

type MoveCallCmd = {
  MoveCall: { module: string; function: string; typeArguments: string[]; arguments: unknown[] };
};

/** Object ids the PTB's inputs reference, in input order. */
function objectInputIds(tx: Transaction): string[] {
  return tx
    .getData()
    .inputs.map((input) => input.UnresolvedObject?.objectId ?? input.Object?.SharedObject?.objectId)
    .filter((id): id is string => id !== undefined);
}

function firstMoveCall(tx: Transaction): MoveCallCmd {
  const cmd = tx.getData().commands[0];
  if (!cmd || !("MoveCall" in cmd)) throw new Error("no MoveCall");
  return cmd as MoveCallCmd;
}

describe("creditStacks", () => {
  it("joins registries / vaults / queues by alias and normalizes the credit type", () => {
    const stacks = creditStacks(config);
    expect(Object.keys(stacks).sort()).toEqual(["SUI", "USD"]);

    const usd = stacks.USD!;
    expect(usd.registry).toBe(config.objects.credit.registry);
    expect(usd.creditType).toBe(normalizeStructTag(config.objects.credit.credit_type));
    expect(usd.vault).toBe(config.objects.custody.vault);
    expect(usd.assets).toEqual(config.objects.custody.assets);
    expect(usd.queue).toBe(config.objects.withdrawal_queue.queue);
    expect(usd.executors).toEqual(config.objects.withdrawal_queue.executors);
    expect(usd.decimals).toBe(6);

    const sui = stacks.SUI!;
    expect(sui).toMatchObject({
      alias: "SUI",
      creditType: normalizeStructTag(MOCK_SUI_CREDIT.creditType),
      registry: MOCK_SUI_CREDIT.registry,
      vault: MOCK_SUI_CREDIT.vault,
      queue: MOCK_SUI_CREDIT.queue,
      decimals: 6,
    });
    expect(sui.assets.map((a) => a.type)).toEqual([MOCK_SUI_CREDIT.assetType]);
  });

  it("throws on a half-wired credit (registry without vault or queue)", () => {
    const noVault = structuredClone(config);
    delete (noVault.objects.custody.vaults as Record<string, unknown>).SUI;
    expect(() => creditStacks(noVault)).toThrow(/credit SUI: .*no objects\.custody\.vaults entry/);

    const noQueue = structuredClone(config);
    delete (noQueue.objects.withdrawal_queue.queues as Record<string, unknown>).SUI;
    expect(() => creditStacks(noQueue)).toThrow(
      /credit SUI: .*no objects\.withdrawal_queue\.queues entry/,
    );
  });
});

describe("resolveCreditStack", () => {
  it("defaults to the credit objects.credit.credit_type names (USD)", () => {
    const stack = resolveCreditStack(config);
    expect(stack.alias).toBe("USD");
    expect(stack.creditType).toBe(normalizeStructTag(MOCK_CREDIT_TYPE));
  });

  it("resolves by alias, case-insensitively", () => {
    expect(resolveCreditStack(config, "SUI").registry).toBe(MOCK_SUI_CREDIT.registry);
    expect(resolveCreditStack(config, "sui").registry).toBe(MOCK_SUI_CREDIT.registry);
    expect(resolveCreditStack(config, "usd").alias).toBe("USD");
  });

  it("resolves by Move type in any normalization", () => {
    const short = MOCK_SUI_CREDIT.creditType.replace(/^0x0+/, "0x");
    expect(resolveCreditStack(config, MOCK_SUI_CREDIT.creditType).alias).toBe("SUI");
    expect(resolveCreditStack(config, short).alias).toBe("SUI");
    expect(resolveCreditStack(config, normalizeStructTag(MOCK_CREDIT_TYPE)).alias).toBe("USD");
  });

  it("never falls back to USD for an unknown credit", () => {
    expect(() => resolveCreditStack(config, "DEEP")).toThrow(
      /no credit stack named DEEP \(known: USD, SUI\)/,
    );
    expect(() => resolveCreditStack(config, "0x2::sui::SUI")).toThrow(
      /no credit stack for coin type 0x2::sui::SUI/,
    );
  });
});

describe("creditStackForAsset", () => {
  it("finds the stack whose vault registers the backing asset", () => {
    expect(creditStackForAsset(config, MOCK_CUSTODY_ASSET_TYPE)?.alias).toBe("USD");
    expect(creditStackForAsset(config, MOCK_SUI_CREDIT.assetType)?.alias).toBe("SUI");
    expect(creditStackForAsset(config, "0x2::sui::SUI")?.alias).toBe("SUI");
    expect(creditStackForAsset(config, "0xdead::coin::COIN")).toBeUndefined();
  });

  it("client.getNativeAsset searches every credit's vault", () => {
    expect(client.getNativeAsset(MOCK_SUI_CREDIT.assetType).name).toBe("SUI");
    expect(client.getNativeAsset(MOCK_CUSTODY_ASSET_TYPE).name).toBe("MOCK_USDC");
    expect(() => client.getNativeAsset("0xdead::coin::COIN")).toThrow(/No native custody asset/);
  });
});

describe("builders pair a non-default credit with ITS OWN objects", () => {
  it("mintCredit(creditType: 'SUI') targets the SUI vault + registry and mints <SUI, SUI-credit>", () => {
    const tx = new Transaction();
    mintCredit(client, tx, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      assetCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      assetType: MOCK_SUI_CREDIT.assetType,
      creditType: "SUI",
    });
    const call = firstMoveCall(tx);
    expect(call.MoveCall.function).toBe("mint");
    expect(call.MoveCall.typeArguments).toEqual([
      normalizeStructTag(MOCK_SUI_CREDIT.assetType),
      normalizeStructTag(MOCK_SUI_CREDIT.creditType),
    ]);
    const ids = objectInputIds(tx);
    expect(ids).toContain(MOCK_SUI_CREDIT.vault);
    expect(ids).toContain(MOCK_SUI_CREDIT.registry);
    expect(ids).not.toContain(config.objects.custody.vault);
    expect(ids).not.toContain(config.objects.credit.registry);
  });

  it("mintCredit without creditType still targets the USD (default) stack", () => {
    const tx = new Transaction();
    mintCredit(client, tx, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      assetCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      assetType: MOCK_CUSTODY_ASSET_TYPE,
    });
    const ids = objectInputIds(tx);
    expect(ids).toContain(config.objects.custody.vault);
    expect(ids).toContain(config.objects.credit.registry);
    expect(firstMoveCall(tx).MoveCall.typeArguments[1]).toBe(normalizeStructTag(MOCK_CREDIT_TYPE));
  });

  it("enqueueWithdrawal(creditType: <SUI type>) targets the SUI queue", () => {
    const tx = new Transaction();
    enqueueWithdrawal(client, tx, {
      withdrawRequest: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      creditType: MOCK_SUI_CREDIT.creditType,
    });
    const call = firstMoveCall(tx);
    expect(call.MoveCall.function).toBe("enqueue");
    expect(call.MoveCall.typeArguments).toEqual([normalizeStructTag(MOCK_SUI_CREDIT.creditType)]);
    const ids = objectInputIds(tx);
    expect(ids).toContain(MOCK_SUI_CREDIT.queue);
    expect(ids).not.toContain(config.objects.withdrawal_queue.queue);
  });

  it("client.creditStack / creditStacks expose the resolver", () => {
    expect(client.creditStack("SUI").queue).toBe(MOCK_SUI_CREDIT.queue);
    expect(client.creditStack().alias).toBe("USD");
    expect(Object.keys(client.creditStacks()).sort()).toEqual(["SUI", "USD"]);
  });
});

/**
 * Unit tests for fetch helpers (coin selection, balance) via mocked gRPC.
 */
import { bcs } from "@mysten/sui/bcs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WaterXClient } from "../../src/client";
import {
  getAccountBalance,
  getAccountCoins,
  getAccountDelegates,
  getAccountObjectId,
  getAccountsByOwner,
  getMarketCooldownMs,
  selectCoinsForAmount,
} from "../../src/fetch";
import {
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_DEPOSIT_COIN,
  PTB_DUMMY_ID_CC,
} from "../helpers/fixtures/ptb-test-dummies.ts";
import { mockSuiAddress } from "../helpers/fixtures/sui-mock-fixtures.ts";

describe("getAccountCoins", () => {
  const accountId = PTB_DUMMY_ACCOUNT_ID;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses listCoins when coinType is set", async () => {
    const client = WaterXClient.testnet();
    const listCoins = vi.spyOn(client.grpcClient, "listCoins").mockResolvedValue({
      objects: [
        {
          objectId: "0xc1",
          type: "0x2::coin::Coin<0xusdc>",
          balance: "100",
          version: "3",
          digest: "dx",
        },
      ],
    } as any);

    const coins = await getAccountCoins(client, accountId, "0xusdc::USDC");
    expect(listCoins).toHaveBeenCalledWith({
      owner: accountId,
      coinType: "0xusdc::USDC",
    });
    expect(coins).toHaveLength(1);
    expect(coins[0]!.objectId).toBe("0xc1");
    expect(coins[0]!.balance).toBe("100");
  });

  it("listCoins path synthesizes type and zero balance when omitted", async () => {
    const client = WaterXClient.testnet();
    const ct = "0xcafe::coin::COIN";
    vi.spyOn(client.grpcClient, "listCoins").mockResolvedValue({
      objects: [{ objectId: "0xraw" }],
    } as any);

    const coins = await getAccountCoins(client, accountId, ct);
    expect(coins[0]!.type).toBe(`0x2::coin::Coin<${ct}>`);
    expect(coins[0]!.balance).toBe("0");
  });

  it("uses listOwnedObjects when coinType is omitted", async () => {
    const client = WaterXClient.testnet();
    const listOwned = vi.spyOn(client.grpcClient, "listOwnedObjects").mockResolvedValue({
      objects: [
        {
          objectId: "0xc2",
          type: "0x2::coin::Coin<0xusdc>",
          json: { balance: "50" },
          version: "1",
          digest: "dy",
        },
      ],
    } as any);

    const coins = await getAccountCoins(client, accountId);
    expect(listOwned).toHaveBeenCalledWith({
      owner: accountId,
      type: "0x2::coin::Coin",
    });
    expect(coins[0]!.balance).toBe("50");
  });

  it("listOwnedObjects path uses empty type and zero balance when omitted", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "listOwnedObjects").mockResolvedValue({
      objects: [{ objectId: "0xcmin", version: "2", digest: "dz" }],
    } as any);

    const coins = await getAccountCoins(client, accountId);
    expect(coins[0]!.type).toBe("");
    expect(coins[0]!.balance).toBe("0");
  });

  it("listOwnedObjects path defaults version and digest when omitted", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "listOwnedObjects").mockResolvedValue({
      objects: [{ objectId: "0xcver" }],
    } as any);

    const coins = await getAccountCoins(client, accountId);
    expect(coins[0]!.version).toBe("0");
    expect(coins[0]!.digest).toBe("");
  });
});

describe("getAccountBalance", () => {
  const accountId = PTB_DUMMY_DEPOSIT_COIN;

  it("sums coin balances", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "listCoins").mockResolvedValue({
      objects: [
        { objectId: "0xa", balance: "100", version: "1", digest: "d" },
        { objectId: "0xb", balance: "40", version: "1", digest: "d" },
      ],
    } as any);

    const total = await getAccountBalance(client, accountId, "0x::t::T");
    expect(total).toBe(140n);
  });

  it("returns 0 when no coins", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "listCoins").mockResolvedValue({
      objects: [],
    } as any);

    const total = await getAccountBalance(client, accountId, "0x::t::T");
    expect(total).toBe(0n);
  });
});

describe("selectCoinsForAmount", () => {
  const accountId = PTB_DUMMY_ID_CC;
  const coinType = "0x2::usdc::USDC";

  function mockListCoins(
    client: WaterXClient,
    objects: Array<{ objectId: string; balance: string }>,
  ) {
    vi.spyOn(client.grpcClient, "listCoins").mockResolvedValue({
      objects: objects.map((o) => ({
        ...o,
        version: "1",
        digest: "d",
        type: `0x2::coin::Coin<${coinType}>`,
      })),
    } as any);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("picks largest coin first and stops when requirement met", async () => {
    const client = WaterXClient.testnet();
    mockListCoins(client, [
      { objectId: "0xs", balance: "30" },
      { objectId: "0xl", balance: "200" },
    ]);

    const out = await selectCoinsForAmount(client, accountId, coinType, 100n);
    expect(out.coins.map((c) => c.objectId)).toEqual(["0xl"]);
    expect(out.totalBalance).toBe(200n);
  });

  it("merges multiple coins when one is not enough", async () => {
    const client = WaterXClient.testnet();
    mockListCoins(client, [
      { objectId: "0xa", balance: "40" },
      { objectId: "0xb", balance: "70" },
      { objectId: "0xc", balance: "10" },
    ]);

    const out = await selectCoinsForAmount(client, accountId, coinType, 100n);
    expect(out.coins.map((c) => c.objectId)).toEqual(["0xb", "0xa"]);
    expect(out.totalBalance).toBe(110n);
  });

  it("handles equal balances in sort comparator", async () => {
    const client = WaterXClient.testnet();
    mockListCoins(client, [
      { objectId: "0x1", balance: "50" },
      { objectId: "0x2", balance: "50" },
    ]);

    const out = await selectCoinsForAmount(client, accountId, coinType, 100n);
    expect(out.totalBalance).toBe(100n);
    expect(out.coins).toHaveLength(2);
  });

  it("throws when combined balance is insufficient", async () => {
    const client = WaterXClient.testnet();
    mockListCoins(client, [{ objectId: "0xa", balance: "30" }]);

    await expect(selectCoinsForAmount(client, accountId, coinType, 100n)).rejects.toThrow(
      /Insufficient balance/,
    );
  });
});

describe("getAccountObjectId / getAccountDelegates (mocked simulate)", () => {
  const accountId = mockSuiAddress("d1");

  /** `view::*` helpers resolve package via `getObject` on shared refs — stub before mocking `simulate`. */
  function testClientWithViewStub() {
    const client = WaterXClient.testnet();
    vi.spyOn(client, "getObject").mockResolvedValue({
      object: { type: `${client.config.packageId}::stub::Stub` },
    } as any);
    return client;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * v2 `account_data` returns a vector<AccountData> (delegates inlined). `getAccountsByOwner`,
   * `getAccountObjectId` and `getAccountDelegates` all decode from the same BCS payload.
   */
  function accountDataRow() {
    const delegateRow = bcs.struct("DelegateData", {
      delegate_address: bcs.Address,
      permissions: bcs.u16(),
    });
    return bcs.struct("AccountData", {
      account_id: bcs.Address,
      account_object_address: bcs.Address,
      name: bcs.string(),
      owner_address: bcs.Address,
      delegates: bcs.vector(delegateRow),
    });
  }

  it("getAccountsByOwner maps account_data vector (delegates inlined)", async () => {
    const client = testClientWithViewStub();
    const owner = `0x${"e0".repeat(32)}`;
    const accId = `0x${"e3".repeat(32)}`;
    const accObj = `0x${"e4".repeat(32)}`;
    const vecBytes = bcs
      .vector(accountDataRow())
      .serialize([
        {
          account_id: accId,
          account_object_address: accObj,
          name: "main",
          owner_address: owner,
          delegates: [
            { delegate_address: `0x${"d2".repeat(32)}`, permissions: 42 },
            { delegate_address: `0x${"d3".repeat(32)}`, permissions: 7 },
          ],
        },
      ])
      .toBytes();

    vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [{ returnValues: [{ bcs: Uint8Array.from(vecBytes) }] }],
    } as any);

    const rows = await getAccountsByOwner(client, owner);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe("main");
    expect(rows[0]!.accountId).toBe(accId);
    expect(rows[0]!.accountObjectAddress).toBe(accObj);
    expect(rows[0]!.delegates).toHaveLength(2);
    expect(rows[0]!.delegates[0]!.permissions).toBe(42);
  });

  it("getAccountObjectId filters accountsByOwner by accountId", async () => {
    const client = testClientWithViewStub();
    const owner = `0x${"e0".repeat(32)}`;
    const accObj = `0x${"e4".repeat(32)}`;
    const vecBytes = bcs
      .vector(accountDataRow())
      .serialize([
        {
          account_id: accountId,
          account_object_address: accObj,
          name: "main",
          owner_address: owner,
          delegates: [],
        },
      ])
      .toBytes();
    vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [{ returnValues: [{ bcs: Uint8Array.from(vecBytes) }] }],
    } as any);

    const out = await getAccountObjectId(client, owner, accountId);
    expect(out).toBe(accObj);
  });

  it("getAccountObjectId throws for unknown accountId", async () => {
    const client = testClientWithViewStub();
    const owner = `0x${"e0".repeat(32)}`;
    const vecBytes = bcs.vector(accountDataRow()).serialize([]).toBytes();
    vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [{ returnValues: [{ bcs: Uint8Array.from(vecBytes) }] }],
    } as any);

    await expect(getAccountObjectId(client, owner, accountId)).rejects.toThrow(/not found/);
  });

  it("getAccountObjectId surfaces FailedTransaction simulate errors", async () => {
    const client = testClientWithViewStub();
    const owner = `0x${"e0".repeat(32)}`;
    vi.spyOn(client, "simulate").mockResolvedValue({
      $kind: "FailedTransaction",
      FailedTransaction: { status: { error: { message: "move abort" } } },
    } as any);

    await expect(getAccountObjectId(client, owner, accountId)).rejects.toThrow(
      /Simulate transaction failed: move abort/,
    );
  });

  it("getAccountDelegates returns inlined delegates for the matching account", async () => {
    const client = testClientWithViewStub();
    const owner = `0x${"e0".repeat(32)}`;
    const accObj = `0x${"e4".repeat(32)}`;
    const vecBytes = bcs
      .vector(accountDataRow())
      .serialize([
        {
          account_id: accountId,
          account_object_address: accObj,
          name: "main",
          owner_address: owner,
          delegates: [{ delegate_address: `0x${"d2".repeat(32)}`, permissions: 42 }],
        },
      ])
      .toBytes();
    vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [{ returnValues: [{ bcs: Uint8Array.from(vecBytes) }] }],
    } as any);

    const rows = await getAccountDelegates(client, owner, accountId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.permissions).toBe(42);
    expect(rows[0]!.delegateAddress).toMatch(/^0x[0-9a-f]+$/i);
  });
});

describe("getMarketCooldownMs", () => {
  const marketId = "0x" + "ab".repeat(32);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses string numeric cooldown_ms", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({
      object: {
        json: {
          fields: {
            config: { fields: { cooldown_ms: " 9000 " } },
          },
        },
      },
    } as any);
    await expect(getMarketCooldownMs(client, marketId)).resolves.toBe(9000n);
  });

  it("returns bigint cooldown_ms when JSON already uses bigint", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({
      object: {
        json: {
          fields: {
            config: { fields: { cooldown_ms: 12_000n } },
          },
        },
      },
    } as any);
    await expect(getMarketCooldownMs(client, marketId)).resolves.toBe(12_000n);
  });

  it("throws when cooldown_ms is not a supported scalar", async () => {
    const client = WaterXClient.testnet();
    vi.spyOn(client.grpcClient, "getObject").mockResolvedValue({
      object: {
        json: {
          fields: {
            config: { fields: { cooldown_ms: { nested: true } } },
          },
        },
      },
    } as any);
    await expect(getMarketCooldownMs(client, marketId)).rejects.toThrow(
      /unexpected cooldown_ms type/,
    );
  });
});

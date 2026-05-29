import {
  getAccountData,
  getAccountIds,
  getAccountOrderIds,
  getAccountOrderIdsByMarketId,
  getAccountPositionIds,
  getAccountPositionIdsByMarketId,
  getAllowedVersions,
  getKeeperAddresses,
  getMarketById,
  getMarketByKey,
  getMarketExposure,
  getMarketExposureByKey,
  getOrder,
  getOrderCursor,
  getPosition,
  getPositionCursor,
  getRegistry,
  getResolvedMarketCursor,
  getUnresolvedMarketCursor,
  isKeeper,
  isPredictionProtocolAssetAllowed,
} from "~predict/fetch.ts";
import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import {
  accountDataViewBytes,
  addressVectorBytes,
  boolBytes,
  cursorViewBytes,
  marketViewBytes,
  orderViewBytes,
  positionViewBytes,
  registryViewBytes,
  u16VectorBytes,
  u64Bytes,
  u64VectorBytes,
} from "../fixtures/bcs-bytes.ts";
import { accountDataFixture } from "../fixtures/bcs-fixtures.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import {
  mockCommandResults,
  mockCommandResultsUint8,
  mockEmptyCommandResults,
  mockFailedTransaction,
  mockLegacyResults,
  stubSimulateResolved,
  type MockSimulateFn,
  type MockSimulateResult,
} from "../helpers/mock-simulate.ts";

function clientWithSimulate(simulateImpl: Mock<MockSimulateFn>) {
  const client = createMockPredictClient();
  vi.spyOn(client, "simulate").mockImplementation(simulateImpl);
  return client;
}

describe("fetch view helpers", () => {
  it("getRegistry parses commandResults BCS", async () => {
    const client = clientWithSimulate(
      stubSimulateResolved(mockCommandResults([registryViewBytes()])),
    );
    const view = await getRegistry(client);
    expect(view.balance).toBe(100n);
    expect(view.nextOrderId).toBe(12n);
  });

  it("getOrder / getPosition / getMarketById / getMarketByKey", async () => {
    const client = createMockPredictClient();
    const simulate = vi
      .fn<MockSimulateFn>()
      .mockResolvedValueOnce(mockCommandResults([orderViewBytes()]))
      .mockResolvedValueOnce(mockCommandResults([positionViewBytes()]))
      .mockResolvedValueOnce(mockCommandResults([marketViewBytes()]))
      .mockResolvedValueOnce(mockCommandResults([marketViewBytes()]));
    vi.spyOn(client, "simulate").mockImplementation(simulate);

    const order = await getOrder(client, { orderId: 11n });
    expect(order.orderId).toBe(11n);

    const position = await getPosition(client, { positionId: 7n });
    expect(position.positionId).toBe(7n);

    const byId = await getMarketById(client, { marketId: new Uint8Array([9]) });
    expect(byId.marketKey).toBe(42n);

    const byKey = await getMarketByKey(client, { marketKey: 42n });
    expect(byKey.marketKey).toBe(42n);
  });

  it("getMarketExposure / getMarketExposureByKey read four return values", async () => {
    const client = clientWithSimulate(
      stubSimulateResolved(
        mockCommandResults([u64Bytes(1n), u64Bytes(2n), u64Bytes(3n), u64Bytes(4n)]),
      ),
    );

    await expect(getMarketExposure(client, { marketId: new Uint8Array([9]) })).resolves.toEqual({
      yesShares: 1n,
      yesCost: 2n,
      noShares: 3n,
      noCost: 4n,
    });

    await expect(getMarketExposureByKey(client, { marketKey: 42n })).resolves.toEqual({
      yesShares: 1n,
      yesCost: 2n,
      noShares: 3n,
      noCost: 4n,
    });
  });

  it("cursor helpers read three return values", async () => {
    const client = clientWithSimulate(stubSimulateResolved(mockCommandResults(cursorViewBytes())));

    await expect(getOrderCursor(client)).resolves.toEqual({
      count: 5n,
      front: 2n,
      back: null,
    });
    await expect(getPositionCursor(client)).resolves.toEqual({
      count: 5n,
      front: 2n,
      back: null,
    });
    await expect(getUnresolvedMarketCursor(client)).resolves.toEqual({
      count: 5n,
      front: 2n,
      back: null,
    });
    await expect(getResolvedMarketCursor(client)).resolves.toEqual({
      count: 5n,
      front: 2n,
      back: null,
    });
  });

  it("getAccountIds parses address vector from account_ids", async () => {
    const owner = "0x26266b1381bcf03ab3acc37c1e87beffb52d49f345248bc3efb9114176990ae4";
    const ids = [
      "0x4e7598c3c095fbd274f4b04f6dd3715ab59bff744730f9b56d7312cedba4f054",
      "0xed1ad624f24c36c234e9e9aac008c85ab6e104a8543746b85a001315a8b82e6f",
    ];
    const client = clientWithSimulate(
      stubSimulateResolved(mockCommandResults([addressVectorBytes(ids)])),
    );
    await expect(getAccountIds(client, { owner })).resolves.toEqual(ids);
  });

  it("getAccountData and account id lists", async () => {
    const client = createMockPredictClient();
    const accountId = accountDataFixture.account_id;
    const idsBytes = u64VectorBytes([1n, 2n]);

    vi.spyOn(client, "simulate")
      .mockResolvedValueOnce(mockCommandResults([accountDataViewBytes()]))
      .mockResolvedValueOnce(mockCommandResults([idsBytes]))
      .mockResolvedValueOnce(mockCommandResults([idsBytes]))
      .mockResolvedValueOnce(mockCommandResults([idsBytes]))
      .mockResolvedValueOnce(mockCommandResults([idsBytes]));

    const data = await getAccountData(client, { accountId });
    expect(data.hasData).toBe(true);

    await expect(getAccountOrderIds(client, { accountId, marketKey: 1n })).resolves.toEqual([
      1n,
      2n,
    ]);
    await expect(getAccountPositionIds(client, { accountId, marketKey: 1n })).resolves.toEqual([
      1n,
      2n,
    ]);
    await expect(
      getAccountOrderIdsByMarketId(client, { accountId, marketId: new Uint8Array([9]) }),
    ).resolves.toEqual([1n, 2n]);
    await expect(
      getAccountPositionIdsByMarketId(client, { accountId, marketId: new Uint8Array([9]) }),
    ).resolves.toEqual([1n, 2n]);
  });

  it("isKeeper, getKeeperAddresses, getAllowedVersions, protocol asset gate", async () => {
    const keeper = "0xb036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc55";
    const client = createMockPredictClient();
    vi.spyOn(client, "simulate")
      .mockResolvedValueOnce(mockCommandResults([boolBytes(true)]))
      .mockResolvedValueOnce(mockCommandResults([addressVectorBytes([keeper])]))
      .mockResolvedValueOnce(mockCommandResults([u16VectorBytes([1, 2])]))
      .mockResolvedValueOnce(mockCommandResults([boolBytes(true)]));

    await expect(isKeeper(client, { keeper })).resolves.toBe(true);
    await expect(getKeeperAddresses(client)).resolves.toEqual([keeper]);
    await expect(getAllowedVersions(client)).resolves.toEqual([1, 2]);
    await expect(isPredictionProtocolAssetAllowed(client)).resolves.toBe(true);
  });

  it("supports legacy simulate return shape", async () => {
    const client = clientWithSimulate(
      stubSimulateResolved(mockLegacyResults([registryViewBytes()])),
    );
    const view = await getRegistry(client);
    expect(view.orderCount).toBe(10n);
  });

  it("accepts Uint8Array bcs in commandResults (not only number[])", async () => {
    const client = clientWithSimulate(
      stubSimulateResolved(mockCommandResultsUint8([registryViewBytes()])),
    );
    const view = await getRegistry(client);
    expect(view.balance).toBe(100n);
  });

  it("surfaces FailedTransaction errors", async () => {
    const client = clientWithSimulate(
      stubSimulateResolved(mockFailedTransaction("dry-run failed")),
    );
    await expect(getRegistry(client)).rejects.toThrow(
      /Simulate transaction failed: dry-run failed/,
    );
  });

  it("serializes FailedTransaction error when message is missing", async () => {
    const client = clientWithSimulate(
      stubSimulateResolved({
        $kind: "FailedTransaction",
        FailedTransaction: { status: { error: { code: 42 } } },
      } as unknown as MockSimulateResult),
    );
    await expect(getRegistry(client)).rejects.toThrow(/Simulate transaction failed:.*"code":42/);
  });

  it("throws when return value is missing", async () => {
    const client = clientWithSimulate(stubSimulateResolved(mockEmptyCommandResults()));
    await expect(getRegistry(client)).rejects.toThrow(/No return value at command\[0\]/);
  });
});

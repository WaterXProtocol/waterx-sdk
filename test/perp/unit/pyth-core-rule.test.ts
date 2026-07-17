/**
 * `PythCoreRule` unit tests — mechanical `PriceUpdateRule` wrap around
 * `buildPythPriceUpdateCalls` / `fetchPriceFeedsUpdateData`. Hermes fetch and
 * the Pyth on-chain gRPC reads are mocked; no real network.
 */
import { toHex } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPythPriceUpdateCalls, PythCache } from "../../../src/oracle/pyth.ts";
import { PythCoreRule } from "../../../src/oracle/rules/pyth-core-rule.ts";
import { attachPythGrpcMocks, mockAccumulatorUpdate } from "../helpers/fixtures/pyth-mock-grpc.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

/** `module::function` for every MoveCall command in a built PTB. */
function moveTargets(tx: Transaction): string[] {
  const out: string[] = [];
  for (const c of tx.getData().commands ?? []) {
    if (c.$kind === "MoveCall" && c.MoveCall) {
      out.push(`${c.MoveCall.module}::${c.MoveCall.function}`);
    }
  }
  return out;
}

describe("PythCoreRule.kind", () => {
  it("is 'pyth_rule'", () => {
    expect(PythCoreRule.kind).toBe("pyth_rule");
  });
});

describe("PythCoreRule.supportedTickers", () => {
  it("returns only tickers with pyth feeds configured", () => {
    const client = createUnitTestClient();
    expect(PythCoreRule.supportedTickers(client).sort()).toEqual(["BTCUSD", "ETHUSD", "USDCUSD"]);
  });

  it("excludes a ticker removed from pyth_rule.feeds", () => {
    const client = createUnitTestClient();
    delete client.config.packages.pyth_rule!.feeds.USDCUSD;
    expect(PythCoreRule.supportedTickers(client).sort()).toEqual(["BTCUSD", "ETHUSD"]);
  });

  it("returns an empty array when pyth_rule.feeds is empty", () => {
    const client = createUnitTestClient();
    client.config.packages.pyth_rule!.feeds = {};
    expect(PythCoreRule.supportedTickers(client)).toEqual([]);
  });
});

describe("PythCoreRule.fetchUpdateData", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("resolves feed ids and returns the wrapped payload", async () => {
    const client = createUnitTestClient();
    const update = mockAccumulatorUpdate();
    let requestedUrl: string | undefined;
    globalThis.fetch = vi.fn(async (url: string | URL) => {
      requestedUrl = url.toString();
      return {
        ok: true,
        json: async () => ({ binary: { data: [toHex(update)] } }),
      };
    }) as unknown as typeof fetch;

    const data = await PythCoreRule.fetchUpdateData(client, ["BTCUSD"]);

    expect(data).toEqual({
      kind: "pyth_rule",
      payload: { updates: [update], feedIds: [client.getPythFeed("BTCUSD").feed_id] },
    });
    // Hermes queried with the resolved feed id, at the client's configured endpoint.
    const parsedUrl = new URL(requestedUrl ?? "");
    expect(parsedUrl.origin + parsedUrl.pathname).toBe(
      new URL("/v2/updates/price/latest", client.pyth.hermes_endpoint).toString(),
    );
    expect(parsedUrl.searchParams.getAll("ids[]")).toEqual([client.getPythFeed("BTCUSD").feed_id]);
  });

  it("resolves multiple tickers to their respective feed ids", async () => {
    const client = createUnitTestClient();
    const update = mockAccumulatorUpdate();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [toHex(update)] } }),
    })) as unknown as typeof fetch;

    const data = await PythCoreRule.fetchUpdateData(client, ["BTCUSD", "ETHUSD"]);

    expect(data?.payload).toEqual({
      updates: [update],
      feedIds: [client.getPythFeed("BTCUSD").feed_id, client.getPythFeed("ETHUSD").feed_id],
    });
  });

  it("returns null and skips the Hermes fetch for an empty ticker list", async () => {
    const client = createUnitTestClient();
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const data = await PythCoreRule.fetchUpdateData(client, []);

    expect(data).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("PythCoreRule.buildUpdateCalls", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invokes the same moveCall sequence as calling buildPythPriceUpdateCalls directly", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();

    const directTx = new Transaction();
    await buildPythPriceUpdateCalls(directTx, client, [update], [feedId], new PythCache());

    const ruleTx = new Transaction();
    const data = { kind: "pyth_rule" as const, payload: { updates: [update], feedIds: [feedId] } };
    await PythCoreRule.buildUpdateCalls(ruleTx, client, data, ["BTCUSD"], {
      cache: new PythCache(),
    });

    expect(moveTargets(ruleTx)).toEqual(moveTargets(directTx));
    expect(moveTargets(ruleTx).length).toBeGreaterThanOrEqual(4);
  });

  it("forwards the sponsorFund option through to buildPythPriceUpdateCalls", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();

    const { openPythSponsorFund } = await import("../../../src/oracle/rules/sponsor.ts");
    const tx = new Transaction();
    const { fund, packageId } = openPythSponsorFund(tx, client);

    const data = { kind: "pyth_rule" as const, payload: { updates: [update], feedIds: [feedId] } };
    await PythCoreRule.buildUpdateCalls(tx, client, data, ["BTCUSD"], {
      sponsorFund: { fund, packageId },
    });

    // Sponsor path draws the fee via a moveCall split, not tx.gas — no SplitCoins command.
    expect(tx.getData().commands?.some((c) => c.$kind === "SplitCoins")).toBe(false);
  });

  it("is a no-op when data is null (empty ticker list upstream)", async () => {
    const client = createUnitTestClient();
    const tx = new Transaction();

    await PythCoreRule.buildUpdateCalls(tx, client, null, []);

    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });

  it("throws when handed a payload of a different rule kind", async () => {
    const client = createUnitTestClient();
    const tx = new Transaction();

    await expect(
      PythCoreRule.buildUpdateCalls(
        tx,
        client,
        { kind: "constant_rule", payload: { price: "1000000000" } },
        ["USDCUSD"],
      ),
    ).rejects.toThrow(/expected 'pyth_rule'/);
  });
});

describe("PythCoreRule end-to-end fetch → build", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetchUpdateData then buildUpdateCalls appends the same PTB block as updatePythPrices", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [toHex(update)] } }),
    })) as unknown as typeof fetch;

    const directTx = new Transaction();
    await buildPythPriceUpdateCalls(directTx, client, [update], [feedId], new PythCache());

    const ruleTx = new Transaction();
    const data = await PythCoreRule.fetchUpdateData(client, ["BTCUSD"]);
    await PythCoreRule.buildUpdateCalls(ruleTx, client, data, ["BTCUSD"], {
      cache: new PythCache(),
    });

    expect(moveTargets(ruleTx)).toEqual(moveTargets(directTx));
  });
});

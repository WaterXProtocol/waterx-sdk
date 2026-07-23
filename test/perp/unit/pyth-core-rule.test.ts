/**
 * `PythCoreRule` unit tests — mechanical `PriceUpdateRule` wrap around
 * `buildPythPriceUpdateCalls` / `fetchPriceFeedsUpdateData`. Hermes fetch and
 * the Pyth on-chain gRPC reads are mocked; no real network.
 */
import { toHex } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPythPriceUpdateCalls, PythCache } from "../../../src/oracle/pyth.ts";
import {
  PythCoreRule,
  type PythCoreUpdatePayload,
} from "../../../src/oracle/rules/pyth-core-rule.ts";
import { openPythSponsorFund } from "../../../src/oracle/rules/sponsor.ts";
import { moveTargets } from "../helpers/fixtures/ptb-inspect.ts";
import { attachPythGrpcMocks, mockAccumulatorUpdate } from "../helpers/fixtures/pyth-mock-grpc.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

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

  it("under 'pro' fetches from the CORE Hermes, not the host's Pro endpoint (fallback tickers only exist there)", async () => {
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    // Simulate the pro host: its pyth block is the PRO infra.
    (client as { pyth: typeof client.pyth }).pyth = {
      ...client.pyth,
      hermes_endpoint: "https://pyth.example-pro.invalid/hermes",
      api_key: "pro-key",
    };
    const update = mockAccumulatorUpdate();
    let requestedUrl: string | undefined;
    let authHeader: string | undefined;
    globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      requestedUrl = url.toString();
      authHeader = (init?.headers as Record<string, string> | undefined)?.Authorization;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => mockAccumulatorUpdate().buffer,
        json: async () => ({ binary: { data: [toHex(update)] } }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    await PythCoreRule.fetchUpdateData(client, ["BTCUSD"]);

    const parsedUrl = new URL(requestedUrl ?? "");
    // CORE endpoint (PYTH_DEFAULTS), keyless — NOT the Pro endpoint/key: the
    // update leg must stay on the same Core infra the feed leg pins, and the
    // Pro endpoint doesn't even serve the tickers that fall back to pyth_rule.
    expect(parsedUrl.host).not.toBe("pyth.example-pro.invalid");
    expect(authHeader).toBeUndefined();
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

  it("propagates the feed-lookup throw for a ticker outside supportedTickers, without fetching", async () => {
    const client = createUnitTestClient();
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    // Not in pyth_rule.feeds (and not in supportedTickers) — callers are expected
    // to pre-filter via supportedTickers; this pins that fetchUpdateData does NOT
    // re-validate and instead lets host.getPythFeed's throw propagate uncaught.
    expect(PythCoreRule.supportedTickers(client)).not.toContain("DOGEUSD");

    await expect(PythCoreRule.fetchUpdateData(client, ["DOGEUSD"])).rejects.toThrow(
      /No pyth feed listed for ticker: DOGEUSD/,
    );
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
    await buildPythPriceUpdateCalls(directTx, client, [update], [feedId], {
      cache: new PythCache(),
      feeSource: { kind: "gas" },
    });

    const ruleTx = new Transaction();
    const data = { kind: "pyth_rule" as const, payload: { updates: [update], feedIds: [feedId] } };
    await PythCoreRule.buildUpdateCalls(ruleTx, client, data, {
      cache: new PythCache(),
      feeSource: { kind: "gas" },
    });

    expect(moveTargets(ruleTx)).toEqual(moveTargets(directTx));
    expect(moveTargets(ruleTx).length).toBeGreaterThanOrEqual(4);
  });

  it("forwards the feeSource option (sponsor) through to buildPythPriceUpdateCalls", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();

    const tx = new Transaction();
    const { fund, packageId } = openPythSponsorFund(tx, client);

    const data = { kind: "pyth_rule" as const, payload: { updates: [update], feedIds: [feedId] } };
    await PythCoreRule.buildUpdateCalls(tx, client, data, {
      feeSource: { kind: "sponsor", fund, packageId },
    });

    // Sponsor path draws the fee via a moveCall split, not tx.gas — no SplitCoins command …
    expect(tx.getData().commands?.some((c) => c.$kind === "SplitCoins")).toBe(false);
    // … and the sponsor split + per-feed update calls actually landed in the PTB.
    const targets = moveTargets(tx);
    expect(targets).toContain("pyth_sponsor_rule::split");
    expect(targets).toContain("pyth::update_single_price_feed");
  });

  it("forwards the feeSource option (gas) through to buildPythPriceUpdateCalls", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();

    const tx = new Transaction();
    const data = { kind: "pyth_rule" as const, payload: { updates: [update], feedIds: [feedId] } };
    await PythCoreRule.buildUpdateCalls(tx, client, data, { feeSource: { kind: "gas" } });

    expect(tx.getData().commands?.some((c) => c.$kind === "SplitCoins")).toBe(true);
  });

  it("throws OracleFeeSourceUnavailable when no feeSource is passed", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();

    const tx = new Transaction();
    const data = { kind: "pyth_rule" as const, payload: { updates: [update], feedIds: [feedId] } };
    await expect(PythCoreRule.buildUpdateCalls(tx, client, data)).rejects.toThrow(
      /OracleFeeSourceUnavailable/,
    );
    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });

  it("is a no-op when data is null (empty ticker list upstream)", async () => {
    const client = createUnitTestClient();
    const tx = new Transaction();

    await PythCoreRule.buildUpdateCalls(tx, client, null);

    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });

  it("throws when handed a payload of a different rule kind (shape also invalid)", async () => {
    const client = createUnitTestClient();
    const tx = new Transaction();

    await expect(
      PythCoreRule.buildUpdateCalls(tx, client, {
        kind: "constant_rule",
        payload: { price: "1000000000" },
      }),
    ).rejects.toThrow(/expected 'pyth_rule'/);
  });

  it("throws on kind mismatch even when the payload shape looks like a Pyth Core update", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const tx = new Transaction();
    // Same { updates, feedIds } shape as PythCoreRule's own payload, but tagged
    // with a different rule's kind — the shape check alone would wrongly accept
    // this and build a Core VAA block for a Lazer update. The kind check must
    // reject it before the shape check ever runs.
    const lazerShapedButWrongKind = {
      kind: "pyth_lazer_rule" as const,
      payload: { updates: [mockAccumulatorUpdate()], feedIds: [feedId] },
    };

    await expect(
      PythCoreRule.buildUpdateCalls(tx, client, lazerShapedButWrongKind),
    ).rejects.toThrow(/expected 'pyth_rule'/);
    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });
});

describe("PythCoreRule.narrowUpdateData", () => {
  /** Whole-universe payload as the BE prefetch cache holds it: one combined
   *  Hermes accumulator blob + every configured feed id. */
  function universeCoreData(client: ReturnType<typeof createUnitTestClient>) {
    return {
      kind: "pyth_rule" as const,
      payload: {
        updates: [mockAccumulatorUpdate()],
        feedIds: ["BTCUSD", "ETHUSD", "USDCUSD"].map((t) => client.getPythFeed(t).feed_id),
      },
    };
  }

  it("subsets feedIds to exactly the requested tickers, reusing the accumulator blob without re-slicing", () => {
    const client = createUnitTestClient();
    const data = universeCoreData(client);

    const narrowed = PythCoreRule.narrowUpdateData(client, data, ["BTCUSD"]);

    expect(narrowed).toEqual({
      kind: "pyth_rule",
      payload: { updates: data.payload.updates, feedIds: [client.getPythFeed("BTCUSD").feed_id] },
    });
    // The combined Hermes blob already covers every packed feed — served by
    // reference, never copied or re-sliced.
    expect((narrowed?.payload as PythCoreUpdatePayload).updates).toBe(data.payload.updates);
  });

  it("orders feedIds by the request, independent of the payload's own packing order", () => {
    const client = createUnitTestClient();
    const data = universeCoreData(client); // packed BTC, ETH, USDC

    const narrowed = PythCoreRule.narrowUpdateData(client, data, ["ETHUSD", "BTCUSD"]);

    expect(narrowed?.payload).toEqual({
      updates: data.payload.updates,
      feedIds: [client.getPythFeed("ETHUSD").feed_id, client.getPythFeed("BTCUSD").feed_id],
    });
  });

  it("misses (null) for a ticker with no pyth_rule.feeds entry — never a silent partial", () => {
    const client = createUnitTestClient();
    expect(PythCoreRule.supportedTickers(client)).not.toContain("DOGEUSD");

    const narrowed = PythCoreRule.narrowUpdateData(client, universeCoreData(client), [
      "BTCUSD",
      "DOGEUSD",
    ]);

    expect(narrowed).toBeNull();
  });

  it("misses (null) for a config-listed ticker whose feed is not packed in this payload", () => {
    const client = createUnitTestClient();
    const btcOnly = {
      kind: "pyth_rule" as const,
      payload: {
        updates: [mockAccumulatorUpdate()],
        feedIds: [client.getPythFeed("BTCUSD").feed_id],
      },
    };

    // ETHUSD has a pyth feed configured, but this payload never fetched it —
    // serving it anyway would emit an update call the blob cannot back.
    expect(PythCoreRule.narrowUpdateData(client, btcOnly, ["ETHUSD"])).toBeNull();
  });

  it("returns null for an empty ticker list (mirrors fetchUpdateData's empty → null)", () => {
    const client = createUnitTestClient();

    expect(PythCoreRule.narrowUpdateData(client, universeCoreData(client), [])).toBeNull();
  });

  it("passes null data through as null", () => {
    const client = createUnitTestClient();

    expect(PythCoreRule.narrowUpdateData(client, null, ["BTCUSD"])).toBeNull();
  });

  it("throws on a wrong-kind payload instead of missing (a routing bug, not a cache miss)", () => {
    const client = createUnitTestClient();

    expect(() =>
      PythCoreRule.narrowUpdateData(
        client,
        { kind: "pyth_lazer_rule", payload: { update: new Uint8Array(4), feedIds: [1] } },
        ["BTCUSD"],
      ),
    ).toThrow(/expected 'pyth_rule'/);
  });

  it("narrowed payload is accepted by buildUpdateCalls and builds the same PTB as a direct single-feed build", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client); // === BTCUSD's configured feed id
    const update = mockAccumulatorUpdate();
    const universe = {
      kind: "pyth_rule" as const,
      payload: {
        updates: [update],
        feedIds: [
          feedId,
          client.getPythFeed("ETHUSD").feed_id,
          client.getPythFeed("USDCUSD").feed_id,
        ],
      },
    };

    const directTx = new Transaction();
    await buildPythPriceUpdateCalls(directTx, client, [update], [feedId], {
      cache: new PythCache(),
      feeSource: { kind: "gas" },
    });

    const ruleTx = new Transaction();
    const narrowed = PythCoreRule.narrowUpdateData(client, universe, ["BTCUSD"]);
    await PythCoreRule.buildUpdateCalls(ruleTx, client, narrowed, {
      cache: new PythCache(),
      feeSource: { kind: "gas" },
    });

    expect(moveTargets(ruleTx)).toEqual(moveTargets(directTx));
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
    await buildPythPriceUpdateCalls(directTx, client, [update], [feedId], {
      cache: new PythCache(),
      feeSource: { kind: "gas" },
    });

    const ruleTx = new Transaction();
    const data = await PythCoreRule.fetchUpdateData(client, ["BTCUSD"]);
    await PythCoreRule.buildUpdateCalls(ruleTx, client, data, {
      cache: new PythCache(),
      feeSource: { kind: "gas" },
    });

    expect(moveTargets(ruleTx)).toEqual(moveTargets(directTx));
  });
});

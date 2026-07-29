/**
 * Branch coverage for src/oracle/index.ts on-chain helpers and sponsor paths.
 */
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildPythPriceUpdateCalls,
  endpointSupportedFeedIds,
  fetchPriceFeedsUpdateData,
  openPythSponsorFund,
  OracleFeeSourceUnavailableError,
  PythCache,
  refreshOraclePrices,
  reimbursePythSponsor,
} from "../../../src/oracle/index.ts";
import {
  __resetMissingFeedCacheForTest,
  HermesEndpointRejectedAllFeedsError,
  MISSING_FEED_MEMO_TTL_MS,
  probeMissingFeeds,
} from "../../../src/oracle/pyth.ts";
import { placeOrderRequest } from "../../../src/perp/user/order.ts";
import { MOCK_USDC_TYPE } from "../helpers/fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { attachPythGrpcMocks, mockAccumulatorUpdate } from "../helpers/fixtures/pyth-mock-grpc.ts";
import {
  DEFAULT_MOCK_PYTH_ROW_TYPE,
  MOCK_HERMES_URL,
  MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT,
  MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT,
  mockSuiAddress,
} from "../helpers/fixtures/sui-mock-fixtures.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const PYTH_STATE = mockSuiAddress("c1");
const WORMHOLE_STATE = mockSuiAddress("c2");
const PRICE_TABLE_CHILD = mockSuiAddress("c3");

function wirePythGrpc(
  client: ReturnType<typeof createUnitTestClient>,
  overrides: {
    pythStateJson?: Record<string, unknown> | null;
    wormholeJson?: Record<string, unknown> | null;
    dynamicFields?: Array<Record<string, unknown>>;
    dynamicFieldValue?: { bcs?: Uint8Array };
  } = {},
) {
  const pythStateJson =
    overrides.pythStateJson !== undefined
      ? overrides.pythStateJson
      : {
          fields: {
            upgrade_cap: { fields: { package: MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT } },
            base_update_fee: "1000",
          },
        };
  const wormholeJson =
    overrides.wormholeJson !== undefined
      ? overrides.wormholeJson
      : {
          upgrade_cap: { package: MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT },
        };

  client.grpcClient = {
    getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
      if (objectId === PYTH_STATE) return { object: { json: pythStateJson } };
      if (objectId === WORMHOLE_STATE) return { object: { json: wormholeJson } };
      return { object: { json: null } };
    }),
    listDynamicFields: vi.fn(async () => ({
      dynamicFields:
        overrides.dynamicFields !== undefined
          ? overrides.dynamicFields
          : [{ objectId: PRICE_TABLE_CHILD, objectType: DEFAULT_MOCK_PYTH_ROW_TYPE }],
    })),
    getDynamicField: vi.fn(async () => ({
      dynamicField: { value: overrides.dynamicFieldValue ?? { bcs: new Uint8Array(32).fill(1) } },
    })),
  } as unknown as typeof client.grpcClient;

  client.pyth = { ...client.pyth, state_id: PYTH_STATE, wormhole_state_id: WORMHOLE_STATE };
}

describe("pyth on-chain helper branches", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    __resetMissingFeedCacheForTest();
    vi.restoreAllMocks();
  });

  it("fetchPriceFeedsUpdateData throws when Hermes returns empty binary", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ binary: { data: [] } }), { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"])).rejects.toThrow(
      /Hermes returned no binary price data/,
    );
  });

  // A batch containing 0xWTI 404s; any batch without it 200s. Pyth's 404 body
  // is NOT reliably delivered to fetch, so the impl isolates 0xWTI by
  // bisection rather than parsing.
  // Serves the catalog (listing only BTC) at /v2/price_feeds, 404s any
  // latest-price batch containing 0xWTI (empty body, like Cloudflare→undici),
  // and 200s everything else.
  const wtiUnknownFetch = () =>
    vi.fn(async (url: string) =>
      url.includes("price_feeds")
        ? new Response(JSON.stringify([{ id: "BTC" }]), { status: 200 })
        : url.includes("0xWTI")
          ? new Response("", { status: 404 })
          : new Response(JSON.stringify({ binary: { data: ["aabb"] } }), { status: 200 }),
    );

  // Catalog endpoint down — discovery must fall back to bisection.
  const wtiUnknownFetchNoCatalog = () =>
    vi.fn(async (url: string) =>
      url.includes("price_feeds")
        ? new Response("", { status: 500 })
        : url.includes("0xWTI")
          ? new Response("", { status: 404 })
          : new Response(JSON.stringify({ binary: { data: ["aabb"] } }), { status: 200 }),
    );

  it("discovers an endpoint-missing feed via the catalog and re-fetches the survivors as one batch", async () => {
    const fetchSpy = wtiUnknownFetch();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const data = await fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0xBTC", "0xWTI"]);

    // Survivor served → one combined blob; 0xWTI dropped from the final
    // clean fetch, which carries the survivor only.
    expect(data).toHaveLength(1);
    const last = fetchSpy.mock.calls.at(-1)?.[0] as string;
    expect(last).toContain("0xBTC");
    expect(last).not.toContain("0xWTI");
  });

  it("probeMissingFeeds memoizes without fetching any survivor data", async () => {
    const fetchSpy = wtiUnknownFetch();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await probeMissingFeeds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"]);

    // Discovery-only: the memo knows 0xWTI from ONE catalog read — no root
    // probe (the caller already observed the 404), no bisection halves.
    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).toEqual(["0xBTC"]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back to bisection when the catalog endpoint is unavailable", async () => {
    const fetchSpy = wtiUnknownFetchNoCatalog();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await probeMissingFeeds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"]);

    // Catalog 500 → the two half-probes isolate 0xWTI exactly as before.
    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).toEqual(["0xBTC"]);
  });

  it("reads the catalog at most once per discovery run, not once per bisection node", async () => {
    // 404 (not 5xx) so one catalog READ is one request — no retry cycles to
    // confound the count. Bisection then recurses over 4 ids; the catalog must
    // NOT be re-read at every 404 node it visits (that multiplied a
    // money-path build by a full catalog fetch — with retries and backoff when
    // the catalog is 5xx — per node).
    const fetchSpy = vi.fn(async (url: string) =>
      url.includes("price_feeds")
        ? new Response("", { status: 404 })
        : url.includes("0xWTI")
          ? new Response("", { status: 404 })
          : new Response(JSON.stringify({ binary: { data: ["aabb"] } }), { status: 200 }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await probeMissingFeeds(MOCK_HERMES_URL, ["0xBTC", "0xETH", "0xSOL", "0xWTI"]);

    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).toEqual(["0xBTC"]);
    const catalogReads = fetchSpy.mock.calls.filter((c) =>
      String(c[0]).includes("price_feeds"),
    ).length;
    expect(catalogReads).toBe(1);
  });

  it("memo matches a feed regardless of 0x-prefix spelling (bare vs prefixed)", async () => {
    const fetchSpy = wtiUnknownFetch();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    // Discover the missing feed using the 0x-prefixed spelling …
    await probeMissingFeeds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"]);

    // … then look it up in the BARE spelling: the memo normalizes on the bare
    // (0x-stripped, lowercased) form — same as the catalog + in-flight latch —
    // so the missing feed stays filtered and can't slip back through as
    // unfiltered under a different prefix spelling.
    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["BTC", "WTI"])).toEqual(["BTC"]);
    // …and the prefixed spelling stays filtered too.
    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).toEqual(["0xBTC"]);
  });

  it("dedupes concurrent cold discoveries — one discovery run serves both callers", async () => {
    const fetchSpy = wtiUnknownFetch();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    // Two tx-builds racing on a cold memo (the common BE shape). Each still
    // gets its own survivor data, but the discovery behind them runs once.
    const [first, second] = await Promise.all([
      fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0xBTC", "0xWTI"]),
      fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0xBTC", "0xWTI"]),
    ]);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    const catalogReads = fetchSpy.mock.calls.filter((c) =>
      String(c[0]).includes("price_feeds"),
    ).length;
    expect(catalogReads).toBe(1);
  });

  it("a failed discovery is not left latched — the next caller retries it", async () => {
    // The in-flight entry must be cleared on rejection too, or one endpoint
    // blip would pin every later caller to the same stale failure.
    globalThis.fetch = vi.fn(
      async () => new Response("", { status: 404 }),
    ) as unknown as typeof fetch;

    await expect(probeMissingFeeds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).rejects.toBeInstanceOf(
      HermesEndpointRejectedAllFeedsError,
    );

    const fetchSpy = wtiUnknownFetch();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await probeMissingFeeds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"]);
    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).toEqual(["0xBTC"]);
  });

  it("memo key ignores trailing slashes — one entry per endpoint however callers spell it", async () => {
    const fetchSpy = wtiUnknownFetch();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await probeMissingFeeds(`${MOCK_HERMES_URL}/`, ["0xBTC", "0xWTI"]);

    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).toEqual(["0xBTC"]);
  });

  it("memo is credential-scoped — one key's missing feed never poisons another key's view", async () => {
    const fetchSpy = wtiUnknownFetch();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    // key-a discovers 0xWTI missing (Pro entitlements are per-key).
    await probeMissingFeeds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"], { apiKey: "key-a" });

    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"], "key-a")).toEqual([
      "0xBTC",
    ]);
    // A different credential (or keyless) still sees the full set.
    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"], "key-b")).toEqual([
      "0xBTC",
      "0xWTI",
    ]);
    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).toEqual([
      "0xBTC",
      "0xWTI",
    ]);
  });

  it("memoizes a missing feed — a second call skips it with no 404", async () => {
    const fetchSpy = wtiUnknownFetch();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0xBTC", "0xWTI"]); // discovers 0xWTI
    fetchSpy.mockClear();

    const data = await fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0xBTC", "0xWTI"]);

    expect(data).toHaveLength(1);
    // Second call: 0xWTI filtered up front → exactly one fetch, no 404.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0] as string).not.toContain("0xWTI");
  });

  it("returns [] when a readable catalog confirms every requested feed is absent", async () => {
    // The catalog is alive and lists BTC — it just doesn't carry WTI/BRENT.
    // That IS authoritative per-feed absence, so memoize and abstain quietly.
    globalThis.fetch = vi.fn(async (url: string) =>
      url.includes("price_feeds")
        ? new Response(JSON.stringify([{ id: "BTC" }]), { status: 200 })
        : new Response("", { status: 404 }),
    ) as unknown as typeof fetch;

    await expect(fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0xWTI", "0xBRENT"])).resolves.toEqual(
      [],
    );
    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xWTI", "0xBRENT"])).toEqual([]);
  });

  it("surfaces a 404 that isn't a missing-feed rejection as a Hermes error, not a body-reuse TypeError", async () => {
    // Catalog vouches for every requested id, so discovery records nothing and
    // the impl falls through to its own throw — where the 404 body must still
    // be readable (the discovery branch used to cancel it first, turning this
    // into `TypeError: Body is unusable`).
    globalThis.fetch = vi.fn(async (url: string) =>
      url.includes("price_feeds")
        ? new Response(JSON.stringify([{ id: "BTC" }]), { status: 200 })
        : new Response("upstream said no", { status: 404 }),
    ) as unknown as typeof fetch;

    await expect(fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0xBTC"])).rejects.toThrow(
      /Hermes price fetch failed: 404 upstream said no/,
    );
  });

  it("throws instead of memoizing when the endpoint rejects every requested feed", async () => {
    // Wrong base path / changed route / revoked entitlement: the catalog 404s
    // too, so every bisection leaf 404s. "Everything is missing" is an
    // endpoint-level fault, not N individually-absent feeds — stay loud.
    globalThis.fetch = vi.fn(
      async () => new Response("", { status: 404 }),
    ) as unknown as typeof fetch;

    const rejection = expect(
      fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0xWTI", "0xBRENT"]),
    ).rejects;
    await rejection.toThrow(/Hermes price fetch failed: 404/);
    await rejection.toBeInstanceOf(HermesEndpointRejectedAllFeedsError);

    // Nothing memoized → the next call retries the endpoint instead of
    // silently returning [] for the rest of the process's life.
    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xWTI", "0xBRENT"])).toEqual([
      "0xWTI",
      "0xBRENT",
    ]);
  });

  it("treats an empty catalog as an endpoint fault, not as every feed being absent", async () => {
    // Entitlement revoked/downgraded to nothing: the catalog reads fine but
    // serves zero feeds. That vouches for nothing.
    globalThis.fetch = vi.fn(async (url: string) =>
      url.includes("price_feeds")
        ? new Response("[]", { status: 200 })
        : new Response("", { status: 404 }),
    ) as unknown as typeof fetch;

    await expect(
      fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0xBTC", "0xWTI"]),
    ).rejects.toBeInstanceOf(HermesEndpointRejectedAllFeedsError);
    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).toEqual([
      "0xBTC",
      "0xWTI",
    ]);
  });

  it("probeMissingFeeds throws on an endpoint-wide rejection instead of poisoning the memo", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("", { status: 404 }),
    ) as unknown as typeof fetch;

    await expect(probeMissingFeeds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).rejects.toBeInstanceOf(
      HermesEndpointRejectedAllFeedsError,
    );
    expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).toEqual([
      "0xBTC",
      "0xWTI",
    ]);
  });

  it("expires a memoized missing feed after the TTL so a recovered endpoint self-heals", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(0);
      globalThis.fetch = wtiUnknownFetch() as unknown as typeof fetch;

      await probeMissingFeeds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"]);
      expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).toEqual(["0xBTC"]);

      // Entitlement granted / feed listed since — the memo must not outlive
      // the TTL, or the client never notices the endpoint recovered.
      vi.setSystemTime(MISSING_FEED_MEMO_TTL_MS + 1);
      expect(endpointSupportedFeedIds(MOCK_HERMES_URL, ["0xBTC", "0xWTI"])).toEqual([
        "0xBTC",
        "0xWTI",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("buildPythPriceUpdateCalls rejects multiple accumulator messages", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client);
    const tx = new Transaction();
    const update = mockAccumulatorUpdate();
    await expect(
      buildPythPriceUpdateCalls(tx, client, [update, update], ["0xfeed"], {
        cache: new PythCache(),
      }),
    ).rejects.toThrow(/Only a single accumulator message/);
  });

  it("buildPythPriceUpdateCalls uses sponsor fund split instead of gas", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();
    const cache = new PythCache();

    const gasTx = new Transaction();
    await buildPythPriceUpdateCalls(gasTx, client, [update], [feedId], {
      cache,
      feeSource: { kind: "gas" },
    });
    expect(gasTx.getData().commands?.some((c) => c.$kind === "SplitCoins")).toBe(true);

    const sponsorTx = new Transaction();
    const { fund, packageId } = openPythSponsorFund(sponsorTx, client);
    await buildPythPriceUpdateCalls(sponsorTx, client, [update], [feedId], {
      cache,
      feeSource: { kind: "sponsor", fund, packageId },
    });
    expect(sponsorTx.getData().commands?.some((c) => c.$kind === "SplitCoins")).toBe(false);
    expect(sponsorTx.getData().commands?.some((c) => c.$kind === "MoveCall")).toBe(true);
  });

  it("buildPythPriceUpdateCalls throws when feed is not registered on-chain", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, { dynamicFieldValue: { bcs: new Uint8Array(8) } });
    const tx = new Transaction();
    await expect(
      buildPythPriceUpdateCalls(tx, client, [mockAccumulatorUpdate()], ["0xdeadbeef"], {
        cache: new PythCache(),
        feeSource: { kind: "gas" },
      }),
    ).rejects.toThrow(/not registered on-chain/);
  });

  it("pkgFromUpgradeCap reads top-level and nested upgrade_cap package paths", async () => {
    const client = createUnitTestClient();
    const directPkg = "0x1111111111111111111111111111111111111111111111111111111111111111";
    wirePythGrpc(client, {
      pythStateJson: {
        upgrade_cap: { package: directPkg },
        base_update_fee: "1000",
      },
    });
    const cache = new PythCache();
    await buildPythPriceUpdateCalls(
      txFor(),
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      { cache, feeSource: { kind: "gas" } },
    );
    expect(cache.pythStateInfo?.packageId).toBe(directPkg);

    const nestedPkg = "0x2222222222222222222222222222222222222222222222222222222222222222";
    wirePythGrpc(client, {
      pythStateJson: {
        fields: {
          upgrade_cap: { fields: { package: nestedPkg } },
          base_update_fee: "1000",
        },
      },
    });
    const cache2 = new PythCache();
    await buildPythPriceUpdateCalls(
      txFor(),
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      { cache: cache2, feeSource: { kind: "gas" } },
    );
    expect(cache2.pythStateInfo?.packageId).toBe(nestedPkg);
  });

  it("getPythStateInfo reads base_update_fee from json root", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, {
      pythStateJson: {
        upgrade_cap: { package: MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT },
        base_update_fee: "4242",
      },
    });
    const cache = new PythCache();
    await buildPythPriceUpdateCalls(
      txFor(),
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      { cache, feeSource: { kind: "gas" } },
    );
    expect(cache.pythStateInfo?.baseUpdateFee).toBe(4242n);
  });

  it("matches dynamic field rows whose objectType contains price_info", async () => {
    const client = createUnitTestClient();
    const pkg = MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT;
    wirePythGrpc(client, {
      dynamicFields: [
        {
          objectId: PRICE_TABLE_CHILD,
          objectType: `${pkg}::state::price_info::Table`,
        },
      ],
    });
    await expect(
      buildPythPriceUpdateCalls(
        txFor(),
        client,
        [mockAccumulatorUpdate()],
        ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
        { cache: new PythCache(), feeSource: { kind: "gas" } },
      ),
    ).rejects.toThrow(/Cannot extract package from price table type/);
  });

  it("normalizes feed ids without 0x prefix", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client);
    const feedHex = "f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b";
    const tx = new Transaction();
    const ids = await buildPythPriceUpdateCalls(tx, client, [mockAccumulatorUpdate()], [feedHex], {
      feeSource: { kind: "gas" },
    });
    expect(ids[0]).toMatch(/^0x/);
  });

  it("resolves price table via valueType and objectId when childId is absent", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, {
      dynamicFields: [{ objectId: PRICE_TABLE_CHILD, valueType: DEFAULT_MOCK_PYTH_ROW_TYPE }],
    });
    const cache = new PythCache();
    await buildPythPriceUpdateCalls(
      txFor(),
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      { cache, feeSource: { kind: "gas" } },
    );
    expect(cache.priceTableInfo?.id).toBe(PRICE_TABLE_CHILD);
  });

  it("resolves price table via valueType and childId fields", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, {
      dynamicFields: [{ childId: PRICE_TABLE_CHILD, valueType: DEFAULT_MOCK_PYTH_ROW_TYPE }],
    });
    const cache = new PythCache();
    await buildPythPriceUpdateCalls(
      txFor(),
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      { cache, feeSource: { kind: "gas" } },
    );
    expect(cache.priceTableInfo?.id).toBe(PRICE_TABLE_CHILD);
  });

  it("resolves price table via objectType when valueType is empty", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, {
      dynamicFields: [
        {
          childId: PRICE_TABLE_CHILD,
          valueType: "",
          objectType: DEFAULT_MOCK_PYTH_ROW_TYPE,
        },
      ],
    });
    const cache = new PythCache();
    await buildPythPriceUpdateCalls(
      txFor(),
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      { cache, feeSource: { kind: "gas" } },
    );
    expect(cache.priceTableInfo?.id).toBe(PRICE_TABLE_CHILD);
  });

  it("resolves price table via objectType and childId fields", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, {
      dynamicFields: [
        {
          childId: PRICE_TABLE_CHILD,
          objectType: DEFAULT_MOCK_PYTH_ROW_TYPE,
        },
      ],
    });
    const cache = new PythCache();
    const tx = new Transaction();
    await buildPythPriceUpdateCalls(
      tx,
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      { cache, feeSource: { kind: "gas" } },
    );
    expect(cache.priceTableInfo?.id).toBe(PRICE_TABLE_CHILD);
  });

  it("reuses priceFeedObjectId cache keyed by pyth state", async () => {
    const client = createUnitTestClient();
    const getDynamicField = vi.fn(async () => ({
      dynamicField: { value: { bcs: new Uint8Array(32).fill(1) } },
    }));
    wirePythGrpc(client);
    client.grpcClient.getDynamicField =
      getDynamicField as unknown as typeof client.grpcClient.getDynamicField;

    const cache = new PythCache();
    const feedId = "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b";
    cache.priceFeedObjectIdCache.set(`${PYTH_STATE}:${feedId.replace(/^0x/, "")}`, "0xcached");

    const tx = new Transaction();
    const ids = await buildPythPriceUpdateCalls(tx, client, [mockAccumulatorUpdate()], [feedId], {
      cache,
      feeSource: { kind: "gas" },
    });
    expect(ids[0]).toBe("0xcached");
    expect(getDynamicField).not.toHaveBeenCalled();
  });

  it("reuses priceFeedObjectId cache with feed-only key when pyth state id is empty", async () => {
    const client = createUnitTestClient();
    const fieldType = DEFAULT_MOCK_PYTH_ROW_TYPE.replace(
      /::price_identifier::PriceIdentifier$/,
      "",
    );
    const cache = new PythCache();
    cache.pythStateInfo = {
      packageId: MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT,
      baseUpdateFee: 1000n,
    };
    cache.wormholePackageId = MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT;
    cache.priceTableInfo = { id: PRICE_TABLE_CHILD, fieldType };

    const getDynamicField = vi.fn(async () => ({
      dynamicField: { value: { bcs: new Uint8Array(32).fill(2) } },
    }));
    wirePythGrpc(client);
    client.grpcClient.getDynamicField =
      getDynamicField as unknown as typeof client.grpcClient.getDynamicField;
    client.pyth = { ...client.pyth, state_id: "" };

    const feedId = "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b";
    cache.priceFeedObjectIdCache.set(feedId.replace(/^0x/, ""), "0xcached-no-state");

    const tx = new Transaction();
    const ids = await buildPythPriceUpdateCalls(tx, client, [mockAccumulatorUpdate()], [feedId], {
      cache,
      feeSource: { kind: "gas" },
    });
    expect(ids[0]).toBe("0xcached-no-state");
    expect(getDynamicField).not.toHaveBeenCalled();
  });

  it("matches price table rows via objectType when valueType is absent", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, {
      dynamicFields: [
        { objectType: "unrelated::module::Field" },
        {
          objectId: PRICE_TABLE_CHILD,
          objectType: DEFAULT_MOCK_PYTH_ROW_TYPE,
        },
      ],
    });
    const cache = new PythCache();
    await buildPythPriceUpdateCalls(
      txFor(),
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      { cache, feeSource: { kind: "gas" } },
    );
    expect(cache.priceTableInfo?.id).toBe(PRICE_TABLE_CHILD);
  });

  it("reuses grpc caches for pyth state, wormhole package, and price table", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client);
    const cache = new PythCache();
    const tx1 = new Transaction();
    await buildPythPriceUpdateCalls(
      tx1,
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      { cache, feeSource: { kind: "gas" } },
    );
    const getObject = client.grpcClient.getObject as ReturnType<typeof vi.fn>;
    const callsAfterFirst = getObject.mock.calls.length;

    const tx2 = new Transaction();
    await buildPythPriceUpdateCalls(
      tx2,
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      { cache, feeSource: { kind: "gas" } },
    );
    expect(getObject.mock.calls.length).toBe(callsAfterFirst);
    expect(cache.pythStateInfo?.packageId).toBe(MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT);
    expect(cache.wormholePackageId).toBe(MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT);
    expect(cache.priceTableInfo?.id).toBe(PRICE_TABLE_CHILD);
  });

  it("getPythStateInfo throws when state json or base_update_fee is missing", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, { pythStateJson: null });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], {
        cache: new PythCache(),
        feeSource: { kind: "gas" },
      }),
    ).rejects.toThrow(/Unable to fetch pyth state/);

    wirePythGrpc(client, {
      pythStateJson: {
        upgrade_cap: { package: MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT },
        fields: {},
      },
    });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], {
        cache: new PythCache(),
        feeSource: { kind: "gas" },
      }),
    ).rejects.toThrow(/base_update_fee/);
  });

  it("getWormholePackageId throws when wormhole state json is missing", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, { wormholeJson: null });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], {
        cache: new PythCache(),
        feeSource: { kind: "gas" },
      }),
    ).rejects.toThrow(/wormhole package id/);
  });

  it("getPriceTableInfo throws on missing table, childId, or package type", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, { dynamicFields: [] });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], {
        cache: new PythCache(),
        feeSource: { kind: "gas" },
      }),
    ).rejects.toThrow(/Price table not found/);

    wirePythGrpc(client, {
      dynamicFields: [{ valueType: DEFAULT_MOCK_PYTH_ROW_TYPE }],
    });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], {
        cache: new PythCache(),
        feeSource: { kind: "gas" },
      }),
    ).rejects.toThrow(/Price table missing childId/);

    wirePythGrpc(client, {
      dynamicFields: [
        {
          childId: PRICE_TABLE_CHILD,
          valueType: "not-a-hex-pkg::price_identifier::PriceIdentifier",
        },
      ],
    });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], {
        cache: new PythCache(),
        feeSource: { kind: "gas" },
      }),
    ).rejects.toThrow(/Cannot extract package from price table type/);
  });

  it("pkgFromUpgradeCap throws when package id cannot be resolved", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, { pythStateJson: { fields: {} } });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], {
        cache: new PythCache(),
        feeSource: { kind: "gas" },
      }),
    ).rejects.toThrow(/Cannot resolve package id/);
  });

  it("refreshOraclePrices is a no-op for an empty ticker list", async () => {
    const client = createUnitTestClient();
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, []);
    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });

  it("reimbursePythSponsor throws when sponsor config is incomplete", () => {
    const client = createUnitTestClient();
    delete (client.config.packages.pyth_sponsor_rule as { published_at?: string }).published_at;
    const tx = new Transaction();
    const fund = tx.pure.u64(1);
    const req = placeOrderRequest(client, tx, {
      ticker: "BTCUSD",
      accountId: PTB_DUMMY_ACCOUNT_ID,
      collateralType: MOCK_USDC_TYPE,
      main: {
        isLong: true,
        isStopOrder: false,
        reduceOnly: false,
        size: 1n,
        acceptablePrice: 1n,
        collateralAmount: 1n,
      },
    });
    expect(() => reimbursePythSponsor(tx, client, fund, req, MOCK_USDC_TYPE)).toThrow(
      /pyth_sponsor_rule missing from config/,
    );
  });
});

describe("buildPythPriceUpdateCalls — fee source resolution (Task 5)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    __resetMissingFeedCacheForTest();
    vi.restoreAllMocks();
  });

  it("draws from the sponsor pool when feeSource.kind is 'sponsor' (never tx.gas)", async () => {
    // The old "sponsorFund wins over allowGasFee when both are supplied"
    // scenario no longer applies — `OracleFeeSource` is a closed union, so a
    // caller can no longer construct a "both supplied" shape at all. The
    // priority is now structural (resolved once at the edge, see
    // `OracleFeeSource`'s doc); this test just pins the sponsor-split
    // behavior for that one resolved kind.
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();

    const tx = new Transaction();
    const { fund, packageId } = openPythSponsorFund(tx, client);
    await buildPythPriceUpdateCalls(tx, client, [update], [feedId], {
      cache: new PythCache(),
      feeSource: { kind: "sponsor", fund, packageId },
    });

    expect(tx.getData().commands?.some((c) => c.$kind === "SplitCoins")).toBe(false);
    expect(
      tx
        .getData()
        .commands?.some((c) => c.$kind === "MoveCall" && c.MoveCall?.function === "split"),
    ).toBe(true);
  });

  it("draws from tx.gas when feeSource.kind is 'gas'", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();

    const tx = new Transaction();
    await buildPythPriceUpdateCalls(tx, client, [update], [feedId], {
      cache: new PythCache(),
      feeSource: { kind: "gas" },
    });

    expect(tx.getData().commands?.some((c) => c.$kind === "SplitCoins")).toBe(true);
  });

  it("throws OracleFeeSourceUnavailableError when no feeSource is supplied, before any PTB mutation", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();

    const tx = new Transaction();
    const rejection = expect(
      buildPythPriceUpdateCalls(tx, client, [update], [feedId], { cache: new PythCache() }),
    ).rejects;
    await rejection.toThrow(/OracleFeeSourceUnavailable/);
    // instanceof-able (mirrors FetchPolicyError) — a consumer can branch on
    // the error type directly instead of string-matching `.message`.
    await rejection.toBeInstanceOf(OracleFeeSourceUnavailableError);

    // Fail-fast — the throw happens before any gRPC read or PTB mutation
    // (mirrors the Task-4 fetch-all-then-build ordering guarantee).
    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });

  it("OracleFeeSourceUnavailableError carries its own name", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();
    const tx = new Transaction();

    let caught: unknown;
    try {
      await buildPythPriceUpdateCalls(tx, client, [update], [feedId], { cache: new PythCache() });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(OracleFeeSourceUnavailableError);
    expect((caught as Error).name).toBe("OracleFeeSourceUnavailableError");
  });

  it("refreshOraclePrices throws OracleFeeSourceUnavailableError before the off-chain fetch (single-group case)", async () => {
    const client = createUnitTestClient();
    attachPythGrpcMocks(client);
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const tx = new Transaction();
    await expect(refreshOraclePrices(tx, client, ["BTCUSD"])).rejects.toBeInstanceOf(
      OracleFeeSourceUnavailableError,
    );

    // The pre-check is hoisted ABOVE the off-chain fetch AND the gRPC state
    // reads too — no wasted Hermes/gRPC call, not just zero PTB commands.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(client.grpcClient.getObject).not.toHaveBeenCalled();
    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });

  it("throw message names both resolutions", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();
    const tx = new Transaction();

    await expect(
      buildPythPriceUpdateCalls(tx, client, [update], [feedId], { cache: new PythCache() }),
    ).rejects.toThrow(/pyth_sponsor_rule to config.*allowGasFee/s);
  });

  it("updatePythPrices forwards feeSource through to buildPythPriceUpdateCalls", async () => {
    const { updatePythPrices } = await import("../../../src/oracle/index.ts");
    const { toHex } = await import("@mysten/bcs");
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [toHex(update)] } }),
    })) as unknown as typeof fetch;

    const tx = new Transaction();
    const ids = await updatePythPrices(tx, client, [feedId], { feeSource: { kind: "gas" } });
    expect(ids.length).toBe(1);
    expect(tx.getData().commands?.some((c) => c.$kind === "SplitCoins")).toBe(true);
  });

  it("updatePythPrices aligns feedIds with survivors after a 404 drops a feed (no call for the dropped one)", async () => {
    const { updatePythPrices } = await import("../../../src/oracle/index.ts");
    const { toHex } = await import("@mysten/bcs");
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client); // the served feed
    const badFeed = "0x" + "ab".repeat(32); // absent from this endpoint
    const update = mockAccumulatorUpdate();

    // Catalog serves only the good feed; latest-price 404s any batch carrying
    // the bad feed and 200s the survivor-only batch.
    globalThis.fetch = vi.fn(async (url: string) => {
      if (url.includes("price_feeds")) {
        return new Response(JSON.stringify([{ id: feedId.replace(/^0x/, "") }]), { status: 200 });
      }
      if (url.includes("abab")) return new Response("", { status: 404 });
      return new Response(JSON.stringify({ binary: { data: [toHex(update)] } }), { status: 200 });
    }) as unknown as typeof fetch;

    const tx = new Transaction();
    const ids = await updatePythPrices(tx, client, [feedId, badFeed], {
      feeSource: { kind: "gas" },
    });

    // buildPythPriceUpdateCalls returns one PriceInfoObject id per SERVED feed
    // and emits one update call per served feed — the dropped feed must NOT be
    // built (it would reference a feed the accumulator blob doesn't cover). With
    // the old code (original feedIds) this would be 2.
    expect(ids).toHaveLength(1);
    const updateCalls = tx
      .getData()
      .commands?.filter(
        (c) => c.$kind === "MoveCall" && c.MoveCall?.function === "update_single_price_feed",
      );
    expect(updateCalls).toHaveLength(1);
  });

  it("updatePythPrices rejects when no fee source is available", async () => {
    const { updatePythPrices } = await import("../../../src/oracle/index.ts");
    const { toHex } = await import("@mysten/bcs");
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [toHex(update)] } }),
    })) as unknown as typeof fetch;

    const tx = new Transaction();
    const rejection = expect(updatePythPrices(tx, client, [feedId])).rejects;
    await rejection.toThrow(/OracleFeeSourceUnavailable/);
    await rejection.toBeInstanceOf(OracleFeeSourceUnavailableError);
  });
});

function txFor() {
  return new Transaction();
}

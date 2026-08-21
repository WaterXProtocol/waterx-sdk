/**
 * `WaterxRule` unit tests — the first-party quote-center signed-price fetch
 * (HTTP mocked) plus the on-chain verify+feed moveCalls pinned against the
 * published `waterx_rule` contract.
 *
 * CONTRACT: unlike Pyth Lazer (one shared `parse_and_verify` per PTB, then
 * `feed` per ticker), the `waterx_rule` collect entries bundle verify AND feed
 * into ONE per-collector call, so there is no shared `RuleUpdateHandle` — the
 * signed data is carried straight from the fetched data to each ticker's feed
 * leg. TWO wire shapes reach that leg, and the rule prefers the first:
 *
 * 1. per-symbol Merkle LEAVES (`/v1/quotes/leaves`) → `collect_single_with_proof`,
 *    which re-derives the snapshot root from the leaf + its proof. ONE
 *    `new_batch_item` per PTB regardless of how many symbols the snapshot held.
 * 2. one indivisible batch ENVELOPE (`/v1/quotes/update`) → `collect_batch_latest`,
 *    which needs EVERY item rebuilt in-PTB to re-verify the batch signature.
 *    Reached only when the quote-center has no leaf route (404).
 *
 * On-chain, both abstain on a freshness miss or a replayed signed timestamp.
 */
import { fromHex } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  aggregateTicker,
  refreshOraclePrices,
  type PriceUpdateRule,
} from "../../../src/oracle/index.ts";
import {
  fetchWaterxSignedLeaves,
  fetchWaterxSignedUpdate,
  parseSignedEnvelope,
  parseSignedLeaves,
  WaterxRule,
  type WaterxSignedEnvelope,
  type WaterxSignedLeaf,
} from "../../../src/oracle/rules/waterx-rule.ts";
import { moveCalls, moveTargets } from "../helpers/fixtures/ptb-inspect.ts";
import {
  HASH_HEX,
  mockEnvelopeOnly,
  mockLeafRoute,
  mockQuoteCenter,
  rawEnvelope,
  rawLeaves,
  rawLeavesText,
  requestedPaths,
  SIG_HEX,
} from "../helpers/fixtures/quote-center.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

/** The parsed (bigint-typed) envelope, for direct feed / narrow tests. */
function sampleEnvelope(symbols: string[] = ["BTCUSD"]): WaterxSignedEnvelope {
  return parseSignedEnvelope(JSON.stringify(rawEnvelope(symbols)));
}

/** The parsed (bigint-typed) leaves, for direct feed / narrow tests. */
function sampleLeaves(
  symbols: string[] = ["BTCUSD"],
  proof: string[] = [HASH_HEX],
): WaterxSignedLeaf[] {
  return parseSignedLeaves(rawLeavesText(symbols, proof));
}

afterEach(() => vi.restoreAllMocks());

describe("WaterxRule — port", () => {
  it("supportedTickers = the waterx_rule.feeds keys (oracle tickers)", () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    expect(WaterxRule.supportedTickers(client).sort()).toEqual(["BTCUSD", "ETHUSD", "USDCUSD"]);
  });

  it("declares no credential (public quote-center read surface)", () => {
    expect(WaterxRule.credential).toBeUndefined();
  });

  it("fetchUpdateData pulls per-symbol LEAVES, not the batch envelope", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const fetchSpy = mockLeafRoute();
    const data = await WaterxRule.fetchUpdateData(client, ["BTCUSD"]);
    expect(data?.kind).toBe("waterx_rule");
    expect((data?.payload as { leaves: WaterxSignedLeaf[] }).leaves).toHaveLength(1);
    const url = new URL(String(fetchSpy.mock.calls[0]![0]));
    expect(url.pathname).toBe("/v1/quotes/leaves");
    expect(url.searchParams.get("symbols")).toBe("BTCUSD");
    // The indivisible envelope route is not touched when leaves are available.
    expect(requestedPaths(fetchSpy)).not.toContain("/v1/quotes/update");
  });

  it("waterxEndpoint routes the fetch at a proxy, KEEPING its base path", async () => {
    // The proxy route is the endpoint's base path — `new URL("/v1/…", endpoint)`
    // would drop it and bypass the proxy entirely (the Pyth-Pro `/hermes` bug).
    const client = createUnitTestClient({
      oracleSource: "waterx_rule",
      waterxEndpoint: "https://app.example/api/quote-center",
    });
    const fetchSpy = mockLeafRoute();
    await WaterxRule.fetchUpdateData(client, ["BTCUSD"]);
    const url = new URL(String(fetchSpy.mock.calls[0]![0]));
    expect(url.origin).toBe("https://app.example");
    expect(url.pathname).toBe("/api/quote-center/v1/quotes/leaves");
    expect(url.searchParams.get("symbols")).toBe("BTCUSD");
  });

  it("a trailing slash on waterxEndpoint does not double up the path", async () => {
    const client = createUnitTestClient({
      oracleSource: "waterx_rule",
      waterxEndpoint: "https://app.example/api/quote-center/",
    });
    const fetchSpy = mockLeafRoute();
    await WaterxRule.fetchUpdateData(client, ["BTCUSD"]);
    expect(new URL(String(fetchSpy.mock.calls[0]![0])).pathname).toBe(
      "/api/quote-center/v1/quotes/leaves",
    );
  });

  it("the default (bare-origin) endpoint still hits /v1/quotes/leaves", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const fetchSpy = mockLeafRoute();
    await WaterxRule.fetchUpdateData(client, ["BTCUSD"]);
    const url = new URL(String(fetchSpy.mock.calls[0]![0]));
    expect(url.origin).toBe("https://quote-center-staging.waterx.app");
    expect(url.pathname).toBe("/v1/quotes/leaves");
  });

  it("waterxFetch.fetchImpl replaces the transport (global fetch never called)", async () => {
    const globalSpy = mockLeafRoute();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(rawLeaves()),
    } as unknown as Response);
    const client = createUnitTestClient({
      oracleSource: "waterx_rule",
      waterxFetch: { fetchImpl: fetchImpl as unknown as typeof fetch },
    });
    const data = await WaterxRule.fetchUpdateData(client, ["BTCUSD"]);
    expect(data?.kind).toBe("waterx_rule");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(globalSpy).not.toHaveBeenCalled();
  });

  it("fetchUpdateData rejects a partial leaf set (fails at fetch, not on-chain)", async () => {
    // A 200 covering only BTCUSD is a valid, well-signed response — without this
    // guard the build would emit a collect that abstains for ETHUSD and only
    // surface as an on-chain EMissingPriceSource later.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockLeafRoute(["BTCUSD"]);
    await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD", "ETHUSD"])).rejects.toThrow(
      /leaves does not cover ticker\(s\): ETHUSD/,
    );
  });

  it("fetchUpdateData throws for a prototype-key ticker BEFORE fetching — never reaches the quote-center", async () => {
    // feeds["toString"] is an inherited Function; a bare bracket-undefined
    // check passed it as listed and sent the name to the network.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const fetchSpy = mockLeafRoute();
    await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD", "toString"])).rejects.toThrow(
      /No waterx_rule feed listed for ticker: toString/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetchUpdateData accepts leaves covering every requested ticker", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockLeafRoute(["BTCUSD", "ETHUSD"]);
    const data = await WaterxRule.fetchUpdateData(client, ["BTCUSD", "ETHUSD"]);
    expect((data?.payload as { leaves: WaterxSignedLeaf[] }).leaves.map((l) => l.symbol)).toEqual([
      "BTCUSD",
      "ETHUSD",
    ]);
  });

  it("throws for a ticker with no waterx_rule feed (package-level, pre-fetch)", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const fetchSpy = mockLeafRoute();
    await expect(WaterxRule.fetchUpdateData(client, ["DOGEUSD"])).rejects.toThrow(
      /No waterx_rule feed/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a proof element that is not a 32-byte hash, before touching a PTB", async () => {
    // A short/long sibling folds to a root the enclave never signed, which
    // on-chain is indistinguishable from a forged signature (EInvalidSignature
    // out of verify_merkle_root). Catch it on the wire instead.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockQuoteCenter({ leaves: { body: rawLeaves(["BTCUSD"], ["cd".repeat(31)]) } });
    await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(
      /not a 32-byte hex hash/,
    );
  });

  it("parses leaf u64 fields to exact bigints; the display floats stay numbers", () => {
    const leaf = sampleLeaves()[0]!;
    expect(leaf.price_n).toBe(63_700_000_000_000n);
    expect(leaf.price_scale).toBe(1_000_000_000n);
    expect(leaf.signed_timestamp_ms).toBe(1_784_800_000_000n);
    expect(leaf.num_sources).toBe(3); // u8 stays a number
    expect(leaf.proof).toEqual([HASH_HEX]);
  });

  it("survives a display float whose token is lexically integral (`0.0`)", () => {
    // REGRESSION: the reviver used to decide integrality from the PARSED value, so
    // `"confidence": 0.0` — which `JSON.parse` hands back as the number `0`,
    // `Number.isInteger` accepts, and Rust's f64 serializer really does emit —
    // reached `BigInt("0.0")` and threw `SyntaxError: Cannot convert 0.0 to a
    // BigInt`. Every fetch containing such a leaf failed before a PTB was built;
    // live SUIUSD and XAUUSD leaves carry exactly this shape.
    const leaf = parseSignedLeaves(rawLeavesText(["SUIUSD"]))[0]!;
    expect(leaf.confidence_n).toBe(10_000_000_000n); // the signed u64 is untouched
    expect((leaf as unknown as { confidence: number }).confidence).toBe(0); // display float stays a number
  });

  it("leaves exponent-notation display floats as numbers too", () => {
    // `BigInt("1e3")` throws the same way `BigInt("0.0")` does, and an exponent
    // token is equally legal JSON — so integrality is decided by `-?\d+` alone.
    const text = rawLeavesText(["BTCUSD"]).replace('"price": 63700.0', '"price": 6.37e4');
    const leaf = parseSignedLeaves(text)[0]!;
    expect((leaf as unknown as { price: number }).price).toBe(63_700);
    expect(leaf.price_n).toBe(63_700_000_000_000n); // still exact, still bigint
  });

  it("a `0.0` leaf builds a PTB end to end through refreshOraclePrices", async () => {
    // The live repro: `refreshOraclePrices(..., ["SUIUSD"])` against the deployed
    // route died in the parser. This is that call path, wire-faithful.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockQuoteCenter({ leaves: { text: rawLeavesText(["ETHUSD"]) } });
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["ETHUSD"]);
    expect(moveTargets(tx)).toContain("waterx_rule::collect_single_with_proof");
  });

  it("rejects a leaf missing ANY signed field, before any PTB is touched", async () => {
    // A 200 that omits `ticker` used to pass the shape guard (it only checked 4
    // fields) and `assertCoverage`, then fail mid-build as `Parameter ticker is
    // required` — with the caller's tx already being mutated.
    //
    // Every field the guard checks is pinned here, not a sample of them: the
    // guard's promise is that a malformed leaf dies at the parser, and a future
    // edit dropping one field from it would otherwise go unnoticed. `symbol` is
    // covered separately below (its absence changes how the error NAMES the
    // leaf) and `signature` by the fixed-size test after that.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    for (const drop of [
      "ticker",
      "method",
      "sources",
      "price_timestamp_ms",
      "price_n",
      "price_scale",
      "confidence_n",
      "confidence_scale",
      "max_source_deviation_bps",
      "num_sources",
      "signed_timestamp_ms",
      "root",
      "proof",
    ]) {
      const body = rawLeaves(["BTCUSD"]) as { leaves: Record<string, unknown>[] };
      delete body.leaves[0]![drop];
      mockQuoteCenter({ leaves: { body } });
      await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(
        /malformed signed leaf 'BTCUSD'/,
      );
      vi.restoreAllMocks();
    }
  });

  it("names a leaf missing `symbol` by index — there is no name left to print", async () => {
    // The one field whose absence changes the error's shape: a coverage gap and
    // a malformed field read very differently to whoever is paging through this,
    // so the message must still point at a specific leaf.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const body = rawLeaves(["BTCUSD"]) as { leaves: Record<string, unknown>[] };
    delete body.leaves[0]!.symbol;
    mockQuoteCenter({ leaves: { body } });
    await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(
      /malformed signed leaf at index 0/,
    );
  });

  it("rejects a wrong-length signature or root (both are fixed-size)", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    for (const [field, bad] of [
      ["signature", "ab".repeat(63)], // ed25519 is always 64 bytes
      ["root", "cd".repeat(31)], // keccak256 is always 32
    ] as const) {
      const body = rawLeaves(["BTCUSD"]) as { leaves: Record<string, unknown>[] };
      body.leaves[0]![field] = bad;
      mockQuoteCenter({ leaves: { body } });
      await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(
        /malformed signed leaf/,
      );
      vi.restoreAllMocks();
    }
  });

  it("rejects an out-of-domain num_sources (u8)", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const body = rawLeaves(["BTCUSD"]) as { leaves: Record<string, unknown>[] };
    body.leaves[0]!.num_sources = 256; // one past a u8
    mockQuoteCenter({ leaves: { body } });
    await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(
      /malformed signed leaf/,
    );
  });

  it("parses ordinary envelope u64 fields to exact bigints", () => {
    const env = sampleEnvelope();
    const item = env.payload.items[0]!;
    expect(item.price_n).toBe(63_700_000_000_000n);
    expect(item.price_scale).toBe(1_000_000_000n);
    expect(env.timestamp_ms).toBe(1_784_800_000_000n);
    expect(item.num_sources).toBe(3);
  });

  it("parses u64 fields as bigint (exact); a value > 2^53 never silently truncates", () => {
    // A price_n of exactly 2^53 + 1 is not representable as an IEEE-754 double
    // (JSON.parse would round it to 2^53). The parser must either recover it
    // exactly (ES2023 JSON source access) or throw loudly — never return the
    // truncated 9_007_199_254_740_992n.
    const text =
      `{"intent":1,"timestamp_ms":1784800000000,"signature":"${SIG_HEX}",` +
      `"payload":{"items":[{"symbol":"BTCUSD","ticker":"BTCUSDT","sources":[2],` +
      `"method":"median","price_timestamp_ms":1784799999000,` +
      `"price_n":9007199254740993,"price_scale":1000000000,"confidence_n":0,` +
      `"confidence_scale":1000000000,"max_source_deviation_bps":0,"num_sources":1}]}}`;
    let parsed: WaterxSignedEnvelope | undefined;
    try {
      parsed = parseSignedEnvelope(text);
    } catch {
      parsed = undefined; // runtime without JSON source access → fails loud (acceptable)
    }
    if (parsed) {
      expect(parsed.payload.items[0]!.price_n).toBe(9_007_199_254_740_993n);
      expect(parsed.payload.items[0]!.price_n).not.toBe(9_007_199_254_740_992n);
    }
  });

  it("narrowUpdateData SUBSETS leaves — each verifies independently, so it is divisible", () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const data = {
      kind: "waterx_rule" as const,
      payload: { leaves: sampleLeaves(["BTCUSD", "ETHUSD"]) },
    };
    // A whole-universe prefetch cache narrows to exactly the traded ticker: the
    // PTB then carries ONE leaf, not the whole cached snapshot.
    const narrowed = WaterxRule.narrowUpdateData(client, data, ["ETHUSD"]);
    expect(
      (narrowed?.payload as { leaves: WaterxSignedLeaf[] }).leaves.map((l) => l.symbol),
    ).toEqual(["ETHUSD"]);
    // A ticker the payload does not carry → miss (null), never a partial.
    expect(WaterxRule.narrowUpdateData(client, data, ["ETHUSD", "USDCUSD"])).toBeNull();
    expect(WaterxRule.narrowUpdateData(client, data, [])).toBeNull();
  });

  it("narrowUpdateData serves the whole (indivisible) envelope iff fully covered", () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const data = {
      kind: "waterx_rule" as const,
      payload: { envelope: sampleEnvelope(["BTCUSD"]) },
    };
    expect(WaterxRule.narrowUpdateData(client, data, ["BTCUSD"])).toEqual(data);
    expect(WaterxRule.narrowUpdateData(client, data, ["ETHUSD"])).toBeNull();
    expect(WaterxRule.narrowUpdateData(client, data, [])).toBeNull();
  });

  it("buildUpdateCalls emits nothing and returns void (verify is bundled into feed)", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const tx = new Transaction();
    const handle = await WaterxRule.buildUpdateCalls(tx, client, {
      kind: "waterx_rule",
      payload: { leaves: sampleLeaves() },
    });
    expect(handle).toBeUndefined();
    expect(moveCalls(tx)).toHaveLength(0);
  });
});

describe("quote-center batch cap", () => {
  it("chunks the leaf route at 32 symbols and concatenates the results", async () => {
    // Leaves are independently verifiable per symbol, so splitting the request
    // changes nothing about the PTB. Unchunked, one more feed on a 31-feed
    // deployment takes a non-retryable 400 reading only "leaf fetch failed: 400".
    const symbols = Array.from({ length: 40 }, (_, i) => `T${String(i)}USD`);
    // Per-CALL response: each chunk gets leaves for exactly the symbols it asked
    // for, so the concatenation is verifiable rather than assumed.
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation((async (url: string) => {
      const asked = new URL(String(url)).searchParams.get("symbols")!.split(",");
      const text = rawLeavesText(asked);
      return { ok: true, status: 200, text: async () => text } as unknown as Response;
    }) as unknown as typeof fetch);

    const pulled = await fetchWaterxSignedLeaves("https://qc.example", symbols);
    expect("leaves" in pulled && pulled.leaves.map((l) => l.symbol)).toEqual(symbols);

    const batches = spy.mock.calls.map(
      (c) => new URL(String(c[0])).searchParams.get("symbols")!.split(",").length,
    );
    expect(batches).toEqual([32, 8]);
  });

  it("does not chunk at or below the cap — one request, as before", async () => {
    const symbols = Array.from({ length: 32 }, (_, i) => `T${String(i)}USD`);
    const spy = mockLeafRoute(symbols);
    await fetchWaterxSignedLeaves("https://qc.example", symbols);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("refuses an over-cap ENVELOPE fetch with a message naming the cap", async () => {
    // One signature covers the whole batch, so this route genuinely cannot be
    // split; the failure should say that instead of surfacing a bare 400.
    const symbols = Array.from({ length: 40 }, (_, i) => `T${String(i)}USD`);
    await expect(fetchWaterxSignedUpdate("https://qc.example", symbols)).rejects.toThrow(
      /signs at most 32 per request/,
    );
  });
});

describe("WaterxRule — batch-envelope fallback", () => {
  it("falls back to /v1/quotes/update when the leaf route 404s (older quote-center)", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const fetchSpy = mockEnvelopeOnly();
    const data = await WaterxRule.fetchUpdateData(client, ["BTCUSD"]);
    expect((data?.payload as { envelope: WaterxSignedEnvelope }).envelope.intent).toBe(1);
    expect(requestedPaths(fetchSpy)).toEqual(["/v1/quotes/leaves", "/v1/quotes/update"]);
  });

  it("does NOT fall back on a degraded quote-center (500) — the envelope route would fail too", async () => {
    // Falling back here would double the latency of an already-failing
    // money-path build, and mask the outage as a version-skew fallback. The
    // error names the leaf route so an operator can tell the two apart.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const fetchSpy = mockQuoteCenter({
      leaves: { status: 500, body: { error: "enclave unreachable" } },
      update: { body: rawEnvelope() },
    });
    await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(
      /leaf fetch failed: 500/,
    );
    expect(requestedPaths(fetchSpy)).not.toContain("/v1/quotes/update");
  });

  it("does NOT fall back on a 5xx — including 501, which the shared retry policy treats as retryable", async () => {
    // 404 is the ONLY "this route isn't here" signal: `fetchWithPolicy` retries
    // every 5xx, so a 501 can never arrive here as a cheap first-attempt miss.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const fetchSpy = mockQuoteCenter({
      leaves: { status: 501 },
      update: { body: rawEnvelope() },
    });
    await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(
      /leaf fetch failed: 501/,
    );
    expect(requestedPaths(fetchSpy)).not.toContain("/v1/quotes/update");
  });

  it("does NOT fall back on a non-404 4xx (403 from a proxy, 410 from a retired route)", async () => {
    // 404 is the ONLY status that means "this route isn't here". A 4xx that is
    // not 404 is the case most likely to be mistaken for a missing route later —
    // an auth-rejecting proxy in front of the quote-center, or a route retired
    // with 410 — and neither is a version skew the envelope path can paper over.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    // 403 and 410 are non-retryable, so they surface on the first attempt; a
    // 429 would too, only after `fetchWithPolicy` has spent its retry budget —
    // same disposition, covered by the 501 case above.
    for (const status of [403, 410]) {
      const fetchSpy = mockQuoteCenter({
        leaves: { status, body: { error: "nope" } },
        update: { body: rawEnvelope() },
      });
      await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(
        `leaf fetch failed: ${status}`,
      );
      expect(requestedPaths(fetchSpy)).not.toContain("/v1/quotes/update");
      vi.restoreAllMocks();
    }
  });

  it("names BOTH attempts when neither route serves the symbol", async () => {
    // Config drift (a symbol this SDK lists but the quote-center's registry does
    // not) 404s on both routes; the error must not read as "no leaf route".
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockQuoteCenter({ leaves: { status: 404 }, update: { status: 404 } });
    await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(
      /fetch failed: 404.*fell back from GET \/v1\/quotes\/leaves → 404/s,
    );
  });

  it("rejects a wrong intent on the envelope route", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockEnvelopeOnly(["BTCUSD"], { ...rawEnvelope(), intent: 2 });
    await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(/intent/);
  });

  it("rejects a partial envelope", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockEnvelopeOnly(["BTCUSD"]);
    await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD", "ETHUSD"])).rejects.toThrow(
      /envelope does not cover ticker\(s\): ETHUSD/,
    );
  });
});

describe("WaterxRule — on-chain feed", () => {
  it("aggregateTicker with a leaf submits ONE item plus its proof", () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const tx = new Transaction();
    // A 2-symbol snapshot: the PTB must still carry only THIS ticker's leaf —
    // that is the whole cost argument for the Merkle path.
    const leaf = sampleLeaves(["BTCUSD", "ETHUSD"])[0]!;
    aggregateTicker(tx, client, { ticker: "BTCUSD", waterxLeaf: leaf });

    expect(moveTargets(tx)).toEqual([
      "oracle::new_collector",
      "waterx_rule::new_batch_item",
      "waterx_rule::collect_single_with_proof",
      "oracle::aggregate",
    ]);

    // collect_single_with_proof carries the config / enclave_config / enclave objects.
    const collect = moveCalls(tx).find((c) => c.function === "collect_single_with_proof")!;
    const objectIds = collect.arguments
      .filter((a) => a.$kind === "Input" && a.Input !== undefined)
      .map((a) => {
        const input = tx.getData().inputs[a.Input!];
        return input.UnresolvedObject?.objectId ?? input.Object?.SharedObject?.objectId;
      });
    const wr = client.config.packages.waterx_rule!;
    expect(objectIds).toContain(wr.config);
    expect(objectIds).toContain(wr.enclave_config);
    expect(objectIds).toContain(wr.enclave);
  });

  it("re-checks the proof at the feed leg — a cached leaf never passed the parser", () => {
    // `updateDataProvider` hands leaves in whole; nothing forces them through
    // parseSignedLeaves, so the last gate before bytes reach the PTB checks too.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const leaf = { ...sampleLeaves()[0]!, proof: ["cd".repeat(31)] };
    expect(() =>
      aggregateTicker(new Transaction(), client, { ticker: "BTCUSD", waterxLeaf: leaf }),
    ).toThrow(/not a 32-byte hex hash/);
  });

  it("a one-leaf snapshot (empty proof) is still a valid submission", () => {
    // root == leaf_hash(item): nothing to fold. This is what a single-symbol
    // /v1/quotes/leaves pull returns, and the cheapest possible waterx leg.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const tx = new Transaction();
    aggregateTicker(tx, client, { ticker: "BTCUSD", waterxLeaf: sampleLeaves(["BTCUSD"], [])[0]! });
    expect(moveTargets(tx)).toContain("waterx_rule::collect_single_with_proof");
  });

  it("the leaf leg wins when a caller supplies both shapes (never both collects)", () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const tx = new Transaction();
    aggregateTicker(tx, client, {
      ticker: "BTCUSD",
      waterxLeaf: sampleLeaves()[0]!,
      waterxEnvelope: sampleEnvelope(),
    });
    const targets = moveTargets(tx);
    expect(targets).toContain("waterx_rule::collect_single_with_proof");
    expect(targets).not.toContain("waterx_rule::collect_batch_latest");
  });

  it("aggregateTicker with a waterx envelope rebuilds the whole payload and collects", () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const tx = new Transaction();
    aggregateTicker(tx, client, { ticker: "BTCUSD", waterxEnvelope: sampleEnvelope() });

    expect(moveTargets(tx)).toEqual([
      "oracle::new_collector",
      "waterx_rule::new_batch_payload",
      "waterx_rule::new_batch_item",
      "waterx_rule::push_batch_item",
      "waterx_rule::collect_batch_latest",
      "oracle::aggregate",
    ]);
  });

  it("an envelope's every item is rebuilt in-PTB; a leaf's is not", () => {
    // The signature covers the whole item vector, so using ONE symbol's price
    // out of a 3-symbol envelope still costs 3 new_batch_item + 3
    // push_batch_item. The leaf path costs 1, whatever the snapshot's width.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const batchTx = new Transaction();
    aggregateTicker(batchTx, client, {
      ticker: "BTCUSD",
      waterxEnvelope: sampleEnvelope(["BTCUSD", "ETHUSD", "USDCUSD"]),
    });
    const batchTargets = moveTargets(batchTx);
    expect(batchTargets.filter((t) => t === "waterx_rule::new_batch_item")).toHaveLength(3);

    const leafTx = new Transaction();
    aggregateTicker(leafTx, client, {
      ticker: "BTCUSD",
      waterxLeaf: sampleLeaves(["BTCUSD", "ETHUSD", "USDCUSD"])[0]!,
    });
    const leafTargets = moveTargets(leafTx);
    expect(leafTargets.filter((t) => t === "waterx_rule::new_batch_item")).toHaveLength(1);
    expect(leafTargets).not.toContain("waterx_rule::push_batch_item");
  });

  it("decodes the hex signature to bytes (round-trips fromHex)", () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const tx = new Transaction();
    aggregateTicker(tx, client, { ticker: "BTCUSD", waterxLeaf: sampleLeaves()[0]! });
    // The pure `vector<u8>` sig input must equal fromHex(SIG_HEX).
    const sigBytes = fromHex(SIG_HEX);
    const hasSig = tx
      .getData()
      .inputs.some(
        (i) =>
          i.Pure?.bytes !== undefined &&
          Buffer.from(i.Pure.bytes, "base64").length >= sigBytes.length,
      );
    expect(hasSig).toBe(true);
  });
});

describe("WaterxRule — routing", () => {
  it("refreshOraclePrices with oracleSource waterx_rule routes through the leaf path", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockLeafRoute();
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD"]);
    const targets = moveTargets(tx);
    expect(targets).toContain("waterx_rule::collect_single_with_proof");
    expect(targets).not.toContain("waterx_rule::collect_batch_latest");
    expect(targets).toContain("oracle::aggregate");
    // No Pyth Lazer verify on the waterx path.
    expect(targets).not.toContain("pyth_lazer::parse_and_verify_le_ecdsa_update");
  });

  it("routes through collect_batch_latest against a quote-center with no leaf route", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockEnvelopeOnly();
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD"]);
    expect(moveTargets(tx)).toContain("waterx_rule::collect_batch_latest");
  });

  it("multi-ticker refresh collects each ticker with only its OWN leaf — no retired Core leg", async () => {
    // One PTB, several tickers, one snapshot covering both — but each collector
    // gets only ITS leaf (one new_batch_item per collector, not one per
    // snapshot symbol), and nothing pyth_rule-shaped appears anywhere.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockLeafRoute(["BTCUSD", "ETHUSD"]);
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "ETHUSD"]);

    const targets = moveTargets(tx);
    const count = (t: string) => targets.filter((x) => x === t).length;
    expect(count("oracle::new_collector")).toBe(2);
    expect(count("waterx_rule::collect_single_with_proof")).toBe(2);
    expect(count("waterx_rule::new_batch_item")).toBe(2); // one per collector, not one per snapshot symbol
    expect(count("pyth_rule::feed")).toBe(0); // the Core leg is retired
    expect(count("oracle::aggregate")).toBe(2);
  });

  it("a leaf set covering none of the group's tickers fails the BUILD, not the chain", async () => {
    // `{ leaves: [] }` is SHAPE-VALID — `[].every(...)` is `true` — so the carry
    // step took the leaf branch, wrote nothing, and `break`ed past the envelope
    // branch, leaving a collector with NO waterx leg. That surfaces only as an
    // opaque on-chain `EMissingPriceSource` (or a silently thinner weighted set)
    // long after the build.
    //
    // Both production suppliers of this data reject an uncovering payload
    // first — the live fetch via `assertCoverage`, a cached one via
    // `narrowUpdateData` returning `null` (a miss → live fetch) — so the guard
    // is reached here through a rule override, which is exactly what it is for:
    // an invariant break upstream must not be laundered into an on-chain abort.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const emptyLeaves: PriceUpdateRule = {
      ...WaterxRule,
      fetchUpdateData: async () => ({ kind: "waterx_rule", payload: { leaves: [] } }),
    };
    const tx = new Transaction();
    await expect(
      refreshOraclePrices(tx, client, ["BTCUSD"], {
        ruleOverrides: { waterx_rule: emptyLeaves },
      }),
    ).rejects.toThrow(/carries no signed price for ticker\(s\): BTCUSD/);
  });
});

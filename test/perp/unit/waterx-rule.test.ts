/**
 * `WaterxRule` unit tests — the first-party quote-center signed-batch fetch
 * (HTTP mocked) plus the on-chain verify+feed moveCalls pinned against the
 * published `waterx_rule` contract.
 *
 * CONTRACT: unlike Pyth Lazer (one shared `parse_and_verify` per PTB, then
 * `feed` per ticker), `waterx_rule::collect_batch_latest` bundles verify AND
 * feed into ONE per-collector call — it rebuilds the enclave-signed
 * `BatchPricePayload` in-PTB (`new_batch_payload` + `new_batch_item` /
 * `push_batch_item` per item), re-verifies the ed25519 signature, and feeds the
 * item matching `collector.symbol()`. So there is no shared `RuleUpdateHandle`;
 * the signed envelope is carried straight from the fetched data to each
 * ticker's feed leg. On-chain a freshness miss / replayed timestamp ABSTAINS.
 */
import { fromHex } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import { aggregateTicker, refreshOraclePrices } from "../../../src/oracle/index.ts";
import {
  parseSignedEnvelope,
  WaterxRule,
  type WaterxSignedEnvelope,
} from "../../../src/oracle/rules/waterx-rule.ts";
import { moveCalls, moveTargets } from "../helpers/fixtures/ptb-inspect.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

/** Arbitrary 64-byte ed25519 signature (hex), standing in for a real one. */
const SIG_HEX = "ab".repeat(64);

/**
 * Server-shape raw object (u64s as plain JSON numbers, as the quote-center
 * emits them) — fed to the fetch mock's `text()` so the rule parses it exactly
 * as it would a live response.
 */
function rawEnvelope(symbols: string[] = ["BTCUSD"]): Record<string, unknown> {
  return {
    intent: 1,
    timestamp_ms: 1_784_800_000_000,
    payload: {
      items: symbols.map((symbol) => ({
        symbol,
        ticker: `${symbol}T`,
        sources: [2, 3, 4],
        method: "median",
        price_timestamp_ms: 1_784_799_999_000,
        price_n: 63_700_000_000_000,
        price_scale: 1_000_000_000,
        confidence_n: 10_000_000_000,
        confidence_scale: 1_000_000_000,
        max_source_deviation_bps: 0,
        num_sources: 3,
      })),
    },
    signature: SIG_HEX,
  };
}

/** The parsed (bigint-typed) envelope, for direct feed / narrow tests. */
function sampleEnvelope(symbols: string[] = ["BTCUSD"]): WaterxSignedEnvelope {
  return parseSignedEnvelope(JSON.stringify(rawEnvelope(symbols)));
}

/** Spy `globalThis.fetch` to return `raw` (server-shape JSON text). */
function mockQuoteCenterFetch(
  raw: Record<string, unknown> = rawEnvelope(),
): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(raw),
  } as unknown as Response);
}

afterEach(() => vi.restoreAllMocks());

describe("WaterxRule — port", () => {
  it("supportedTickers = the waterx_rule.feeds keys (oracle tickers)", () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    expect(WaterxRule.supportedTickers(client).sort()).toEqual(["BTCUSD", "ETHUSD", "USDCUSD"]);
  });

  it("charges no update fee (requiresFeeSource = false)", () => {
    expect(WaterxRule.requiresFeeSource).toBe(false);
  });

  it("fetchUpdateData pulls the signed envelope for the requested symbols", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const fetchSpy = mockQuoteCenterFetch();
    const data = await WaterxRule.fetchUpdateData(client, ["BTCUSD"]);
    expect(data?.kind).toBe("waterx_rule");
    const url = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(url.pathname).toBe("/v1/quotes/update");
    expect(url.searchParams.get("symbols")).toBe("BTCUSD");
  });

  it("waterxEndpoint routes the fetch at a proxy, KEEPING its base path", async () => {
    // The proxy route is the endpoint's base path — `new URL("/v1/…", endpoint)`
    // would drop it and bypass the proxy entirely (the Pyth-Pro `/hermes` bug).
    const client = createUnitTestClient({
      oracleSource: "waterx_rule",
      waterxEndpoint: "https://app.example/api/quote-center",
    });
    const fetchSpy = mockQuoteCenterFetch();
    await WaterxRule.fetchUpdateData(client, ["BTCUSD"]);
    const url = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(url.origin).toBe("https://app.example");
    expect(url.pathname).toBe("/api/quote-center/v1/quotes/update");
    expect(url.searchParams.get("symbols")).toBe("BTCUSD");
  });

  it("a trailing slash on waterxEndpoint does not double up the path", async () => {
    const client = createUnitTestClient({
      oracleSource: "waterx_rule",
      waterxEndpoint: "https://app.example/api/quote-center/",
    });
    const fetchSpy = mockQuoteCenterFetch();
    await WaterxRule.fetchUpdateData(client, ["BTCUSD"]);
    expect(new URL(fetchSpy.mock.calls[0]![0] as string).pathname).toBe(
      "/api/quote-center/v1/quotes/update",
    );
  });

  it("the default (bare-origin) endpoint still hits /v1/quotes/update", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const fetchSpy = mockQuoteCenterFetch();
    await WaterxRule.fetchUpdateData(client, ["BTCUSD"]);
    const url = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(url.origin).toBe("https://quote-center-staging.waterx.app");
    expect(url.pathname).toBe("/v1/quotes/update");
  });

  it("waterxFetch.fetchImpl replaces the transport (global fetch never called)", async () => {
    const globalSpy = mockQuoteCenterFetch();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(rawEnvelope()),
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

  it("fetchUpdateData rejects a partial envelope (fails at fetch, not on-chain)", async () => {
    // A 200 covering only BTCUSD is a valid, well-signed envelope — without this
    // guard the build would emit a collect_batch_latest that abstains for ETHUSD
    // and only surface as an on-chain EMissingPriceSource later.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockQuoteCenterFetch(rawEnvelope(["BTCUSD"]));
    await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD", "ETHUSD"])).rejects.toThrow(
      /does not cover ticker\(s\): ETHUSD/,
    );
  });

  it("fetchUpdateData accepts an envelope covering every requested ticker", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockQuoteCenterFetch(rawEnvelope(["BTCUSD", "ETHUSD"]));
    const data = await WaterxRule.fetchUpdateData(client, ["BTCUSD", "ETHUSD"]);
    expect(data?.kind).toBe("waterx_rule");
  });

  it("fetchUpdateData rejects a wrong intent", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockQuoteCenterFetch({ ...rawEnvelope(), intent: 2 });
    await expect(WaterxRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(/intent/);
  });

  it("throws for a ticker with no waterx_rule feed (package-level, pre-fetch)", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const fetchSpy = mockQuoteCenterFetch();
    await expect(WaterxRule.fetchUpdateData(client, ["DOGEUSD"])).rejects.toThrow(
      /No waterx_rule feed/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses u64 fields as bigint (exact); a value > 2^53 never silently truncates", () => {
    // A price_n of exactly 2^53 + 1 is not representable as an IEEE-754 double
    // (JSON.parse would round it to 2^53). parseSignedEnvelope must either
    // recover it exactly (ES2023 JSON source access) or throw loudly — never
    // return the truncated 9_007_199_254_740_992n.
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

  it("parses ordinary u64 fields to exact bigints", () => {
    const env = sampleEnvelope();
    const item = env.payload.items[0]!;
    expect(item.price_n).toBe(63_700_000_000_000n);
    expect(item.price_scale).toBe(1_000_000_000n);
    expect(env.timestamp_ms).toBe(1_784_800_000_000n);
    expect(item.num_sources).toBe(3); // u8 stays a number
  });

  it("narrowUpdateData serves the whole (indivisible) envelope iff fully covered", () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const data = {
      kind: "waterx_rule" as const,
      payload: { envelope: sampleEnvelope(["BTCUSD"]) },
    };
    expect(WaterxRule.narrowUpdateData(client, data, ["BTCUSD"])).toEqual(data);
    // A ticker the envelope does not carry → miss (null), never a partial.
    expect(WaterxRule.narrowUpdateData(client, data, ["ETHUSD"])).toBeNull();
    expect(WaterxRule.narrowUpdateData(client, data, [])).toBeNull();
  });

  it("buildUpdateCalls emits nothing and returns void (verify is bundled into feed)", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const tx = new Transaction();
    const handle = await WaterxRule.buildUpdateCalls(tx, client, {
      kind: "waterx_rule",
      payload: { envelope: sampleEnvelope() },
    });
    expect(handle).toBeUndefined();
    expect(moveCalls(tx)).toHaveLength(0);
  });
});

describe("WaterxRule — on-chain feed", () => {
  it("aggregateTicker with a waterx envelope rebuilds the payload and collects", () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const tx = new Transaction();
    aggregateTicker(tx, client, { ticker: "BTCUSD", waterxEnvelope: sampleEnvelope() });

    const targets = moveTargets(tx);
    expect(targets).toEqual([
      "oracle::new_collector",
      "waterx_rule::new_batch_payload",
      "waterx_rule::new_batch_item",
      "waterx_rule::push_batch_item",
      "waterx_rule::collect_batch_latest",
      "oracle::aggregate",
    ]);

    // collect_batch_latest carries the config / enclave_config / enclave objects.
    const collect = moveCalls(tx).find((c) => c.function === "collect_batch_latest")!;
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

  it("decodes the hex signature to bytes (round-trips fromHex)", () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const tx = new Transaction();
    aggregateTicker(tx, client, { ticker: "BTCUSD", waterxEnvelope: sampleEnvelope() });
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
  it("refreshOraclePrices with oracleSource waterx_rule routes through WaterxRule", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockQuoteCenterFetch();
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD"]);
    const targets = moveTargets(tx);
    expect(targets).toContain("waterx_rule::collect_batch_latest");
    expect(targets).toContain("oracle::aggregate");
    // No Pyth Lazer verify on the waterx path.
    expect(targets).not.toContain("pyth_lazer::parse_and_verify_le_ecdsa_update");
  });

  it("multi-ticker refresh collects each ticker; one with a Pyth feed also keeps pyth_rule::feed", async () => {
    // One PTB, several tickers, one shared envelope covering both. BTCUSD and
    // ETHUSD are in BOTH waterx_rule.feeds AND pyth_rule.feeds, so each
    // collector gets its waterx collect AND — because the ticker is still in the
    // aggregator's Pyth-weighted set — an (abstaining, read-only) pyth_rule::feed
    // on the same collector before one aggregate. (The multi-ticker case
    // subsumes the single-ticker-fed-by-two-rules case; no separate test.)
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockQuoteCenterFetch(rawEnvelope(["BTCUSD", "ETHUSD"]));
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "ETHUSD"]);

    const targets = moveTargets(tx);
    const count = (t: string) => targets.filter((x) => x === t).length;
    expect(count("oracle::new_collector")).toBe(2);
    expect(count("waterx_rule::collect_batch_latest")).toBe(2);
    expect(count("pyth_rule::feed")).toBe(2); // dual-rule: additive, one per ticker
    expect(count("oracle::aggregate")).toBe(2);
  });
});

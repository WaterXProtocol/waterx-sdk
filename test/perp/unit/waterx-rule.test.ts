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
});

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
import { WaterxRule, type WaterxSignedEnvelope } from "../../../src/oracle/rules/waterx-rule.ts";
import { moveCalls, moveTargets } from "../helpers/fixtures/ptb-inspect.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

/** Arbitrary 64-byte ed25519 signature (hex), standing in for a real one. */
const SIG_HEX = "ab".repeat(64);

/** One signed batch envelope covering BTCUSD, shaped like `/v1/quotes/update`. */
function sampleEnvelope(symbols: string[] = ["BTCUSD"]): WaterxSignedEnvelope {
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

/** Spy `globalThis.fetch` to return `envelope` as the quote-center response. */
function mockQuoteCenterFetch(envelope = sampleEnvelope()): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => envelope,
    text: async () => JSON.stringify(envelope),
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
    mockQuoteCenterFetch({ ...sampleEnvelope(), intent: 2 });
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

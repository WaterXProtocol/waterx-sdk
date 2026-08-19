/**
 * WL-2345 waterx seams — the surfaces consumers fold onto instead of
 * re-rolling quote-center plumbing: the exported raw fetchers
 * (`fetchWaterxSignedUpdate` / `fetchWaterxSignedLeaves`), the
 * coverage-policy fetch (`fetchWaterxUpdateData` strict vs partial), the
 * rule-owned replay identity (`updateIdentityBySymbol`), and the freshness
 * contract (`WATERX_MAX_PRICE_AGE_MS` / `isFreshWaterxEntry`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchWaterxSignedLeaves,
  fetchWaterxSignedUpdate,
  fetchWaterxUpdateData,
  isFreshWaterxEntry,
  parseSignedEnvelope,
  parseSignedLeaves,
  WATERX_MAX_PRICE_AGE_MS,
  waterxLeavesOf,
  WaterxRule,
} from "../../../src/oracle/rules/waterx-rule.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const SIG_HEX = "ab".repeat(64);
const HASH_HEX = "cd".repeat(32);

function leavesText(symbols: string[]): string {
  const leaves = symbols.map(
    (symbol) => `{
      "symbol": "${symbol}", "ticker": "${symbol}T",
      "price_n": 63700000000000, "price_scale": 1000000000,
      "confidence_n": 10000000000, "confidence_scale": 1000000000,
      "sources": [2, 3], "method": "median",
      "num_sources": 2, "max_source_deviation_bps": 0,
      "price_timestamp_ms": 1784799999000,
      "signed_timestamp_ms": 1784800000000,
      "root": "${HASH_HEX}", "proof": ["${HASH_HEX}"],
      "signature": "${SIG_HEX}"
    }`,
  );
  return `{"leaves":[${leaves.join(",")}]}`;
}

function envelopeText(symbols: string[]): string {
  const items = symbols.map(
    (symbol) => `{
      "symbol": "${symbol}", "ticker": "${symbol}T",
      "sources": [2, 3], "method": "median",
      "price_timestamp_ms": 1784799999000,
      "price_n": 63700000000000, "price_scale": 1000000000,
      "confidence_n": 10000000000, "confidence_scale": 1000000000,
      "max_source_deviation_bps": 0, "num_sources": 2
    }`,
  );
  return `{"intent": 1, "timestamp_ms": 1784800000000, "signature": "${SIG_HEX}", "payload": {"items": [${items.join(",")}]}}`;
}

/** Route-aware quote-center mock (leaves route + envelope route). */
function mockQuoteCenter(routes: {
  leaves?: { status?: number; text: string } | { status: 404 };
  update?: { status?: number; text: string };
}): ReturnType<typeof vi.spyOn> {
  return vi.spyOn(globalThis, "fetch").mockImplementation((input: unknown) => {
    const { pathname } = new URL(String(input));
    const route = pathname.endsWith("/v1/quotes/leaves")
      ? routes.leaves
      : pathname.endsWith("/v1/quotes/update")
        ? routes.update
        : undefined;
    const status = route?.status ?? (route ? 200 : 404);
    const text = route && "text" in route ? route.text : "Not Found";
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    } as unknown as Response);
  }) as ReturnType<typeof vi.spyOn>;
}

afterEach(() => vi.restoreAllMocks());

describe("fetchWaterxSignedLeaves / fetchWaterxSignedUpdate (public seams)", () => {
  it("fetchWaterxSignedLeaves returns parsed leaves on 200 and { unavailable } on a 404 route", async () => {
    mockQuoteCenter({ leaves: { text: leavesText(["BTCUSD"]) } });
    const pulled = await fetchWaterxSignedLeaves("https://qc.example", ["BTCUSD"]);
    expect("leaves" in pulled && pulled.leaves).toHaveLength(1);

    vi.restoreAllMocks();
    mockQuoteCenter({});
    const missing = await fetchWaterxSignedLeaves("https://qc.example", ["BTCUSD"]);
    expect("unavailable" in missing).toBe(true);
  });

  it("fetchWaterxSignedUpdate returns the parsed envelope with exact-bigint u64s", async () => {
    mockQuoteCenter({ update: { text: envelopeText(["BTCUSD"]) } });

    const envelope = await fetchWaterxSignedUpdate("https://qc.example", ["BTCUSD"]);

    expect(envelope.intent).toBe(1);
    expect(envelope.timestamp_ms).toBe(1_784_800_000_000n);
    expect(envelope.payload.items[0]!.price_n).toBe(63_700_000_000_000n);
  });

  it("fetchWaterxSignedUpdate rejects a wrong-intent envelope (mispointed endpoint)", async () => {
    mockQuoteCenter({
      update: { text: envelopeText(["BTCUSD"]).replace('"intent": 1', '"intent": 2') },
    });

    await expect(fetchWaterxSignedUpdate("https://qc.example", ["BTCUSD"])).rejects.toThrow(
      /intent 2, expected BATCH_PRICE_INTENT 1/,
    );
  });
});

describe("fetchWaterxUpdateData — coverage policy", () => {
  it("strict (default) throws on a coverage gap, exactly like rule.fetchUpdateData", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockQuoteCenter({ leaves: { text: leavesText(["BTCUSD"]) } });

    await expect(fetchWaterxUpdateData(client, ["BTCUSD", "ETHUSD"])).rejects.toThrow(
      /does not cover ticker\(s\): ETHUSD/,
    );
  });

  it("strict success mirrors the rule's own payload, with missing: []", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockQuoteCenter({ leaves: { text: leavesText(["BTCUSD"]) } });

    const { data, missing } = await fetchWaterxUpdateData(client, ["BTCUSD"]);

    expect(missing).toEqual([]);
    expect(data?.kind).toBe("waterx_rule");
    expect(waterxLeavesOf(data)).toHaveLength(1);
  });

  it("partial: config-unlisted tickers land in `missing` and are NEVER sent to the quote-center", async () => {
    // The quote-center 404s whole batches on unknown symbols — one unlisted
    // ticker must not take down the listed ones' pull.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const spy = mockQuoteCenter({ leaves: { text: leavesText(["BTCUSD"]) } });

    const { data, missing } = await fetchWaterxUpdateData(client, ["BTCUSD", "DOGEUSD"], {
      coverage: "partial",
    });

    expect(missing).toEqual(["DOGEUSD"]);
    expect(waterxLeavesOf(data)).toHaveLength(1);
    const url = new URL(String(spy.mock.calls[0]![0]));
    expect(url.searchParams.get("symbols")).toBe("BTCUSD");
  });

  it("partial: a served-short leaf response subsets the payload and reports the uncovered tickers", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockQuoteCenter({ leaves: { text: leavesText(["BTCUSD"]) } });

    const { data, missing } = await fetchWaterxUpdateData(client, ["BTCUSD", "ETHUSD"], {
      coverage: "partial",
    });

    expect(missing).toEqual(["ETHUSD"]);
    const leaves = waterxLeavesOf(data);
    expect(leaves?.map((leaf) => leaf.symbol)).toEqual(["BTCUSD"]);
  });

  it("partial: the envelope fallback is kept iff it covers ≥1 requested ticker (indivisible)", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    mockQuoteCenter({ update: { text: envelopeText(["BTCUSD"]) } }); // no leaf route

    const covered = await fetchWaterxUpdateData(client, ["BTCUSD", "ETHUSD"], {
      coverage: "partial",
    });
    expect(covered.missing).toEqual(["ETHUSD"]);
    expect(covered.data?.kind).toBe("waterx_rule");

    vi.restoreAllMocks();
    mockQuoteCenter({ update: { text: envelopeText(["XAUUSD"]) } }); // serves none requested
    const uncovered = await fetchWaterxUpdateData(client, ["BTCUSD", "ETHUSD"], {
      coverage: "partial",
    });
    expect(uncovered.data).toBeNull();
    expect(uncovered.missing.sort()).toEqual(["BTCUSD", "ETHUSD"]);
  });

  it("partial: all-unlisted resolves { data: null, missing: <all> } without any fetch", async () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const spy = vi.spyOn(globalThis, "fetch");

    const { data, missing } = await fetchWaterxUpdateData(client, ["DOGEUSD"], {
      coverage: "partial",
    });

    expect(data).toBeNull();
    expect(missing).toEqual(["DOGEUSD"]);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("WaterxRule.updateIdentityBySymbol — the F-014 replay key, rule-owned", () => {
  it("leaves → symbol → its OWN signed_timestamp_ms", () => {
    const leaves = parseSignedLeaves(leavesText(["BTCUSD", "ETHUSD"]));
    const identity = WaterxRule.updateIdentityBySymbol!({
      kind: "waterx_rule",
      payload: { leaves },
    });

    expect(identity).toEqual(
      new Map([
        ["BTCUSD", 1_784_800_000_000n],
        ["ETHUSD", 1_784_800_000_000n],
      ]),
    );
  });

  it("envelope → every covered symbol keyed to the ONE batch timestamp_ms", () => {
    const envelope = parseSignedEnvelope(envelopeText(["BTCUSD", "XAUUSD"]));
    const identity = WaterxRule.updateIdentityBySymbol!({
      kind: "waterx_rule",
      payload: { envelope },
    });

    expect(identity).toEqual(
      new Map([
        ["BTCUSD", 1_784_800_000_000n],
        ["XAUUSD", 1_784_800_000_000n],
      ]),
    );
  });

  it("null data → null (no identity to guard)", () => {
    expect(WaterxRule.updateIdentityBySymbol!(null)).toBeNull();
  });
});

describe("freshness contract", () => {
  it("WATERX_MAX_PRICE_AGE_MS mirrors the on-chain FeedConfig max_age default (90s)", () => {
    expect(WATERX_MAX_PRICE_AGE_MS).toBe(90_000);
  });

  it("isFreshWaterxEntry: inclusive at exactly max age, stale one ms past it", () => {
    const entry = { price: 1, conf: 0, publishTimeMs: 1_000_000 };
    expect(isFreshWaterxEntry(entry, 1_000_000 + WATERX_MAX_PRICE_AGE_MS)).toBe(true);
    expect(isFreshWaterxEntry(entry, 1_000_000 + WATERX_MAX_PRICE_AGE_MS + 1)).toBe(false);
  });
});

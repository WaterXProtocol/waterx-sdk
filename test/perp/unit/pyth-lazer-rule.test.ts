/**
 * `PythLazerRule` unit tests — Lazer signed-update fetch (HTTP mocked) plus
 * the on-chain verify/feed moveCalls pinned against the published contract.
 *
 * ============================================================================
 * CONTRACT (Step 0) — read from `waterx-contract` @ origin/feat/pyth-lazer-rule
 * (`waterx_oracle_rule/pyth_lazer_rule/sources/pyth_lazer_rule.move`, its
 * Move.toml pins, `scripts/deploy/lazer-price-probe.ts`, and
 * `waterx_oracle/sources/{aggregator,collector}.move`):
 *
 * 1. VERIFY (external Pyth Lazer package — NOT in waterx-config; per-network
 *    constant, see `LAZER_DEFAULTS[network].verifier_package`; testnet is the
 *    original v1 publish 0xf5bd2141…, mainnet the v2-upgraded 0xefbfd064…
 *    which still exposes this v1 entry):
 *      pyth_lazer::parse_and_verify_le_ecdsa_update(
 *        state:  &State,        // waterx-config packages.pyth_lazer_rule.state
 *        clock:  &Clock,        // 0x6
 *        update: vector<u8>,    // the signed `leEcdsa` message bytes
 *      ): Update
 *    Called ONCE per PTB: one secp256k1 trusted-signer check covers every feed
 *    in the message. NO update fee — no Coin argument (unlike Pyth Core's
 *    per-feed `base_update_fee`), so `BuildUpdateOpts.feeSource`/`cache` are
 *    ignored by this rule.
 *
 * 2. FEED (waterx `pyth_lazer_rule` package, `published_at` from config):
 *      pyth_lazer_rule::feed(
 *        collector: &mut PriceCollector,  // from oracle::new_collector(ticker)
 *        config:    &Config,              // packages.pyth_lazer_rule.config
 *        clock:     &Clock,               // 0x6
 *        update:    &Update,              // the verify result, by reference
 *      )
 *    Per ticker; abstains (collects `none`, never aborts) when: symbol not in
 *    `Config.feed_id_map`, feed id absent from the update, degenerate
 *    price/exponent, confidence wider than the configured bps gate, or
 *    `Update.timestamp()` (MICROSECONDS — the rule divides by 1000) diverges
 *    from the Clock by more than `tolerance_ms` (default 5s).
 *
 * 3. FEED IDENTITY: integer u32 Lazer feed id per oracle symbol
 *    (`Config.feed_id_map`, admin `set_feed_id`); mirrored off-chain as
 *    `packages.pyth_lazer_rule.feeds: Record<ticker, number>` (BTCUSD=1,
 *    ETHUSD=2, USDCUSD=7 on testnet). `enabled` is never read for routing.
 *
 * 4. PAYLOAD ENCODING: Lazer `leEcdsa` framing — u32 magic, 65-byte secp256k1
 *    signature, u16 payload length, payload (u32 magic + u64 LE TimestampUs +
 *    per-feed data). Fetched off-chain from the Lazer HTTP API
 *    (`POST {LAZER_DEFAULTS.endpoint}/v1/latest_price`, `Authorization:
 *    Bearer <pyth.api_key>`; path + required `channel` field + Bearer auth
 *    verified live against the endpoint). The v1 on-chain `channel::from_u8`
 *    aborts on the 1000ms fixed-rate channel; the request pins
 *    `fixed_rate@200ms` — the fastest channel every configured feed supports
 *    (19/29 don't publish `real_time`, and one incapable feed rejects the
 *    whole batch). See LAZER_LATEST_PRICE_REQUEST's doc.
 *
 * 5. AGGREGATE SEMANTICS (`aggregator::remove_outliers`) — decides the feed
 *    branch implemented in `aggregate.ts`: it aborts `EMissingPriceSource`
 *    unless EVERY rule weighted on the ticker's aggregator APPEARS in the
 *    collector (an abstention counts as appearing), drops `none` observations
 *    only after that presence check, and SILENTLY DROPS contributions from
 *    unweighted rules. `pyth_rule::feed` only reads the `PriceInfoObject` and
 *    abstains when stale (never aborts). Therefore a lazer-routed ticker that
 *    still has a `pyth_rule.feeds` entry keeps its `pyth_rule::feed` leg AND
 *    gains `pyth_lazer_rule::feed` — additive feed-per-serving-rule, no
 *    guard-and-throw needed for dual-registered tickers.
 * ============================================================================
 */
import { toHex } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LAZER_DEFAULTS } from "../../../src/oracle/config.ts";
import { aggregateTicker, refreshOraclePrices } from "../../../src/oracle/index.ts";
import type { RuleUpdateHandle } from "../../../src/oracle/price-update-rule.ts";
import { PythCoreRule } from "../../../src/oracle/rules/pyth-core-rule.ts";
import {
  LazerApiKeyMissingError,
  PythLazerRule,
} from "../../../src/oracle/rules/pyth-lazer-rule.ts";
import { moveCalls, moveTargets } from "../helpers/fixtures/ptb-inspect.ts";
import { attachPythGrpcMocks, mockAccumulatorUpdate } from "../helpers/fixtures/pyth-mock-grpc.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

/** Arbitrary signed-update bytes standing in for a real `leEcdsa` message. */
const SIGNED_UPDATE = new Uint8Array([0xb9, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);

const CLOCK_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";

/** The object id an `{ Input: n }` argument refers to (unresolved or shared). */
function inputObjectId(tx: Transaction, argument: { Input?: number }): string | undefined {
  if (argument.Input === undefined) return undefined;
  const input = tx.getData().inputs[argument.Input];
  return input.UnresolvedObject?.objectId ?? input.Object?.SharedObject?.objectId;
}

/** The base64 BCS bytes an `{ Input: n }` pure argument carries. */
function inputPureBytes(tx: Transaction, argument: { Input?: number }): string | undefined {
  if (argument.Input === undefined) return undefined;
  return tx.getData().inputs[argument.Input].Pure?.bytes;
}

/**
 * Index — over ALL commands, which is what `NestedResult` refers to — of the
 * single lazer verify call in the PTB.
 */
function verifyCommandIndex(tx: Transaction): number {
  return (tx.getData().commands ?? []).findIndex(
    (c) => c.$kind === "MoveCall" && c.MoveCall?.function === "parse_and_verify_le_ecdsa_update",
  );
}

/** Client with a lazer api key set (replace `pyth` — never mutate the shared PYTH_DEFAULTS). */
function createLazerTestClient(oracleSource?: "pyth_lazer_rule") {
  const client = createUnitTestClient(oracleSource ? { oracleSource } : {});
  client.pyth = { ...client.pyth, api_key: "unit-test-token" };
  return client;
}

function mockLazerFetch(): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      parsed: {},
      leEcdsa: { encoding: "hex", data: toHex(SIGNED_UPDATE) },
    }),
  }));
  globalThis.fetch = fetchSpy as unknown as typeof fetch;
  return fetchSpy;
}

async function buildHandle(
  tx: Transaction,
  client: ReturnType<typeof createUnitTestClient>,
  feedIds: number[],
): Promise<RuleUpdateHandle> {
  const handle =
    (await PythLazerRule.buildUpdateCalls(tx, client, {
      kind: "pyth_lazer_rule",
      payload: { update: SIGNED_UPDATE, feedIds },
    })) ?? undefined;
  if (!handle) throw new Error("expected buildUpdateCalls to return a RuleUpdateHandle");
  return handle;
}

describe("PythLazerRule.kind", () => {
  it("is 'pyth_lazer_rule'", () => {
    expect(PythLazerRule.kind).toBe("pyth_lazer_rule");
  });
});

describe("PythLazerRule.supportedTickers", () => {
  it("returns the tickers with integer lazer feed ids configured", () => {
    const client = createUnitTestClient();
    expect(PythLazerRule.supportedTickers(client).sort()).toEqual(["BTCUSD", "ETHUSD", "USDCUSD"]);
  });

  it("returns an empty array when the pyth_lazer_rule package is absent", () => {
    const client = createUnitTestClient();
    delete client.config.packages.pyth_lazer_rule;
    expect(PythLazerRule.supportedTickers(client)).toEqual([]);
  });
});

describe("PythLazerRule.fetchUpdateData", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("resolves integer feed ids and returns the wrapped single-update payload", async () => {
    const client = createLazerTestClient();
    mockLazerFetch();

    const data = await PythLazerRule.fetchUpdateData(client, ["BTCUSD", "ETHUSD"]);

    expect(data).toEqual({
      kind: "pyth_lazer_rule",
      payload: { update: SIGNED_UPDATE, feedIds: [1, 2] },
    });
  });

  it("POSTs the pinned Lazer request to /v1/latest_price with the Bearer key from pyth.api_key", async () => {
    const client = createLazerTestClient();
    let captured: { url: string; init: RequestInit | undefined } | undefined;
    globalThis.fetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      captured = { url: url.toString(), init };
      return {
        ok: true,
        json: async () => ({ leEcdsa: { encoding: "hex", data: toHex(SIGNED_UPDATE) } }),
      };
    }) as unknown as typeof fetch;

    await PythLazerRule.fetchUpdateData(client, ["BTCUSD"]);

    expect(captured?.url).toBe(
      new URL("/v1/latest_price", LAZER_DEFAULTS.TESTNET.endpoint).toString(),
    );
    expect(captured?.init?.method).toBe("POST");
    expect(captured?.init?.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer unit-test-token",
    });
    expect(JSON.parse(String(captured?.init?.body))).toEqual({
      priceFeedIds: [1],
      properties: ["price", "exponent", "confidence"],
      formats: ["leEcdsa"],
      jsonBinaryEncoding: "hex",
      // fixed_rate@200ms, not real_time: 19 of the 29 configured feeds
      // (incl. SUIUSD and every xStock) don't publish real_time, and one
      // incapable feed 400s the WHOLE batch. 200ms is the fastest channel
      // every configured feed supports (see LAZER_LATEST_PRICE_REQUEST).
      channel: "fixed_rate@200ms",
    });
  });

  it("returns null and skips the fetch for an empty ticker list", async () => {
    const client = createLazerTestClient();
    const fetchSpy = mockLazerFetch();

    const data = await PythLazerRule.fetchUpdateData(client, []);

    expect(data).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("propagates the feed-lookup throw for a ticker outside supportedTickers, without fetching", async () => {
    const client = createLazerTestClient();
    const fetchSpy = mockLazerFetch();
    expect(PythLazerRule.supportedTickers(client)).not.toContain("DOGEUSD");

    await expect(PythLazerRule.fetchUpdateData(client, ["DOGEUSD"])).rejects.toThrow(
      /No pyth_lazer_rule feed listed for ticker: DOGEUSD/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws the package-not-deployed error (not a per-ticker feed error) when the config carries no pyth_lazer_rule package", async () => {
    const client = createLazerTestClient();
    delete client.config.packages.pyth_lazer_rule;
    const fetchSpy = mockLazerFetch();

    await expect(PythLazerRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(
      /pyth_lazer_rule package is not deployed in this config/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws LazerApiKeyMissing (before any network call) when pyth.api_key is unset", async () => {
    const client = createUnitTestClient(); // no api_key
    const fetchSpy = mockLazerFetch();

    const rejection = expect(PythLazerRule.fetchUpdateData(client, ["BTCUSD"])).rejects;
    await rejection.toThrow(/LazerApiKeyMissing/);
    // instanceof-able (mirrors OracleFeeSourceUnavailableError) — a consumer
    // can branch on the error type directly instead of string-matching
    // `.message`.
    await rejection.toBeInstanceOf(LazerApiKeyMissingError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws with status and body on a non-ok Lazer response", async () => {
    const client = createLazerTestClient();
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      text: async () => "no token specified",
    })) as unknown as typeof fetch;

    await expect(PythLazerRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(
      /Lazer price fetch failed: 403 no token specified/,
    );
  });

  it("throws when the response carries no leEcdsa update data", async () => {
    const client = createLazerTestClient();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ parsed: {} }),
    })) as unknown as typeof fetch;

    await expect(PythLazerRule.fetchUpdateData(client, ["BTCUSD"])).rejects.toThrow(
      /Lazer returned no leEcdsa update data/,
    );
  });
});

describe("PythLazerRule.buildUpdateCalls", () => {
  it("appends exactly the contract's parse_and_verify_le_ecdsa_update(state, clock, bytes) call and returns the Update handle", async () => {
    const client = createUnitTestClient();
    const tx = new Transaction();

    const handle = await buildHandle(tx, client, [1]);

    const calls = moveCalls(tx);
    expect(calls).toHaveLength(1);
    // Target: the per-network external Lazer verifier package (NOT the waterx
    // rule package, and NOT any id from the waterx-config JSON).
    expect(calls[0].package).toBe(LAZER_DEFAULTS.TESTNET.verifier_package);
    expect(calls[0].module).toBe("pyth_lazer");
    expect(calls[0].function).toBe("parse_and_verify_le_ecdsa_update");
    // Argument order per the contract: state, clock, update bytes.
    expect(calls[0].arguments).toHaveLength(3);
    expect(inputObjectId(tx, calls[0].arguments[0])).toBe(
      client.config.packages.pyth_lazer_rule?.state,
    );
    expect(inputObjectId(tx, calls[0].arguments[1])).toBe(CLOCK_ID);
    expect(inputPureBytes(tx, calls[0].arguments[2])).toBe(
      bcs.vector(bcs.u8()).serialize(SIGNED_UPDATE).toBase64(),
    );
    expect(handle.kind).toBe("pyth_lazer_rule");
    expect(handle.update).toBeDefined();
  });

  it("is a no-op returning no handle when data is null (empty ticker list upstream)", async () => {
    const client = createUnitTestClient();
    const tx = new Transaction();

    const handle = await PythLazerRule.buildUpdateCalls(tx, client, null);

    expect(handle).toBeUndefined();
    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });

  it("throws on kind mismatch even when the payload shape looks like a lazer update", () => {
    const client = createUnitTestClient();
    const tx = new Transaction();
    // Correct lazer SHAPE, wrong KIND — the kind check must reject before the
    // shape check can accept, or a Core-tagged payload would verify as Lazer.
    const coreTaggedLazerShape = {
      kind: "pyth_rule" as const,
      payload: { update: SIGNED_UPDATE, feedIds: [1] },
    };

    // Sync throw: the lazer rule's buildUpdateCalls has nothing to await.
    expect(() => PythLazerRule.buildUpdateCalls(tx, client, coreTaggedLazerShape)).toThrow(
      /expected 'pyth_lazer_rule'/,
    );
    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });

  it("PythCoreRule rejects a lazer-tagged payload the same way (wrong-kind, other direction)", async () => {
    const client = createUnitTestClient();
    const tx = new Transaction();
    const lazerTaggedCoreShape = {
      kind: "pyth_lazer_rule" as const,
      payload: { updates: [mockAccumulatorUpdate()], feedIds: ["0xfeed"] },
    };

    await expect(PythCoreRule.buildUpdateCalls(tx, client, lazerTaggedCoreShape)).rejects.toThrow(
      /expected 'pyth_rule'/,
    );
    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });

  it("throws on a 'pyth_lazer_rule' payload with a foreign shape", () => {
    const client = createUnitTestClient();
    const tx = new Transaction();
    // Pyth-Core-shaped payload ({updates, feedIds}) tagged as lazer.
    const wrongShape = {
      kind: "pyth_lazer_rule" as const,
      payload: { updates: [SIGNED_UPDATE], feedIds: [1] },
    };

    expect(() => PythLazerRule.buildUpdateCalls(tx, client, wrongShape)).toThrow(
      /unexpected shape/,
    );
  });

  it("throws when the config carries no pyth_lazer_rule package", () => {
    const client = createUnitTestClient();
    delete client.config.packages.pyth_lazer_rule;
    const tx = new Transaction();

    expect(() =>
      PythLazerRule.buildUpdateCalls(tx, client, {
        kind: "pyth_lazer_rule",
        payload: { update: SIGNED_UPDATE, feedIds: [1] },
      }),
    ).toThrow(/pyth_lazer_rule package is not deployed/);
  });
});

describe("PythLazerRule.narrowUpdateData", () => {
  /** Whole-universe payload as the BE prefetch cache holds it: one signed
   *  message covering every configured feed (BTCUSD=1, ETHUSD=2, USDCUSD=7). */
  const universeLazerData = {
    kind: "pyth_lazer_rule" as const,
    payload: { update: SIGNED_UPDATE, feedIds: [1, 2, 7] },
  };

  it("serves the WHOLE payload for a covered subset — one signed message is indivisible", () => {
    const client = createUnitTestClient();

    const narrowed = PythLazerRule.narrowUpdateData(client, universeLazerData, ["BTCUSD"]);

    expect(narrowed).toEqual({ kind: "pyth_lazer_rule", payload: universeLazerData.payload });
    // Whole-payload pass-through by reference — the secp256k1 signature only
    // verifies over the full message bytes, so a trimmed copy would be invalid.
    expect(narrowed?.payload).toBe(universeLazerData.payload);
  });

  it("serves the whole payload when every packed ticker is requested, in any order", () => {
    const client = createUnitTestClient();

    const narrowed = PythLazerRule.narrowUpdateData(client, universeLazerData, [
      "USDCUSD",
      "BTCUSD",
      "ETHUSD",
    ]);

    expect(narrowed?.payload).toBe(universeLazerData.payload);
  });

  it("misses (null) for a config-listed ticker whose feed id is not packed in this payload", () => {
    const client = createUnitTestClient();
    const btcOnly = {
      kind: "pyth_lazer_rule" as const,
      payload: { update: SIGNED_UPDATE, feedIds: [1] },
    };

    // ETHUSD has a lazer feed configured (id 2), but this message never
    // carried it — the payload can only be used whole, so this is a miss.
    expect(PythLazerRule.narrowUpdateData(client, btcOnly, ["BTCUSD", "ETHUSD"])).toBeNull();
  });

  it("misses (null) for a ticker with no pyth_lazer_rule feed configured", () => {
    const client = createUnitTestClient();
    expect(PythLazerRule.supportedTickers(client)).not.toContain("DOGEUSD");

    expect(PythLazerRule.narrowUpdateData(client, universeLazerData, ["DOGEUSD"])).toBeNull();
  });

  it("returns null for an empty ticker list (mirrors fetchUpdateData's empty → null)", () => {
    const client = createUnitTestClient();

    expect(PythLazerRule.narrowUpdateData(client, universeLazerData, [])).toBeNull();
  });

  it("passes null data through as null", () => {
    const client = createUnitTestClient();

    expect(PythLazerRule.narrowUpdateData(client, null, ["BTCUSD"])).toBeNull();
  });

  it("throws on a wrong-kind payload instead of missing (a routing bug, not a cache miss)", () => {
    const client = createUnitTestClient();

    expect(() =>
      PythLazerRule.narrowUpdateData(
        client,
        { kind: "pyth_rule", payload: { update: SIGNED_UPDATE, feedIds: [1] } },
        ["BTCUSD"],
      ),
    ).toThrow(/expected 'pyth_lazer_rule'/);
  });

  it("narrowed (whole) payload is accepted by buildUpdateCalls, appending the single verify call", async () => {
    const client = createUnitTestClient();
    const tx = new Transaction();

    const narrowed = PythLazerRule.narrowUpdateData(client, universeLazerData, [
      "BTCUSD",
      "ETHUSD",
    ]);
    const handle = await PythLazerRule.buildUpdateCalls(tx, client, narrowed);

    expect(handle?.kind).toBe("pyth_lazer_rule");
    expect(moveTargets(tx)).toEqual(["pyth_lazer::parse_and_verify_le_ecdsa_update"]);
  });
});

describe("aggregateTicker — lazer collector-feed leg", () => {
  it("feeds BOTH pyth_rule and pyth_lazer_rule for a dual-registered lazer-routed ticker (additive per remove_outliers)", async () => {
    const client = createUnitTestClient();
    const tx = new Transaction();
    const handle = await buildHandle(tx, client, [1]);

    aggregateTicker(tx, client, {
      ticker: "BTCUSD",
      priceInfoObjectId: client.getPythFeed("BTCUSD").price_info_object,
      lazerUpdate: handle.update,
    });

    const targets = moveTargets(tx);
    expect(targets).toContain("pyth_rule::feed");
    expect(targets).toContain("pyth_lazer_rule::feed");
    expect(targets).toContain("oracle::aggregate");
    // The lazer feed call matches the contract: waterx rule package,
    // (collector, config, clock, update) in that order.
    const feedCall = moveCalls(tx).find(
      (c) => `${c.module}::${c.function}` === "pyth_lazer_rule::feed",
    );
    expect(feedCall?.package).toBe(client.config.packages.pyth_lazer_rule?.published_at);
    expect(feedCall?.arguments).toHaveLength(4);
    expect(feedCall?.arguments[0].$kind).toBe("Result"); // the collector
    expect(inputObjectId(tx, feedCall?.arguments[1] ?? {})).toBe(
      client.config.packages.pyth_lazer_rule?.config,
    );
    expect(inputObjectId(tx, feedCall?.arguments[2] ?? {})).toBe(CLOCK_ID);
    // Handle identity: the Update argument is THE verify command's first
    // return — not merely some NestedResult.
    expect(feedCall?.arguments[3].NestedResult).toEqual([verifyCommandIndex(tx), 0]);
  });

  it("feeds lazer alone (no pyth_rule::feed) for a ticker without a pyth feed entry", async () => {
    const client = createUnitTestClient();
    delete client.config.packages.pyth_rule!.feeds.BTCUSD;
    const tx = new Transaction();
    const handle = await buildHandle(tx, client, [1]);

    aggregateTicker(tx, client, { ticker: "BTCUSD", lazerUpdate: handle.update });

    const targets = moveTargets(tx);
    expect(targets).toContain("pyth_lazer_rule::feed");
    expect(targets).not.toContain("pyth_rule::feed");
    expect(targets).toContain("oracle::aggregate");
  });
});

describe("refreshOraclePrices — real PythLazerRule routing (no overrides)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("verifies once and feeds every lazer-routed ticker from the same Update, keeping each ticker's pyth_rule::feed leg", async () => {
    const client = createLazerTestClient("pyth_lazer_rule");
    mockLazerFetch(); // every requested ticker is lazer-supported → no Core fallback, no Hermes call

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "ETHUSD"]);

    const targets = moveTargets(tx);
    expect(
      targets.filter((t) => t === "pyth_lazer::parse_and_verify_le_ecdsa_update"),
    ).toHaveLength(1);
    expect(targets.filter((t) => t === "oracle::new_collector")).toHaveLength(2);
    expect(targets.filter((t) => t === "pyth_lazer_rule::feed")).toHaveLength(2);
    // Additive: the dual-registered tickers keep their (abstain-on-stale) Pyth leg …
    expect(targets.filter((t) => t === "pyth_rule::feed")).toHaveLength(2);
    expect(targets.filter((t) => t === "oracle::aggregate")).toHaveLength(2);
    // … but the Pyth Core UPDATE block never runs for a fully lazer-served set.
    expect(targets).not.toContain("pyth::update_single_price_feed");
    // One verification serves every feed: BOTH tickers' feed calls take the
    // SAME Update — the single verify command's first return.
    const updateArgs = moveCalls(tx)
      .filter((c) => `${c.module}::${c.function}` === "pyth_lazer_rule::feed")
      .map((c) => c.arguments[3].NestedResult);
    expect(updateArgs).toEqual([
      [verifyCommandIndex(tx), 0],
      [verifyCommandIndex(tx), 0],
    ]);
  });

  it("carries a lazer block AND a Pyth Core fallback block in one PTB when a ticker lacks a lazer feed", async () => {
    const client = createLazerTestClient("pyth_lazer_rule");
    attachPythGrpcMocks(client);
    // ETHUSD drops out of lazer support → falls back to the Pyth Core group.
    delete client.config.packages.pyth_lazer_rule?.feeds.ETHUSD;
    const hermesUpdate = mockAccumulatorUpdate();
    globalThis.fetch = vi.fn(async (url: string | URL) =>
      url.toString().includes("/v1/latest_price")
        ? {
            ok: true,
            json: async () => ({ leEcdsa: { encoding: "hex", data: toHex(SIGNED_UPDATE) } }),
          }
        : {
            ok: true,
            json: async () => ({ binary: { data: [toHex(hermesUpdate)] } }),
          },
    ) as unknown as typeof fetch;

    const tx = new Transaction();
    await refreshOraclePrices(tx, client, ["BTCUSD", "ETHUSD"], { feeSource: { kind: "gas" } });

    const targets = moveTargets(tx);
    // Lazer generation: one verify, one feed (BTCUSD only).
    expect(
      targets.filter((t) => t === "pyth_lazer::parse_and_verify_le_ecdsa_update"),
    ).toHaveLength(1);
    expect(targets.filter((t) => t === "pyth_lazer_rule::feed")).toHaveLength(1);
    // Pyth Core generation for the fallback ticker (its own verify + update block).
    expect(targets).toContain("pyth::update_single_price_feed");
    // Both tickers aggregate, and both feed pyth_rule (ETHUSD refreshed, BTCUSD abstain-on-stale).
    expect(targets.filter((t) => t === "pyth_rule::feed")).toHaveLength(2);
    expect(targets.filter((t) => t === "oracle::aggregate")).toHaveLength(2);
  });

  it("mixed shape with no fee source throws OracleFeeSourceUnavailable before the lazer group can mutate tx (zero commands appended)", async () => {
    const client = createLazerTestClient("pyth_lazer_rule");
    attachPythGrpcMocks(client);
    // ETHUSD drops out of lazer support → falls back to the Pyth Core group,
    // which needs a fee source; BTCUSD stays lazer-covered (fee-free, and
    // would build first — see the group-ordering comment in
    // `refreshOraclePrices`). If the lazer group ran before the Pyth Core
    // fallback's own per-call guard fired, it would already have mutated
    // `tx`. The hoisted pre-check in `refreshOraclePrices` must catch this
    // BEFORE either group builds, so the whole call is atomic: throw or
    // zero PTB commands, never a partial mutation.
    delete client.config.packages.pyth_lazer_rule?.feeds.ETHUSD;
    const hermesUpdate = mockAccumulatorUpdate();
    globalThis.fetch = vi.fn(async (url: string | URL) =>
      url.toString().includes("/v1/latest_price")
        ? {
            ok: true,
            json: async () => ({ leEcdsa: { encoding: "hex", data: toHex(SIGNED_UPDATE) } }),
          }
        : {
            ok: true,
            json: async () => ({ binary: { data: [toHex(hermesUpdate)] } }),
          },
    ) as unknown as typeof fetch;

    const tx = new Transaction();
    await expect(refreshOraclePrices(tx, client, ["BTCUSD", "ETHUSD"])).rejects.toThrow(
      /OracleFeeSourceUnavailable/,
    );

    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });
});

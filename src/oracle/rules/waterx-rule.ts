/**
 * `WaterxRule` — `PriceUpdateRule` for the first-party WaterX quote-center
 * (Nautilus-TEE, ed25519), plus `feedWaterxRule`, the collector-feed leg
 * `aggregateTicker` appends per waterx-routed ticker. Pulls one enclave-signed
 * batch envelope covering every requested ticker from the quote-center
 * (`GET /v1/quotes/update?symbols=…`, endpoint from `host.waterx` — the
 * `waterxEndpoint`/`waterxFetch` create options — else `WATERX_DEFAULTS`), then —
 * unlike Pyth Lazer, whose verify is a single shared PTB step — verifies AND
 * feeds in ONE `waterx_rule::collect_batch_latest` call per collector (the Move
 * API bundles the two). So `buildUpdateCalls` emits nothing and the signed
 * envelope is handed straight to the per-ticker feed leg.
 *
 * `collect_batch_latest` is the dual-rule path: it feeds the item matching
 * `collector.symbol()` WITHOUT aggregating, so a waterx-routed ticker composes
 * onto the same collector as Pyth/Supra (compose-then-aggregate). On-chain a
 * freshness miss / replayed timestamp ABSTAINS (the other weighted rules
 * cover); a config/integrity mismatch or bad signature aborts.
 */

import { fromHex } from "@mysten/bcs";
import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import {
  collectBatchLatest,
  newBatchItem,
  newBatchPayload,
  pushBatchItem,
} from "../../generated/waterx_rule/waterx_rule.ts";
import { WATERX_DEFAULTS, type WaterxRulePackage } from "../config.ts";
import type { OracleHost } from "../host.ts";
import {
  assertRuleUpdateData,
  type BuildUpdateOpts,
  type PriceUpdateRule,
  type RuleUpdateData,
} from "../price-update-rule.ts";
import {
  FetchPolicyError,
  fetchWithPolicy,
  joinEndpointPath,
  type FetchPolicy,
} from "../update-fetch.ts";

/** The single signing intent (`BATCH_PRICE_INTENT`) the quote-center emits. */
const BATCH_PRICE_INTENT = 1;

/**
 * One item inside a signed batch payload, mirroring the quote-center
 * `/v1/quotes/update` JSON 1:1 (snake_case). The u64 integer fields are the
 * EXACT values the enclave signed over BCS — `collect_batch_latest` rebuilds
 * the payload on-chain and re-verifies, so they must round-trip byte-for-byte.
 * They are `bigint` (not `number`): {@link parseSignedEnvelope} decodes them
 * from the raw JSON integer literals so a value above `Number.MAX_SAFE_INTEGER`
 * (2^53) can never lose precision and silently abort the on-chain signature
 * check. `num_sources` is a `u8` (≤ 255) and stays a `number`.
 */
export interface WaterxBatchItem {
  symbol: string;
  ticker: string;
  sources: bigint[];
  method: string;
  price_timestamp_ms: bigint;
  price_n: bigint;
  price_scale: bigint;
  confidence_n: bigint;
  confidence_scale: bigint;
  max_source_deviation_bps: bigint;
  num_sources: number;
}

/** The enclave-signed batch envelope from `GET /v1/quotes/update`. */
export interface WaterxSignedEnvelope {
  intent: number;
  /** Enclave signing timestamp (ms) — the on-chain `timestamp_ms` argument. */
  timestamp_ms: bigint;
  payload: { items: WaterxBatchItem[] };
  /** ed25519 signature over `BCS(IntentMessage<BatchPricePayload>)`, hex (± `0x`). */
  signature: string;
}

/** `waterx_rule`'s narrowed `RuleUpdateData.payload` shape. */
export interface WaterxUpdatePayload {
  readonly envelope: WaterxSignedEnvelope;
}

/**
 * Shape check ONLY — the `kind` discriminant is checked separately by the
 * caller before this runs (mirrors the other rules' guard split), so a
 * same-shaped payload from a different rule can never silently pass.
 */
function isWaterxUpdatePayloadShape(payload: unknown): payload is WaterxUpdatePayload {
  const env = (payload as { envelope?: unknown })?.envelope as WaterxSignedEnvelope | undefined;
  return (
    typeof env === "object" &&
    env !== null &&
    typeof env.signature === "string" &&
    typeof env.timestamp_ms === "bigint" &&
    Array.isArray(env.payload?.items)
  );
}

/**
 * Parse a quote-center `/v1/quotes/update` response body into a
 * {@link WaterxSignedEnvelope} with the u64 fields decoded as `bigint`, exact.
 *
 * The signature is over `BCS(IntentMessage<BatchPricePayload>)`, so every u64
 * the SDK rebuilds in-PTB must equal the enclave's byte-for-byte or
 * `collect_batch_latest` aborts the whole trade PTB (bad signature — not an
 * abstain). A plain `JSON.parse` yields IEEE-754 doubles that lose precision
 * above 2^53, so instead we recover each integer's exact source literal via the
 * ES2023 reviver `context.source` (Node 21+ / modern browsers) and `BigInt()`
 * it. On an older runtime that passes no `context`, a value within 2^53 is
 * still exact (`BigInt(number)`); a value ABOVE it throws loudly here rather
 * than silently corrupting the payload into an on-chain abort. `num_sources`
 * (u8) and `intent` are coerced back to `number` — both are tiny.
 */
export function parseSignedEnvelope(text: string): WaterxSignedEnvelope {
  const raw = JSON.parse(
    text,
    (_key: string, value: unknown, context?: { source?: string }): unknown => {
      if (typeof value !== "number" || !Number.isInteger(value)) return value;
      if (context?.source !== undefined) return BigInt(context.source);
      if (!Number.isSafeInteger(value)) {
        throw new Error(
          "waterx envelope carries an integer above 2^53 and this runtime lacks JSON " +
            "source access — cannot preserve u64 precision for the signed payload",
        );
      }
      return BigInt(value);
    },
  ) as {
    intent?: bigint;
    timestamp_ms?: bigint;
    signature?: string;
    payload?: { items?: WaterxBatchItem[] };
  };

  if (typeof raw.signature !== "string" || !Array.isArray(raw.payload?.items)) {
    throw new Error("WaterX quote-center returned a malformed signed envelope");
  }
  return {
    intent: Number(raw.intent),
    timestamp_ms: (raw.timestamp_ms ?? 0n) as bigint,
    signature: raw.signature,
    payload: {
      items: raw.payload.items.map((i) => ({ ...i, num_sources: Number(i.num_sources) })),
    },
  };
}

/** The `waterx_rule` deployment entry; throws when the config carries none. */
function requireWaterxPackage(host: OracleHost): WaterxRulePackage {
  const entry = host.config.packages.waterx_rule;
  if (!entry) {
    throw new Error("waterx_rule package is not deployed in this config");
  }
  return entry;
}

/**
 * Resolve the quote-center infra for this host: the `waterxEndpoint` /
 * `waterxFetch` create options when the client carries them, else the network
 * default. The fetch policy falls back to the shared `pyth.fetch` policy so a
 * consumer that already tuned timeouts/retries once keeps them here.
 *
 * This is the seam a browser consumer needs: the envelope is fetched FROM THE
 * PAGE, so a front end whose origin the quote-center does not allow (CORS)
 * points `endpoint` at a same-origin proxy, or supplies its own `fetchImpl`.
 */
function resolveWaterxInfra(host: OracleHost): { endpoint: string; fetch?: FetchPolicy } {
  const infra = host.waterx ?? WATERX_DEFAULTS[host.network];
  return { endpoint: infra.endpoint, fetch: infra.fetch ?? host.pyth.fetch };
}

/**
 * Pull one enclave-signed batch envelope covering `symbols` from the
 * quote-center. Goes through the shared `fetchWithPolicy` (`../update-fetch.ts`)
 * — same retry/timeout policy as the Pyth/Lazer fetches. No auth: the
 * quote-center read surface is public.
 *
 * The URL is built with `joinEndpointPath`, not `new URL(path, endpoint)`: a
 * leading-slash path is ABSOLUTE and silently drops the endpoint's own base
 * path, which is exactly what a `waterxEndpoint` proxy route is (a
 * `https://app.example/api/quote-center` override would have been rewritten to
 * `https://app.example/v1/quotes/update`, bypassing the proxy). Same footgun
 * that 404'd every Pyth Pro feed by dropping its `/hermes` prefix.
 */
async function fetchWaterxSignedUpdate(
  endpoint: string,
  symbols: string[],
  fetchOpts?: FetchPolicy,
): Promise<WaterxSignedEnvelope> {
  const url = joinEndpointPath(endpoint, "v1/quotes/update");
  url.searchParams.set("symbols", symbols.join(","));
  let res: Response;
  try {
    res = await fetchWithPolicy(url.toString(), { method: "GET" }, { ...fetchOpts });
  } catch (err) {
    if (err instanceof FetchPolicyError && err.status !== undefined) {
      const body = err.bodySnippet ? ` ${err.bodySnippet}` : "";
      throw new Error(
        `WaterX quote-center fetch failed: ${err.status}${body} (retries exhausted after ${err.attempts} attempts)`,
        { cause: err },
      );
    }
    throw err;
  }
  if (!res.ok) {
    throw new Error(`WaterX quote-center fetch failed: ${res.status} ${await res.text()}`);
  }
  // Parse from raw text (not res.json()) so the u64 fields are decoded exact as
  // bigint — see parseSignedEnvelope. Malformed-shape check lives there.
  const envelope = parseSignedEnvelope(await res.text());
  if (envelope.intent !== BATCH_PRICE_INTENT) {
    throw new Error(
      `WaterX quote-center returned intent ${envelope.intent}, expected BATCH_PRICE_INTENT ${BATCH_PRICE_INTENT}`,
    );
  }
  return envelope;
}

/** Narrow a `RuleUpdateData` to its `WaterxSignedEnvelope`, or `null`. */
export function waterxEnvelopeOf(data: RuleUpdateData): WaterxSignedEnvelope | null {
  const payload = assertRuleUpdateData(
    data,
    "waterx_rule",
    isWaterxUpdatePayloadShape,
    "{ envelope: { intent, timestamp_ms, payload: { items }, signature } }",
  );
  return payload?.envelope ?? null;
}

/** Strip an optional `0x` prefix, then decode hex → bytes. */
function decodeSig(hex: string): Uint8Array {
  return fromHex(hex.startsWith("0x") ? hex.slice(2) : hex);
}

/**
 * `waterx_rule::collect_batch_latest(collector, config, clock, enclave_config,
 * enclave, timestamp_ms, payload, sig)` — rebuild the enclave-signed batch
 * payload in-PTB (`new_batch_payload` + one `new_batch_item`/`push_batch_item`
 * per item, the exact shape the enclave signed) and contribute the price for
 * `collector.symbol()` to the collector. One collect call re-verifies the batch
 * signature and picks this collector's symbol out of the batch; on-chain it
 * abstains (records `none`) instead of aborting when the symbol is stale,
 * absent from the batch, or its timestamp was already accepted (replay).
 */
export function feedWaterxRule(
  tx: Transaction,
  host: OracleHost,
  collector: TransactionArgument,
  envelope: WaterxSignedEnvelope,
): void {
  const wr = requireWaterxPackage(host);
  const pkg = wr.published_at;

  const payload = newBatchPayload({ package: pkg })(tx);
  for (const item of envelope.payload.items) {
    // u64 fields are already exact bigints (see parseSignedEnvelope) — passed
    // through verbatim so the rebuilt BCS matches the enclave's signed bytes.
    const itemArg = newBatchItem({
      package: pkg,
      arguments: {
        symbol: item.symbol,
        ticker: item.ticker,
        sources: item.sources,
        method: item.method,
        priceTimestampMs: item.price_timestamp_ms,
        priceN: item.price_n,
        priceScale: item.price_scale,
        confidenceN: item.confidence_n,
        confidenceScale: item.confidence_scale,
        maxSourceDeviationBps: item.max_source_deviation_bps,
        numSources: item.num_sources,
      },
    })(tx);
    pushBatchItem({ package: pkg, arguments: { payload, item: itemArg } })(tx);
  }

  collectBatchLatest({
    package: pkg,
    arguments: {
      collector,
      config: tx.object(wr.config),
      enclaveConfig: tx.object(wr.enclave_config),
      enclave: tx.object(wr.enclave),
      timestampMs: envelope.timestamp_ms,
      payload,
      sig: Array.from(decodeSig(envelope.signature)),
    },
  })(tx);
}

export const WaterxRule: PriceUpdateRule = {
  kind: "waterx_rule",

  // Verification is an in-Move ed25519 check with no Coin argument — no
  // update fee — see `PriceUpdateRule.requiresFeeSource`.
  requiresFeeSource: false,

  /** Tickers with a `waterx_rule.feeds` entry (keyed by oracle ticker). */
  supportedTickers(host: OracleHost): string[] {
    return Object.keys(host.config.packages.waterx_rule?.feeds ?? {});
  },

  /** Pulls one enclave-signed batch envelope covering `tickers` from the quote-center. */
  async fetchUpdateData(host: OracleHost, tickers: string[]): Promise<RuleUpdateData> {
    if (tickers.length === 0) return null;
    // Package-level check first: a config without the deployment must say so,
    // not fail per ticker as if only that feed were missing.
    const { feeds } = requireWaterxPackage(host);
    for (const ticker of tickers) {
      if (feeds[ticker] === undefined) {
        throw new Error(`No waterx_rule feed listed for ticker: ${ticker}`);
      }
    }
    const { endpoint, fetch: fetchOpts } = resolveWaterxInfra(host);
    const envelope = await fetchWaterxSignedUpdate(endpoint, tickers, fetchOpts);
    return { kind: "waterx_rule", payload: { envelope } };
  },

  /**
   * One signed batch envelope carries a single ed25519 signature over its whole
   * `payload` — it is indivisible: it can only be served whole (re-verified from
   * the full item set). Returns the whole payload iff every requested ticker's
   * item is present in THIS envelope; any coverage gap → `null` (miss), never a
   * silent partial.
   */
  narrowUpdateData(_host: OracleHost, data: RuleUpdateData, tickers: string[]): RuleUpdateData {
    const envelope = waterxEnvelopeOf(data);
    if (!envelope || tickers.length === 0) return null;
    const covered = new Set(envelope.payload.items.map((i) => i.symbol));
    for (const ticker of tickers) {
      if (!covered.has(ticker)) return null;
    }
    return { kind: "waterx_rule", payload: { envelope } };
  },

  /**
   * No shared verify step: `waterx_rule::collect_batch_latest` bundles verify
   * AND feed into one per-collector call, appended by {@link feedWaterxRule} in
   * the per-ticker aggregate leg. So this emits nothing and returns `void` — the
   * signed envelope reaches the feed leg via `aggregate.ts`'s per-ticker map
   * (built from the group's fetched data), not a `RuleUpdateHandle`.
   */
  buildUpdateCalls(
    _tx: Transaction,
    _host: OracleHost,
    _data: RuleUpdateData,
    _opts?: BuildUpdateOpts,
  ): void {
    return;
  },
};

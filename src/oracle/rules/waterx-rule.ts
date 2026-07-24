/**
 * `WaterxRule` — `PriceUpdateRule` for the first-party WaterX quote-center
 * (Nautilus-TEE, ed25519), plus `feedWaterxRule`, the collector-feed leg
 * `aggregateTicker` appends per waterx-routed ticker. Pulls one enclave-signed
 * batch envelope covering every requested ticker from the quote-center
 * (`GET /v1/quotes/update?symbols=…`, endpoint from `WATERX_DEFAULTS`), then —
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
import { FetchPolicyError, fetchWithPolicy } from "../update-fetch.ts";

/** The single signing intent (`BATCH_PRICE_INTENT`) the quote-center emits. */
const BATCH_PRICE_INTENT = 1;

/**
 * One item inside a signed batch payload, mirroring the quote-center
 * `/v1/quotes/update` JSON 1:1 (snake_case). Integer fields are the exact
 * values the enclave signed over BCS — `collect_batch_latest` rebuilds the
 * payload on-chain and re-verifies, so they must round-trip byte-for-byte.
 * Realistic prices at 1e9 scale stay well under `Number.MAX_SAFE_INTEGER`
 * (2^53), so `JSON.parse` preserves them exactly.
 */
export interface WaterxBatchItem {
  symbol: string;
  ticker: string;
  sources: number[];
  method: string;
  price_timestamp_ms: number;
  price_n: number;
  price_scale: number;
  confidence_n: number;
  confidence_scale: number;
  max_source_deviation_bps: number;
  num_sources: number;
}

/** The enclave-signed batch envelope from `GET /v1/quotes/update`. */
export interface WaterxSignedEnvelope {
  intent: number;
  timestamp_ms: number;
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
    typeof env.timestamp_ms === "number" &&
    Array.isArray(env.payload?.items)
  );
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
 * Pull one enclave-signed batch envelope covering `symbols` from the
 * quote-center. Goes through the shared `fetchWithPolicy` (`../update-fetch.ts`)
 * — same retry/timeout policy as the Pyth/Lazer fetches. No auth: the
 * quote-center read surface is public.
 */
async function fetchWaterxSignedUpdate(
  endpoint: string,
  symbols: string[],
  fetchOpts?: { timeoutMs?: number; retries?: number },
): Promise<WaterxSignedEnvelope> {
  const url = new URL("/v1/quotes/update", endpoint);
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
  const envelope = (await res.json()) as WaterxSignedEnvelope;
  if (envelope?.intent !== BATCH_PRICE_INTENT) {
    throw new Error(
      `WaterX quote-center returned intent ${envelope?.intent}, expected BATCH_PRICE_INTENT ${BATCH_PRICE_INTENT}`,
    );
  }
  if (typeof envelope.signature !== "string" || !Array.isArray(envelope.payload?.items)) {
    throw new Error("WaterX quote-center returned a malformed signed envelope");
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
    const itemArg = newBatchItem({
      package: pkg,
      arguments: {
        symbol: item.symbol,
        ticker: item.ticker,
        sources: item.sources.map((s) => BigInt(s)),
        method: item.method,
        priceTimestampMs: BigInt(item.price_timestamp_ms),
        priceN: BigInt(item.price_n),
        priceScale: BigInt(item.price_scale),
        confidenceN: BigInt(item.confidence_n),
        confidenceScale: BigInt(item.confidence_scale),
        maxSourceDeviationBps: BigInt(item.max_source_deviation_bps),
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
      timestampMs: BigInt(envelope.timestamp_ms),
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
    const envelope = await fetchWaterxSignedUpdate(
      WATERX_DEFAULTS[host.network].endpoint,
      tickers,
      host.pyth.fetch,
    );
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

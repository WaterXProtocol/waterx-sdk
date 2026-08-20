/**
 * `read-prices.ts` — the READ-plane executors for the two live sources: parsed
 * (display-grade) prices from the Lazer HTTP API and the WaterX quote-center.
 * The sibling `read-plane.ts` resolves WHICH tickers a source can price and
 * with which ids; these functions execute that plan. Consumers (FE/BE price
 * facades) fold onto these instead of hand-rolling per-source fetch + decode —
 * the price DECODING here is the one place each source's wire scaling is
 * interpreted (the retired hermes decode was deleted, not re-homed).
 *
 * Both executors return a Map keyed the way the plan is keyed (integer Lazer
 * feed id / ticker) of {@link OraclePriceEntry} — plain numbers, for display
 * and freshness policy, NEVER for rebuilding signed payloads (tx-builds carry
 * the exact signed bytes through `refreshOraclePrices`).
 */

import type { Network } from "../constants.ts";
import type { PythFetchPolicy } from "./config.ts";
import { LAZER_INFRA, postLazerLatestPrice } from "./rules/pyth-lazer-rule.ts";
import { pullWaterxQuotes } from "./rules/waterx-rule.ts";
import type { FetchPolicy } from "./update-fetch.ts";

/**
 * One decoded read-plane price. `price` / `conf` are display-grade floats in
 * quote units (USD); `publishTimeMs` is the feed's own publish timestamp in
 * ms — the input to freshness policy (`isFreshWaterxEntry`, consumers'
 * max-age gates).
 */
export type OraclePriceEntry = { price: number; publishTimeMs: number; conf: number };

/**
 * Thrown by {@link readLazerPrices} on a Lazer `403` — the key's grant does
 * not cover one of the requested feeds (Lazer rejects the WHOLE batch). The
 * message carries the endpoint's own PLAIN-TEXT body verbatim (e.g.
 * `Not entitled: feed 327 (no grant accepts this feed (asset type 'fx',
 * instrument type 'spot'))`) — it names the offending feed and grant reason
 * better than anything the SDK could synthesize. `instanceof`-able so a
 * consumer can drop unentitled feeds and retry rather than string-matching.
 */
export class LazerNotEntitledError extends Error {
  /** The integer Lazer feed ids the rejected request asked for. */
  readonly feedIds: number[];

  constructor(body: string, feedIds: number[]) {
    super(`Lazer price read not entitled: ${body}`);
    this.name = "LazerNotEntitledError";
    this.feedIds = [...feedIds];
  }
}

/**
 * The parsed-read request pins, mirroring the live-probed Lazer contract:
 * `formats: []` is REQUIRED — an ABSENT `formats` is rejected while an empty
 * array means "parsed only, no signed blob", which is exactly what a read
 * plane wants (no signature bytes to pay bandwidth for). `properties` pins
 * the fields the decoder below consumes; `marketSession` rides along for
 * consumers that surface venue state.
 */
const LAZER_PARSED_READ_REQUEST = {
  properties: ["price", "exponent", "confidence", "feedUpdateTimestamp", "marketSession"],
  formats: [],
  parsed: true,
} as const;

interface LazerParsedFeed {
  priceFeedId?: number;
  /** Decimal string (e.g. `"6427983315951"`). */
  price?: string;
  exponent?: number;
  /** Plain number on the wire (unlike `price`). */
  confidence?: number;
  /** Microseconds since epoch, per feed. Absent while a feed has no update. */
  feedUpdateTimestamp?: number;
}

/**
 * Read parsed prices for `feedIds` (integer Lazer ids — the `"lazer"` arm of
 * `resolveOracleReadPlan`) via `POST /v1/latest_price`.
 *
 * - `network` is REQUIRED: it selects the Lazer endpoint AND the channel, and
 *   the integer feed ids in a plan are network-specific, so defaulting it
 *   would silently read mainnet infra with testnet ids. Every caller already
 *   holds one (`resolveOracleReadPlan` takes the same host).
 * - `channel` defaults to `LAZER_INFRA[network].channel` (the same channel
 *   the write leg uses — bounded by the feeds' `min_channel` AND the key's
 *   grant). A `400` naming an unsupported/rate-limited channel propagates as
 *   a plain error with the body attached — that is an operator
 *   misconfiguration, not a retry case.
 * - Decoding: `price = Number(price) * 10 ** exponent` (the wire `price` is a
 *   decimal STRING), `conf = Number(confidence) * 10 ** exponent`,
 *   `publishTimeMs = feedUpdateTimestamp / 1000` (the wire value is µs). An
 *   entry with NO `feedUpdateTimestamp` is SKIPPED — never timestamped off
 *   the response's batch `timestampUs`, which says when Lazer answered, not
 *   when that feed last printed (a closed-market feed would masquerade as
 *   fresh).
 * - `403` → {@link LazerNotEntitledError} (whole batch rejected; body text
 *   verbatim).
 */
export async function readLazerPrices(opts: {
  apiKey: string;
  feedIds: number[];
  network: Network;
  channel?: string;
  fetch?: PythFetchPolicy;
}): Promise<Map<number, OraclePriceEntry>> {
  const out = new Map<number, OraclePriceEntry>();
  if (opts.feedIds.length === 0) return out;
  const infra = LAZER_INFRA[opts.network];
  // Same POST transport the rule's write leg uses (URL join, method, headers,
  // Bearer + retry policy) — only the request pins and the decoding below are
  // read-specific.
  const res = await postLazerLatestPrice(
    infra.endpoint,
    opts.channel ?? infra.channel,
    opts.apiKey,
    opts.feedIds,
    LAZER_PARSED_READ_REQUEST,
    opts.fetch,
  );
  if (res.status === 403) {
    // Plain-text body naming the unentitled feed + grant reason — verbatim.
    throw new LazerNotEntitledError((await res.text()).trim(), opts.feedIds);
  }
  if (!res.ok) {
    // Includes the 400 channel rejections ("Feeds do not support channel …" /
    // rate-limit minimum-channel) — deterministic misconfigurations that must
    // reach the operator with the endpoint's own wording.
    throw new Error(`Lazer price read failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { parsed?: { priceFeeds?: LazerParsedFeed[] } };
  for (const feed of json.parsed?.priceFeeds ?? []) {
    if (
      typeof feed.priceFeedId !== "number" ||
      feed.price === undefined ||
      typeof feed.exponent !== "number" ||
      // No per-feed timestamp ⇒ no honest freshness claim ⇒ skip (see doc).
      typeof feed.feedUpdateTimestamp !== "number"
    ) {
      continue;
    }
    const scale = 10 ** feed.exponent;
    out.set(feed.priceFeedId, {
      price: Number(feed.price) * scale,
      conf: typeof feed.confidence === "number" ? feed.confidence * scale : 0,
      publishTimeMs: feed.feedUpdateTimestamp / 1000,
    });
  }
  return out;
}

/**
 * Read prices for `symbols` (oracle tickers — the `"quote_center"` arm of
 * `resolveOracleReadPlan`) through {@link pullWaterxQuotes}, the rule-owned
 * route ladder the write path uses: per-symbol Merkle leaves by default, the
 * batch envelope only against a quote-center with no leaf route. Public read,
 * no auth, same retry/timeout policy as every oracle fetch.
 *
 * Going through the shared ladder is what keeps the read plane from drifting
 * off the write plane, and it is why reads do not pull a whole-registry
 * envelope: that is one signature over every symbol, so a plane polling a
 * handful of them would transfer and bigint-revive the lot on every tick.
 *
 * Decoding per item: `price = Number(price_n) / Number(price_scale)` and
 * `conf = Number(confidence_n) / Number(confidence_scale)`, each `0` when its
 * scale is `0` (a zero divisor is "no value", not `Infinity`);
 * `publishTimeMs = Number(price_timestamp_ms)`. Reads share the write path's
 * fetch — a mispointed endpoint fails the same intent/shape checks tx-builds
 * fail — but this NEVER hands its signed data to a tx-build: the on-chain
 * per-symbol replay guard (F-014) burns one submission per signed timestamp,
 * and reads must not race trades for it.
 */
export async function readQuoteCenterPrices(opts: {
  endpoint: string;
  symbols: string[];
  fetch?: FetchPolicy;
}): Promise<Map<string, OraclePriceEntry>> {
  const out = new Map<string, OraclePriceEntry>();
  if (opts.symbols.length === 0) return out;

  const { items } = await pullWaterxQuotes(opts.endpoint, opts.symbols, opts.fetch);

  const requested = new Set(opts.symbols);
  for (const item of items) {
    if (!requested.has(item.symbol)) continue;
    out.set(item.symbol, {
      price: item.price_scale === 0n ? 0 : Number(item.price_n) / Number(item.price_scale),
      conf:
        item.confidence_scale === 0n
          ? 0
          : Number(item.confidence_n) / Number(item.confidence_scale),
      publishTimeMs: Number(item.price_timestamp_ms),
    });
  }
  return out;
}

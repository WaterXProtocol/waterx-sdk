/**
 * Pyth as a price *source*: Hermes REST + the on-chain Pyth update PTB.
 *
 * This file knows nothing about oracle *rules* (pyth_rule / supra_rule /
 * constant_rule / sponsor) — it only fetches price update VAAs from Hermes and
 * appends the Pyth on-chain update block, returning the refreshed
 * `PriceInfoObject` IDs. Feeding rules into a collector and aggregating lives in
 * `aggregate.ts`; the rule wrappers live in `rules/`.
 *
 * On-chain a single PTB:
 *   1. wormhole::vaa::parse_and_verify
 *   2. pyth::create_authenticated_price_infos_using_accumulator
 *   3. pyth::update_single_price_feed (one per feed)
 *   4. hot_potato_vector::destroy
 */

import { fromHex, toHex } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { Network } from "../constants.ts";
import type { PythFetchPolicy } from "./config.ts";
import type { OracleHost } from "./host.ts";
import {
  fetchWithPolicy,
  joinEndpointPath,
  rethrowExhaustedFetch,
  trimTrailingSlashes,
} from "./update-fetch.ts";

// ============================================================================
// Core external infra — owned by THIS source, by network
// ============================================================================

/**
 * Everything the Core source needs that is not in the canonical
 * `waterx-config` JSON lives HERE, in the source that consumes it —
 * `client.pyth` carries only the caller's credential/fetch policy
 * (see `PythAccessConfig`). No other oracle source reads this table:
 * selecting `pyth_lazer_rule` (or any future source) must never touch a Core
 * endpoint or Core state object, so nothing Core-shaped stays on the shared
 * client to leak across sources.
 *
 * - `state_id` / `wormhole_state_id` — the Core Pyth + Wormhole state objects
 *   the on-chain update PTB reads (below).
 * - `hermes_endpoint` — the Core Hermes REST base for
 *   `fetchPriceFeedsUpdateData`. Keyless today; auth-first after the Pyth Pro
 *   migration (post-2026-08-18) via `client.pyth.api_key`.
 */
export interface PythCoreInfra {
  state_id: string;
  wormhole_state_id: string;
  hermes_endpoint: string;
}

export const PYTH_CORE_INFRA: Record<Network, PythCoreInfra> = {
  MAINNET: {
    state_id: "0x1f9310238ee9298fb703c3419030b35b22bb1cc37113e3bb5007c99aec79e5b8",
    wormhole_state_id: "0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c",
    hermes_endpoint: "https://hermes.pyth.network",
  },
  TESTNET: {
    state_id: "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
    wormhole_state_id: "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
    hermes_endpoint: "https://hermes-beta.pyth.network",
  },
};

/**
 * The Core source's Hermes REST base for `network` — the ONE accessor
 * consumers (BE/FE read planes) use when, and only when, their own
 * `ORACLE_SOURCE` env resolves to `'pyth_rule'`. Under any other source the
 * read endpoint is that source's own configuration — never this one.
 */
export function pythCoreHermesEndpoint(network: Network): string {
  return PYTH_CORE_INFRA[network].hermes_endpoint;
}

// ============================================================================
// Cache — share across builders to avoid redundant Pyth state reads
// ============================================================================

type PriceTableInfo = { id: string; fieldType: string };
type PythStateInfo = { packageId: string; baseUpdateFee: bigint };

export class PythCache {
  pythStateInfo?: PythStateInfo;
  wormholePackageId?: string;
  priceTableInfo?: PriceTableInfo;
  priceFeedObjectIdCache = new Map<string, string | undefined>();
}

// ============================================================================
// Hermes REST
// ============================================================================

type FetchOpts = { apiKey?: string; fetch?: PythFetchPolicy };

/**
 * How long a "this endpoint lacks feed X" verdict stays memoized. The verdict
 * is a claim about *someone else's* deployment — a feed can be added to the
 * catalog, an entitlement can be granted, a Pro plan can be upgraded — so it
 * must expire rather than bind the whole process lifetime. Long enough that a
 * genuinely-absent feed costs one discovery per window instead of one per
 * build; short enough that a recovered endpoint self-heals without a restart.
 */
export const MISSING_FEED_MEMO_TTL_MS = 15 * 60_000;

/**
 * Per-endpoint memo of feed ids this endpoint has rejected as unknown (a 404
 * on `/v2/updates/price/latest`). The Pyth Pro compat endpoint carries a
 * SUBSET of Core's feeds — mainnet `WTIUSD`/`BRENTUSD` (Commodities
 * USOILSPOT/UKOILSPOT) are absent, for example. Pyth 404s the WHOLE batch if
 * ANY id is unknown, and the body naming the bad ids is NOT reliably delivered
 * to `fetch` (Cloudflare returns it to curl but `content-length: 0` to node's
 * undici), so the ids are isolated by catalog read (or bisection) and
 * remembered here — later batches skip them instead of 404ing every time.
 *
 * Entries carry an expiry ({@link MISSING_FEED_MEMO_TTL_MS}); an
 * endpoint-level fault never lands here at all (see {@link
 * HermesEndpointRejectedAllFeedsError}).
 */
const missingFeedIdsByEndpoint = new Map<string, Map<string, number>>();

/**
 * Thrown when discovery concludes that an endpoint rejects EVERY requested
 * feed id without a catalog vouching for that verdict. `instanceof`-able
 * (mirrors `FetchPolicyError` / {@link OracleFeeSourceUnavailableError}).
 *
 * "All of them are missing" is the signature of an endpoint/credential fault —
 * a wrong base path (the Pyth Pro `/hermes` prefix dropped), a changed route,
 * a revoked or downgraded entitlement — not of N individually-absent feeds.
 * Memoizing it would convert a loud, fixable misconfiguration into a silent
 * permanent one: every id marked missing ⇒ `fetchPriceFeedsUpdateData` returns
 * `[]` ⇒ `buildPythPriceUpdateCalls` throws "Hermes returned empty results",
 * blaming Hermes for having no data, for the rest of the process's life. So
 * this case writes NOTHING to the memo and throws instead; the next call
 * re-probes and recovers on its own once the endpoint does.
 *
 * The message keeps the `Hermes price fetch failed: <status>` prefix on its
 * first line — the documented contract downstream consumers string-match (see
 * {@link fetchPriceFeedsUpdateData} and the e2e transient detector).
 */
export class HermesEndpointRejectedAllFeedsError extends Error {
  constructor(
    readonly endpoint: string,
    readonly requestedCount: number,
    catalogState: "unreadable" | "empty",
  ) {
    super(
      `Hermes price fetch failed: 404 — endpoint rejected ALL ${requestedCount} requested feed id(s) ` +
        `and its feed catalog was ${catalogState}, so nothing vouches for those feeds being ` +
        `individually absent. Treating this as an endpoint/credential fault (wrong base path — ` +
        `e.g. a dropped Pyth Pro '/hermes' prefix — changed route, or revoked entitlement) rather ` +
        `than caching every feed as missing. Endpoint: ${endpoint}`,
    );
    this.name = "HermesEndpointRejectedAllFeedsError";
  }
}

/**
 * Memo key for `(endpoint, credential)` — the same trailing-slash trim
 * {@link joinEndpointPath} applies to the request URL (shared helper, so the
 * two can't drift), plus the apiKey: "feed X is missing" is a property of the
 * endpoint AND the credential (Pyth Pro entitlements are per-key), so two
 * clients in one process with different keys must not cross-poison each
 * other's memo. Without the trim, two consumers spelling the same endpoint
 * differently (`…/hermes` vs `…/hermes/`) would fragment the memo and re-run
 * the whole 404 discovery despite one of them having already paid for it.
 */
function memoKey(endpoint: string, apiKey: string | undefined): string {
  return `${trimTrailingSlashes(endpoint)}\u0000${apiKey ?? ""}`;
}

function recordMissingFeeds(
  endpoint: string,
  feedIds: Iterable<string>,
  apiKey: string | undefined,
): void {
  const key = memoKey(endpoint, apiKey);
  let entries = missingFeedIdsByEndpoint.get(key);
  if (!entries) {
    entries = new Map<string, number>();
    missingFeedIdsByEndpoint.set(key, entries);
  }
  const expiresAt = Date.now() + MISSING_FEED_MEMO_TTL_MS;
  // Key on the bare (0x-stripped, lowercased) form — the SAME normalization the
  // catalog comparison and the in-flight latch use — so a feed can't fragment
  // the memo across `0xAB`/`ab` spellings and slip back through as unfiltered.
  for (const feedId of feedIds) entries.set(bareFeedId(feedId), expiresAt);
}

/**
 * The subset of `feedIds` this `endpoint` is known to serve — i.e. minus any
 * discovered to be absent within the last {@link MISSING_FEED_MEMO_TTL_MS}
 * (see {@link fetchPriceFeedsUpdateData}). Callers building a
 * `{ updates, feedIds }` payload use this to keep `feedIds` aligned with the
 * feeds the fetch actually returned data for, so `buildPythPriceUpdateCalls`
 * (one moveCall per feed id) never references a feed the accumulator blob
 * doesn't cover.
 *
 * Expired entries are pruned here rather than on a timer: the memo is only
 * ever consulted through this function, so a lazy sweep is both sufficient and
 * free of a dangling interval in a library.
 */
export function endpointSupportedFeedIds(
  endpoint: string,
  feedIds: string[],
  apiKey?: string,
): string[] {
  const key = memoKey(endpoint, apiKey);
  const entries = missingFeedIdsByEndpoint.get(key);
  if (!entries) return feedIds;

  const now = Date.now();
  for (const [id, expiresAt] of entries) {
    if (expiresAt <= now) entries.delete(id);
  }
  if (entries.size === 0) {
    missingFeedIdsByEndpoint.delete(key);
    return feedIds;
  }
  return feedIds.filter((id) => !entries.has(bareFeedId(id)));
}

/**
 * Discovery runs currently in flight, keyed by `(endpoint, credential,
 * requested id set)`. A cold memo plus two concurrent tx-builds asking the
 * same question ran two full independent discoveries — duplicate catalog reads
 * (or duplicate bisection probe trees) on the money path, for one answer. The
 * second caller now joins the first run's promise: each still gets its own
 * survivor data, but they share the one discovery behind it.
 */
const inFlightDiscoveries = new Map<string, Promise<void>>();

/** Test-only: forget everything learned about which feeds an endpoint lacks. */
export function __resetMissingFeedCacheForTest(): void {
  missingFeedIdsByEndpoint.clear();
  inFlightDiscoveries.clear();
}

/**
 * One `GET /v2/price_feeds` — the set of feed ids this endpoint serves for
 * THIS credential (verified against the Pro compat endpoint: WTI absent from
 * the catalog AND 404 on latest-price; BTC present AND 200 —
 * entitlement-filtered per key), normalized to bare lowercase hex.
 *
 * Returns `null` when the catalog is unreadable (non-2xx, unparseable, network
 * error) — the catalog is an optimization, {@link bisectMissingFeeds} remains
 * the ground truth derived from the money-path fetch itself. Note that "read
 * fine, served nothing" (`size === 0`) is NOT the same as unreadable: an empty
 * catalog is an entitlement/route fault in its own right, and the caller
 * treats it as one.
 */
async function readEndpointCatalog(
  endpoint: string,
  opts?: FetchOpts,
): Promise<Set<string> | null> {
  try {
    const res = await fetchWithPolicy(
      joinEndpointPath(endpoint, "v2/price_feeds").toString(),
      {},
      { apiKey: opts?.apiKey, ...opts?.fetch },
    );
    if (!res.ok) {
      void res.body?.cancel().catch(() => {});
      return null;
    }
    const catalog = (await res.json()) as { id: string }[];
    if (!Array.isArray(catalog)) return null;
    // Catalog ids come WITHOUT the 0x prefix; callers pass either form.
    return new Set(catalog.map((f) => bareFeedId(f.id)));
  } catch {
    return null;
  }
}

/** Feed ids are compared prefix- and case-insensitively (`0xAB` ≡ `ab`). */
function bareFeedId(feedId: string): string {
  return feedId.toLowerCase().replace(/^0x/, "");
}

async function rawFetch(endpoint: string, ids: string[], opts?: FetchOpts): Promise<Response> {
  // joinEndpointPath preserves the endpoint's own base path — `new URL`
  // with a leading-slash path would discard it (the Pyth Pro `/hermes`
  // prefix → 404 on EVERY feed); see its doc in update-fetch.ts.
  const url = joinEndpointPath(endpoint, "v2/updates/price/latest");
  ids.forEach((id) => url.searchParams.append("ids[]", id));
  return fetchWithPolicy(url.toString(), {}, { apiKey: opts?.apiKey, ...opts?.fetch });
}

/**
 * Bisect `ids` down to the individual ones this endpoint 404s on — the
 * response body isn't readable, so a single id that still 404s IS the unknown
 * one. Data is discarded; this only *reports* (the caller decides whether the
 * verdict is trustworthy enough to memoize). A non-404 (the subset is fine) or
 * a network error stops that branch and contributes nothing.
 *
 * `known404: true` skips the root probe — the caller has already watched this
 * exact batch 404, so re-fetching it would only re-learn a fact in hand (a
 * wasted round trip on the money path during cold discovery). Recursive
 * half-calls always probe: their status is genuinely unknown.
 */
async function bisectMissingFeeds(
  endpoint: string,
  ids: string[],
  opts?: FetchOpts,
  known404 = false,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  if (!known404) {
    let res: Response;
    try {
      res = await rawFetch(endpoint, ids, opts);
    } catch {
      return new Set(); // transient/network failure — can't classify
    }
    void res.body?.cancel().catch(() => {});
    if (res.status !== 404) return new Set(); // this subset is serveable
  }
  if (ids.length === 1) return new Set([ids[0]!]);
  const mid = Math.floor(ids.length / 2);
  const [lo, hi] = await Promise.all([
    bisectMissingFeeds(endpoint, ids.slice(0, mid), opts),
    bisectMissingFeeds(endpoint, ids.slice(mid), opts),
  ]);
  return new Set([...lo, ...hi]);
}

/**
 * Work out which of `ids` this endpoint lacks and memoize exactly those.
 *
 * Catalog first: one `GET /v2/price_feeds` answers for the whole batch, so a
 * confirmed 404 costs one extra request instead of O(log n) bisection probes.
 * The catalog is also the only *authoritative* source here — it says what the
 * endpoint DOES serve, which is what separates "these two feeds are absent"
 * from "this endpoint is serving nothing to me". Bisection can only observe
 * 404s, and a wrong base path 404s identically to an unknown feed.
 *
 * Hence the guard: a verdict of "every requested id is missing" is only
 * committed when a non-empty catalog vouches for it. Otherwise nothing is
 * written and {@link HermesEndpointRejectedAllFeedsError} is thrown — see its
 * docblock for why silently memoizing that case is worse than failing.
 *
 * Concurrent callers asking the identical question share ONE run (see {@link
 * inFlightDiscoveries}); the latch is released on failure too, so a blip never
 * pins later callers to a stale outcome.
 *
 * @throws HermesEndpointRejectedAllFeedsError on an endpoint-level rejection.
 */
function discoverMissingFeeds(
  endpoint: string,
  ids: string[],
  opts?: FetchOpts,
  known404 = false,
): Promise<void> {
  // Same endpoint + credential + requested set ⇒ same answer; anything else
  // is a different question and runs on its own.
  const key = `${memoKey(endpoint, opts?.apiKey)} ${ids.map(bareFeedId).sort().join(",")}`;
  const inFlight = inFlightDiscoveries.get(key);
  if (inFlight) return inFlight;

  const run = runDiscovery(endpoint, ids, opts, known404).finally(() => {
    inFlightDiscoveries.delete(key);
  });
  inFlightDiscoveries.set(key, run);
  return run;
}

async function runDiscovery(
  endpoint: string,
  ids: string[],
  opts?: FetchOpts,
  known404 = false,
): Promise<void> {
  if (ids.length === 0) return;
  if (!known404) {
    let res: Response;
    try {
      res = await rawFetch(endpoint, ids, opts);
    } catch {
      return; // transient/network failure — can't classify; leave the memo untouched
    }
    void res.body?.cancel().catch(() => {});
    if (res.status !== 404) return; // this batch is serveable — nothing to record
  }

  const catalog = await readEndpointCatalog(endpoint, opts);
  if (catalog !== null && catalog.size === 0) {
    // Read fine, serves nothing: an entitlement/route fault, not N absent feeds.
    throw new HermesEndpointRejectedAllFeedsError(endpoint, ids.length, "empty");
  }

  const missing =
    catalog !== null
      ? new Set(ids.filter((id) => !catalog.has(bareFeedId(id))))
      : await bisectMissingFeeds(endpoint, ids, opts, true);

  if (missing.size === 0) return;
  if (catalog === null && missing.size === ids.length) {
    throw new HermesEndpointRejectedAllFeedsError(endpoint, ids.length, "unreadable");
  }
  recordMissingFeeds(endpoint, missing, opts?.apiKey);
}

/**
 * Discovery-only entry for consumers that fetch Hermes THEMSELVES (e.g. a
 * parsed latest-price reader) and just observed a whole-batch 404: resolves
 * which ids the endpoint lacks, memoizes them (see {@link
 * endpointSupportedFeedIds}), fetches NO survivor data. Without this, such a
 * consumer's only way to populate the memo was calling {@link
 * fetchPriceFeedsUpdateData} and discarding its accumulator blob — two full
 * redundant transfers per cold discovery.
 *
 * @throws HermesEndpointRejectedAllFeedsError when the rejection looks
 * endpoint-wide rather than per-feed — the caller's own 404 is then a
 * misconfiguration to surface, not a set of feeds to quietly drop.
 */
export function probeMissingFeeds(
  endpoint: string,
  ids: string[],
  opts?: FetchOpts,
): Promise<void> {
  return discoverMissingFeeds(endpoint, ids, opts, true);
}

export async function fetchPriceFeedsUpdateData(
  endpoint: string,
  priceIds: string[],
  opts?: FetchOpts,
): Promise<Uint8Array[]> {
  // Skip feeds this endpoint has already told us it doesn't have.
  const ids = endpointSupportedFeedIds(endpoint, priceIds, opts?.apiKey);
  if (ids.length === 0) return [];

  let res: Response;
  try {
    res = await rawFetch(endpoint, ids, opts);
  } catch (err) {
    rethrowExhaustedFetch(
      err,
      (e) => `Hermes price fetch failed: ${e.status}${e.bodySnippet ? ` ${e.bodySnippet}` : ""}`,
    );
  }

  if (!res.ok) {
    // Drain the body ONCE, here. A `Response` body can only be read once, and
    // the 404 branch below finishes with it before the throw is reached — so
    // reading it inside the throw surfaced `TypeError: Body is unusable`
    // instead of this function's documented message whenever a 404 fell
    // through. Reading up front also releases the connection on every path.
    const body = await res.text().catch(() => "");

    // Pyth 404s the ENTIRE batch if ANY id is unknown to the endpoint (a Core
    // feed absent from the Pyth Pro compat endpoint). This is on the money
    // path of every order/position/WLP tx-build, so instead of failing the
    // whole refresh: discover the unknown ids (catalog, else bisection — the
    // body isn't reliably delivered), memoize them, and re-fetch the survivors
    // as ONE clean batch (a single combined accumulator blob, which
    // buildPythPriceUpdateCalls requires). A genuinely-absent ticker just
    // isn't in the payload — its on-chain aggregate abstains/aborts, which is
    // correct. Steady state: once discovered, survivors are filtered up front
    // and this never runs. A rejection that looks endpoint-wide instead of
    // per-feed throws out of here (HermesEndpointRejectedAllFeedsError).
    if (res.status === 404) {
      // known404: this exact batch just 404'd above — skip the root re-probe.
      await discoverMissingFeeds(endpoint, ids, opts, true);
      const survivors = endpointSupportedFeedIds(endpoint, ids, opts?.apiKey);
      if (survivors.length === 0) return [];
      // survivors < ids ⇒ we removed the offender(s); re-fetch cleanly. Equal
      // ⇒ nothing was recorded (a 404 that wasn't a missing-feed rejection) —
      // surface it rather than loop.
      if (survivors.length < ids.length) {
        return fetchPriceFeedsUpdateData(endpoint, survivors, opts);
      }
    }
    throw new Error(`Hermes price fetch failed: ${res.status}${body ? ` ${body}` : ""}`);
  }

  const json = (await res.json()) as { binary?: { data?: string[] } };
  const data = json.binary?.data;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Hermes returned no binary price data");
  }
  return data.map((hex) => fromHex(hex));
}

// ============================================================================
// On-chain helpers (cached)
// ============================================================================

function pkgFromUpgradeCap(json: Record<string, unknown>, objectId: string): string {
  const upgradeCap =
    (json.upgrade_cap as Record<string, unknown> | undefined) ??
    ((json.fields as Record<string, unknown> | undefined)?.upgrade_cap as
      | Record<string, unknown>
      | undefined);
  const nested = (upgradeCap?.fields as Record<string, unknown> | undefined)?.package;
  const pkg =
    typeof upgradeCap?.package === "string"
      ? upgradeCap.package
      : typeof nested === "string"
        ? nested
        : undefined;
  if (!pkg) throw new Error(`Cannot resolve package id for object ${objectId}`);
  return pkg;
}

async function getPythStateInfo(
  client: SuiGrpcClient,
  pythStateId: string,
  cache?: PythCache,
): Promise<PythStateInfo> {
  if (cache?.pythStateInfo) return cache.pythStateInfo;
  const result = await client.getObject({ objectId: pythStateId, include: { json: true } });
  const json = result.object?.json as Record<string, unknown> | null | undefined;
  if (!json) throw new Error("Unable to fetch pyth state");
  const packageId = pkgFromUpgradeCap(json, pythStateId);
  const fields = json.fields as Record<string, unknown> | undefined;
  const fee = (fields?.base_update_fee ?? json.base_update_fee) as string | undefined;
  if (fee === undefined) throw new Error("Unable to fetch pyth state base_update_fee");
  const info: PythStateInfo = { packageId, baseUpdateFee: BigInt(fee) };
  if (cache) cache.pythStateInfo = info;
  return info;
}

async function getWormholePackageId(
  client: SuiGrpcClient,
  wormholeStateId: string,
  cache?: PythCache,
): Promise<string> {
  if (cache?.wormholePackageId) return cache.wormholePackageId;
  const result = await client.getObject({ objectId: wormholeStateId, include: { json: true } });
  const json = result.object?.json as Record<string, unknown> | null | undefined;
  if (!json) throw new Error(`Cannot resolve wormhole package id from ${wormholeStateId}`);
  const pkg = pkgFromUpgradeCap(json, wormholeStateId);
  if (cache) cache.wormholePackageId = pkg;
  return pkg;
}

async function getPriceTableInfo(
  client: SuiGrpcClient,
  pythStateId: string,
  cache?: PythCache,
): Promise<PriceTableInfo> {
  if (cache?.priceTableInfo) return cache.priceTableInfo;

  interface DynamicFieldEntry {
    childId?: string;
    objectId?: string;
    valueType?: string;
    objectType?: string;
    name?: { type?: string };
  }

  const list = await client.listDynamicFields({ parentId: pythStateId });
  const entry = (list.dynamicFields as DynamicFieldEntry[]).find((e) => {
    const vt = e.valueType || e.objectType || "";
    return vt.includes("PriceIdentifier") || vt.includes("price_info");
  });
  if (!entry) throw new Error("Price table not found in Pyth state dynamic fields");
  const childId = entry.childId ?? entry.objectId;
  const typeStr = entry.valueType || entry.objectType || "";
  if (!childId) throw new Error("Price table missing childId");
  const pkgMatch = typeStr.match(/(0x[a-fA-F0-9]+)::price_identifier::PriceIdentifier/);
  if (!pkgMatch) throw new Error(`Cannot extract package from price table type: ${typeStr}`);
  const info: PriceTableInfo = { id: childId, fieldType: pkgMatch[1]! };
  if (cache) cache.priceTableInfo = info;
  return info;
}

async function getPriceFeedObjectId(
  client: SuiGrpcClient,
  table: PriceTableInfo,
  feedId: string,
  cache: PythCache | undefined,
  pythStateId: string,
): Promise<string | undefined> {
  const normalized = feedId.replace(/^0x/, "");
  const cacheKey = `${pythStateId}:${normalized}`;
  if (cache?.priceFeedObjectIdCache.has(cacheKey)) {
    return cache.priceFeedObjectIdCache.get(cacheKey);
  }
  const keyBytes = bcs
    .struct("PriceIdentifier", { bytes: bcs.vector(bcs.u8()) })
    .serialize({ bytes: fromHex(normalized) })
    .toBytes();
  const result = await client.getDynamicField({
    parentId: table.id,
    name: { type: `${table.fieldType}::price_identifier::PriceIdentifier`, bcs: keyBytes },
  });
  const value = result.dynamicField?.value as { bcs?: Uint8Array } | undefined;
  const objectId = !value?.bcs || value.bcs.length < 32 ? undefined : "0x" + toHex(value.bcs);
  if (cache) cache.priceFeedObjectIdCache.set(cacheKey, objectId);
  return objectId;
}

// ============================================================================
// Accumulator parsing
// ============================================================================

function extractVaaBytes(accumulatorMessage: Uint8Array): Uint8Array {
  const view = new DataView(
    accumulatorMessage.buffer,
    accumulatorMessage.byteOffset,
    accumulatorMessage.byteLength,
  );
  const trailingPayloadSize = view.getUint8(6);
  const vaaSizeOffset = 7 + trailingPayloadSize + 1; // +1 for proof_type
  const vaaSize = view.getUint16(vaaSizeOffset, false);
  const vaaOffset = vaaSizeOffset + 2;
  return accumulatorMessage.subarray(vaaOffset, vaaOffset + vaaSize);
}

// ============================================================================
// Pyth update calls
// ============================================================================

/**
 * Resolved source for the Pyth Core on-chain update fee. Deliberately a
 * closed two-variant union, not a `{ sponsorFund?, allowGasFee? }` pair — a
 * caller can no longer construct the "both supplied" or "neither supplied
 * but some other truthy flag" shapes that used to require a priority rule to
 * disambiguate.
 *
 * Resolved exactly ONCE, at the edges (`wrapRequestAndExecute` and the WLP
 * builders' equivalent in `perp/tx-builders/`) from config presence
 * (`pyth_sponsor_rule` deployed → open a fund → `'sponsor'`) and the
 * caller's ergonomic `allowGasFee` opt-in (→ `'gas'`), then threaded
 * verbatim through `refreshOraclePrices` → `BuildUpdateOpts` →
 * `PythCoreRule` → {@link buildPythPriceUpdateCalls}. The sponsor-beats-gas
 * priority from the old two-flag design is now structural — whichever edge
 * resolves this value decides once; no downstream layer re-derives or
 * re-documents a priority because none of them ever see more than one
 * candidate source.
 */
export type OracleFeeSource =
  | { readonly kind: "sponsor"; readonly fund: TransactionArgument; readonly packageId: string }
  | { readonly kind: "gas" };

/**
 * Thrown when no {@link OracleFeeSource} is available for the Pyth update fee
 * — from `buildPythPriceUpdateCalls`'s own per-call guard, or `aggregate.ts`'s
 * hoisted `refreshOraclePrices` pre-check (see its docblock). `instanceof`-able
 * (mirrors `FetchPolicyError` in `update-fetch.ts`) so a consumer — e.g. a BE
 * integration wiring its own `allowGasFee` decision — can branch on the error
 * type directly instead of string-matching `error.message`.
 */
export class OracleFeeSourceUnavailableError extends Error {
  constructor() {
    super(
      "OracleFeeSourceUnavailable: no fee source available for the Pyth update fee — " +
        "deploy pyth_sponsor_rule to config so a sponsor fund can be opened (see " +
        "openPythSponsorFund / wrapRequestAndExecute), or pass allowGasFee: true to draw " +
        "the fee from tx.gas in a non-sponsored context",
    );
    this.name = "OracleFeeSourceUnavailableError";
  }
}

/**
 * Append the on-chain Pyth update PTB block. Returns `PriceInfoObject` IDs
 * (one per `feedIds`, same order). After this you can feed `pyth_rule` per
 * ticker against the matching `PriceInfoObject` (see `rules/pyth-rule.ts`).
 *
 * `opts.feeSource` is resolved BEFORE any PTB mutation and is never silently
 * defaulted — this function trusts whatever single {@link OracleFeeSource}
 * it's handed, it does not choose between competing candidates:
 *   - `{ kind: 'sponsor' }` → the per-feed update fee is drawn from the
 *     sponsor pool (`pyth_sponsor_rule::split`) instead of `tx.gas`. Opening
 *     and reimbursing that fund is the caller's job (`rules/sponsor.ts` /
 *     `wrapRequestAndExecute`, which opens it whenever the client's config
 *     has `pyth_sponsor_rule` deployed) — this function only draws a fee
 *     coin from the already-open `fund` hot potato.
 *   - `{ kind: 'gas' }` → the fee is drawn from `tx.gas` via `tx.splitCoins`.
 *     Only safe in a non-sponsored context — Enoki-sponsored transactions
 *     reject any `tx.gas` draw.
 *   - `undefined` → throws `OracleFeeSourceUnavailable` instead of silently
 *     drawing from `tx.gas` (the old default), which broke under Enoki and,
 *     worse, could fail ON-CHAIN when the market's `request_checklist`
 *     requires the `PythSponsorRule` witness that only a real sponsor fund
 *     attaches.
 *
 * This function's own check runs AFTER `updates`/`feedIds` are already in
 * hand, so for `updatePythPrices` (which fetches from Hermes, then calls
 * straight into this function) the off-chain fetch has already completed by
 * the time this throws — a wasted network call, never a stray PTB command.
 * `refreshOraclePrices` avoids that waste entirely: it hoists an EQUIVALENT
 * check ABOVE its off-chain fetch AND its per-group build loop (see its
 * docblock in `aggregate.ts`), keyed on `PriceUpdateRule.requiresFeeSource`
 * rather than waiting for a specific rule's fetch to complete — so for that
 * route neither the network call NOR any PTB command happens before the
 * throw. This function's own (later, per-call) guard alone could not
 * provide that "before any group builds" guarantee in a mixed shape (e.g. a
 * fee-free Lazer group ordered ahead of a Pyth Core fallback group in the
 * same PTB) — `refreshOraclePrices`'s pre-check is what closes it.
 */
export async function buildPythPriceUpdateCalls(
  tx: Transaction,
  host: OracleHost,
  updates: Uint8Array[],
  feedIds: string[],
  opts?: { cache?: PythCache; feeSource?: OracleFeeSource },
): Promise<string[]> {
  if (updates.length === 0) {
    throw new Error("No price update data provided; Hermes returned empty results");
  }
  if (updates.length > 1) {
    throw new Error("Only a single accumulator message is supported per transaction");
  }
  const feeSource = opts?.feeSource;
  if (!feeSource) {
    throw new OracleFeeSourceUnavailableError();
  }

  const cache = opts?.cache;
  // Core on-chain infra is the `pyth_rule` source's own table, keyed by the
  // host's network — `client.pyth` carries only the caller's credential/policy.
  const pyth = PYTH_CORE_INFRA[host.network];
  const [stateInfo, wormholePackageId, table] = await Promise.all([
    getPythStateInfo(host.grpcClient, pyth.state_id, cache),
    getWormholePackageId(host.grpcClient, pyth.wormhole_state_id, cache),
    getPriceTableInfo(host.grpcClient, pyth.state_id, cache),
  ]);

  const priceInfoObjectIds = await Promise.all(
    feedIds.map((feedId) =>
      getPriceFeedObjectId(host.grpcClient, table, feedId, cache, pyth.state_id),
    ),
  );

  const { packageId: pythPackageId, baseUpdateFee } = stateInfo;

  // 1. Verify VAA
  const vaa = extractVaaBytes(updates[0]!);
  const [verifiedVaa] = tx.moveCall({
    target: `${wormholePackageId}::vaa::parse_and_verify`,
    arguments: [tx.object(pyth.wormhole_state_id), tx.pure.vector("u8", vaa), tx.object.clock()],
  });

  // 2. Authenticate price infos
  const [hotPotato0] = tx.moveCall({
    target: `${pythPackageId}::pyth::create_authenticated_price_infos_using_accumulator`,
    arguments: [
      tx.object(pyth.state_id),
      tx.pure.vector("u8", updates[0]!) as TransactionArgument,
      verifiedVaa as TransactionArgument,
      tx.object.clock(),
    ],
  });

  // 3. Per-feed update
  let hotPotato = hotPotato0;
  for (let i = 0; i < feedIds.length; i++) {
    const priceInfoObjectId = priceInfoObjectIds[i];
    if (!priceInfoObjectId) {
      throw new Error(`Pyth feed ${feedIds[i]} not registered on-chain in Pyth state`);
    }
    const feeCoin =
      feeSource.kind === "sponsor"
        ? tx.moveCall({
            target: `${feeSource.packageId}::pyth_sponsor_rule::split`,
            arguments: [feeSource.fund],
          })[0]!
        : tx.splitCoins(tx.gas, [tx.pure.u64(baseUpdateFee)])[0]!;

    [hotPotato] = tx.moveCall({
      target: `${pythPackageId}::pyth::update_single_price_feed`,
      arguments: [
        tx.object(pyth.state_id),
        hotPotato,
        tx.object(priceInfoObjectId),
        feeCoin,
        tx.object.clock(),
      ],
    });
  }

  // 4. Destroy hot potato
  tx.moveCall({
    target: `${pythPackageId}::hot_potato_vector::destroy`,
    arguments: [hotPotato],
    typeArguments: [`${pythPackageId}::price_info::PriceInfo`],
  });

  return priceInfoObjectIds as string[];
}

/** All-in-one: fetch from Hermes, append update calls. Returns PriceInfoObject IDs. */
export async function updatePythPrices(
  tx: Transaction,
  host: OracleHost,
  feedIds: string[],
  opts?: { cache?: PythCache; feeSource?: OracleFeeSource },
): Promise<string[]> {
  // The Core source's own Hermes endpoint (per-network, rule-owned table);
  // credential + fetch policy are the caller-supplied `client.pyth` slice.
  const endpoint = PYTH_CORE_INFRA[host.network].hermes_endpoint;
  const updates = await fetchPriceFeedsUpdateData(endpoint, feedIds, {
    apiKey: host.pyth.api_key,
    fetch: host.pyth.fetch,
  });
  // Align feedIds with the feeds the endpoint actually served — the fetch drops
  // (and memoizes) any it lacks, and `buildPythPriceUpdateCalls` emits one
  // update call per feedId, so a dropped feed would reference a PriceInfoObject
  // the accumulator blob doesn't cover (invalid PTB / on-chain abort). Mirrors
  // `PythCoreRule.fetchUpdateData`.
  const servedFeedIds = endpointSupportedFeedIds(endpoint, feedIds, host.pyth.api_key);
  return buildPythPriceUpdateCalls(tx, host, updates, servedFeedIds, opts);
}

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

import type { OracleHost } from "./host.ts";
import { FetchPolicyError, fetchWithPolicy, joinEndpointPath, trimTrailingSlashes } from "./update-fetch.ts";

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

type FetchOpts = { apiKey?: string; fetch?: { timeoutMs?: number; retries?: number } };

/**
 * Per-endpoint memo of feed ids this endpoint has rejected as unknown (a 404
 * on `/v2/updates/price/latest`). The Pyth Pro compat endpoint carries a
 * SUBSET of Core's feeds — mainnet `WTIUSD`/`BRENTUSD` (Commodities
 * USOILSPOT/UKOILSPOT) are absent, for example. Pyth 404s the WHOLE batch if
 * ANY id is unknown, and the body naming the bad ids is NOT reliably delivered
 * to `fetch` (Cloudflare returns it to curl but `content-length: 0` to node's
 * undici), so the ids are isolated by bisection and remembered here — later
 * batches skip them instead of 404ing every time. Cleared on process restart.
 */
const missingFeedIdsByEndpoint = new Map<string, Set<string>>();

/**
 * Memo key for `endpoint` — the same trailing-slash trim
 * {@link joinEndpointPath} applies to the request URL (shared helper, so the
 * two can't drift). Without this, two consumers spelling the same endpoint
 * differently (`…/hermes` vs `…/hermes/`) would fragment the memo into two
 * entries and re-run the whole 404 discovery despite one of them having
 * already paid for it.
 */
function memoKey(endpoint: string): string {
  return trimTrailingSlashes(endpoint);
}

function recordMissingFeed(endpoint: string, feedId: string): void {
  const key = memoKey(endpoint);
  let set = missingFeedIdsByEndpoint.get(key);
  if (!set) {
    set = new Set<string>();
    missingFeedIdsByEndpoint.set(key, set);
  }
  set.add(feedId.toLowerCase());
}

/**
 * The subset of `feedIds` this `endpoint` is known to serve — i.e. minus any
 * previously discovered to be absent (see {@link fetchPriceFeedsUpdateData}).
 * Callers building a `{ updates, feedIds }` payload use this to keep `feedIds`
 * aligned with the feeds the fetch actually returned data for, so
 * `buildPythPriceUpdateCalls` (one moveCall per feed id) never references a
 * feed the accumulator blob doesn't cover.
 */
export function endpointSupportedFeedIds(endpoint: string, feedIds: string[]): string[] {
  const missing = missingFeedIdsByEndpoint.get(memoKey(endpoint));
  return missing ? feedIds.filter((id) => !missing.has(id.toLowerCase())) : feedIds;
}

/** Test-only: forget everything learned about which feeds an endpoint lacks. */
export function __resetMissingFeedCacheForTest(): void {
  missingFeedIdsByEndpoint.clear();
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
 * Bisect `ids` to find which ones this endpoint 404s on and {@link
 * recordMissingFeed} them — the response body isn't readable, so a single id
 * that still 404s IS the unknown one. Data is discarded; this only populates
 * the memo. A non-404 (the subset is fine) or a network error stops that
 * branch. Runs at most once per endpoint per unknown-feed set (survivors are
 * memoized, so steady-state fetches never reach here).
 *
 * `known404: true` skips the root probe — the caller has already watched this
 * exact batch 404, so re-fetching it would only re-learn a fact in hand (a
 * wasted round trip on the money path during cold discovery). Recursive
 * half-calls always probe: their status is genuinely unknown.
 */
async function discoverMissingFeeds(
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
    if (res.status !== 404) return; // this subset is serveable — nothing to record
  }
  if (ids.length === 1) {
    recordMissingFeed(endpoint, ids[0]);
    return;
  }
  const mid = Math.floor(ids.length / 2);
  await Promise.all([
    discoverMissingFeeds(endpoint, ids.slice(0, mid), opts),
    discoverMissingFeeds(endpoint, ids.slice(mid), opts),
  ]);
}

/**
 * Discovery-only entry for consumers that fetch Hermes THEMSELVES (e.g. a
 * parsed latest-price reader) and just observed a whole-batch 404: bisects
 * `ids`, memoizes the endpoint-missing ones (see {@link
 * endpointSupportedFeedIds}), fetches NO survivor data. Without this, such a
 * consumer's only way to populate the memo was calling {@link
 * fetchPriceFeedsUpdateData} and discarding its accumulator blob — two full
 * redundant transfers per cold discovery.
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
  const ids = endpointSupportedFeedIds(endpoint, priceIds);
  if (ids.length === 0) return [];

  let res: Response;
  try {
    res = await rawFetch(endpoint, ids, opts);
  } catch (err) {
    // A retryable status (429/5xx) that never recovered surfaces as a
    // FetchPolicyError with `status` set — reformat it into this function's
    // own message shape so callers (and the e2e transient-failure detector,
    // which keys off "Hermes price fetch failed") see the same text whether
    // the failure was retried or not. A network-level exhaustion (no status)
    // has no domain-specific reframing to add — propagate it as-is.
    if (err instanceof FetchPolicyError && err.status !== undefined) {
      const body = err.bodySnippet ? ` ${err.bodySnippet}` : "";
      throw new Error(
        `Hermes price fetch failed: ${err.status}${body} (retries exhausted after ${err.attempts} attempts)`,
        { cause: err },
      );
    }
    throw err;
  }

  if (!res.ok) {
    // Pyth 404s the ENTIRE batch if ANY id is unknown to the endpoint (a Core
    // feed absent from the Pyth Pro compat endpoint). This is on the money
    // path of every order/position/WLP tx-build, so instead of failing the
    // whole refresh: discover the unknown ids (bisection — the body isn't
    // readable), memoize them, and re-fetch the survivors as ONE clean batch
    // (a single combined accumulator blob, which buildPythPriceUpdateCalls
    // requires). A genuinely-absent ticker just isn't in the payload — its
    // on-chain aggregate abstains/aborts, which is correct. Steady state:
    // once discovered, survivors are filtered up front and this never runs.
    if (res.status === 404) {
      void res.body?.cancel().catch(() => {});
      // known404: this exact batch just 404'd above — skip the root re-probe.
      await discoverMissingFeeds(endpoint, ids, opts, true);
      const survivors = endpointSupportedFeedIds(endpoint, ids);
      if (survivors.length === 0) return [];
      // survivors < ids ⇒ we removed the offender(s); re-fetch cleanly. Equal
      // ⇒ nothing was recorded (a 404 that wasn't a missing-feed rejection) —
      // surface it rather than loop.
      if (survivors.length < ids.length) {
        return fetchPriceFeedsUpdateData(endpoint, survivors, opts);
      }
    }
    throw new Error(`Hermes price fetch failed: ${res.status} ${await res.text()}`);
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
  cache?: PythCache,
  pythStateId?: string,
): Promise<string | undefined> {
  const normalized = feedId.replace(/^0x/, "");
  const cacheKey = pythStateId ? `${pythStateId}:${normalized}` : normalized;
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
  const pyth = host.pyth;
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
  const updates = await fetchPriceFeedsUpdateData(host.pyth.hermes_endpoint, feedIds, {
    apiKey: host.pyth.api_key,
    fetch: host.pyth.fetch,
  });
  return buildPythPriceUpdateCalls(tx, host, updates, feedIds, opts);
}

/**
 * Pyth price feed integration for the WaterX v3 oracle (ticker-based).
 *
 * Hermes REST fetches price update VAAs; on-chain a single PTB:
 *   1. wormhole::vaa::parse_and_verify
 *   2. pyth::create_authenticated_price_infos_using_accumulator
 *   3. pyth::update_single_price_feed (one per feed)
 *   4. for each ticker: oracle::new_collector(symbol) → pyth_rule::feed → oracle::aggregate
 *
 * No type parameters on `feed` / `aggregate` anymore — the oracle is one
 * shared object keyed by ticker. `pyth_rule::feed` looks up the on-chain
 * `PriceInfoObject` ID by ticker via the `pyth_rule::Config` identifier map.
 */

import { fromHex, toHex } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "../client.ts";
// ============================================================================
// Pyth-sponsor flow — pays Pyth update fees from a shared sponsor pool AND
// attaches the `PythSponsorRule` witness to a TradingRequest. Required when
// the market's `request_checklist` contains `PythSponsorRule`.
// ============================================================================

import {
  reimburse as sponsorReimburse,
  request as sponsorRequest,
} from "../generated/pyth_sponsor_rule/pyth_sponsor_rule.ts";
import { feed as constantRuleFeed } from "../generated/waterx_constant_rule/constant_rule.ts";
import { aggregate as aggregateCall, newCollector } from "../generated/waterx_oracle/oracle.ts";
import { feed as pythRuleFeed } from "../generated/waterx_pyth_rule/pyth_rule.ts";
import { feed as supraRuleFeed } from "../generated/waterx_supra_rule/supra_rule.ts";

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

export async function fetchPriceFeedsUpdateData(
  endpoint: string,
  priceIds: string[],
): Promise<Uint8Array[]> {
  if (priceIds.length === 0) return [];
  const url = new URL("/v2/updates/price/latest", endpoint);
  priceIds.forEach((id) => url.searchParams.append("ids[]", id));
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Hermes price fetch failed: ${res.status} ${await res.text()}`);
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
 * Append the on-chain Pyth update PTB block. Returns `PriceInfoObject` IDs
 * (one per `feedIds`, same order). After this you can call
 * `pyth_rule::feed` per ticker against the matching `PriceInfoObject`.
 *
 * If `sponsorFund` is provided, the per-feed update fee comes from the
 * sponsor pool (`pyth_sponsor_rule::split`) instead of `tx.gas`.
 */
export async function buildPythPriceUpdateCalls(
  tx: Transaction,
  client: WaterXClient,
  updates: Uint8Array[],
  feedIds: string[],
  cache?: PythCache,
  sponsorFund?: { fund: TransactionArgument; packageId: string },
): Promise<string[]> {
  if (updates.length === 0) {
    throw new Error("No price update data provided; Hermes returned empty results");
  }
  if (updates.length > 1) {
    throw new Error("Only a single accumulator message is supported per transaction");
  }

  const pyth = client.pyth;
  const [stateInfo, wormholePackageId, table] = await Promise.all([
    getPythStateInfo(client.grpcClient, pyth.state_id, cache),
    getWormholePackageId(client.grpcClient, pyth.wormhole_state_id, cache),
    getPriceTableInfo(client.grpcClient, pyth.state_id, cache),
  ]);

  const priceInfoObjectIds = await Promise.all(
    feedIds.map((feedId) =>
      getPriceFeedObjectId(client.grpcClient, table, feedId, cache, pyth.state_id),
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
    const feeCoin = sponsorFund
      ? tx.moveCall({
          target: `${sponsorFund.packageId}::pyth_sponsor_rule::split`,
          arguments: [sponsorFund.fund],
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
  client: WaterXClient,
  feedIds: string[],
  cache?: PythCache,
  sponsorFund?: { fund: TransactionArgument; packageId: string },
): Promise<string[]> {
  const updates = await fetchPriceFeedsUpdateData(client.pyth.hermes_endpoint, feedIds);
  return buildPythPriceUpdateCalls(tx, client, updates, feedIds, cache, sponsorFund);
}

// ============================================================================
// Per-ticker refresh: collector → pyth_rule::feed → oracle::aggregate
// ============================================================================

/**
 * Aggregate one ticker's price into the shared `Oracle`: build a collector, feed
 * every rule the ticker is configured for, then `aggregate`. The fed rule set must
 * match the on-chain weighted set for the ticker — `aggregator::remove_outliers`
 * aborts `EMissingPriceSource` if a weighted rule is missing from the collector:
 *
 * - **Pyth** — fed when `priceInfoObjectId` is supplied (i.e. the ticker has a
 *   `pyth_rule.feeds` entry). Caller must run the Pyth update first so the
 *   `PriceInfoObject` is fresh.
 * - **Supra** — fed alongside Pyth when supra is enabled + wired (abstains on-chain
 *   for symbols it has no pair for).
 * - **Constant** — fed when the ticker is a constant ticker
 *   ({@link WaterXClient.isConstantTicker}).
 *
 * "Dual-feed" (Pyth + Constant) and "constant-only" are not special cases — they
 * fall out of which rules the ticker is in: a constant ticker that also has a Pyth
 * feed gets both; one with no Pyth feed (no `priceInfoObjectId`) gets constant only.
 * Throws if no rule applies to the ticker.
 */
export function aggregateTicker(
  tx: Transaction,
  client: WaterXClient,
  args: { ticker: string; priceInfoObjectId?: string },
): void {
  const oraclePkg = client.config.packages.waterx_oracle.published_at;
  const collector = newCollector({
    package: oraclePkg,
    arguments: { symbol: args.ticker },
  })(tx) as unknown as TransactionArgument;

  let fed = false;

  if (args.priceInfoObjectId) {
    pythRuleFeed({
      package: client.config.packages.pyth_rule.published_at,
      arguments: {
        collector,
        config: tx.object(client.config.packages.pyth_rule.config),
        pythState: tx.object(client.pyth.state_id),
        pythPriceInfo: tx.object(args.priceInfoObjectId),
      },
    })(tx);
    // Supra rides on the same collector when enabled (abstains on-chain otherwise).
    maybeFeedSupra(tx, client, collector);
    fed = true;
  }

  if (client.isConstantTicker(args.ticker)) {
    const constant = client.config.packages.constant_rule!;
    constantRuleFeed({
      package: constant.published_at,
      arguments: { collector, config: tx.object(constant.config) },
    })(tx);
    fed = true;
  }

  if (!fed) {
    throw new Error(
      `no oracle rule configured for ticker '${args.ticker}' (no pyth feed, not a constant ticker)`,
    );
  }

  aggregateCall({
    package: oraclePkg,
    arguments: {
      oracle: tx.object(client.config.packages.waterx_oracle.oracle),
      collector,
    },
  })(tx);
}

/**
 * Thin wrapper over {@link aggregateTicker} for a Pyth-fed ticker. Kept for
 * back-compat (e.g. WLP mint builds). Caller must run the Pyth update first.
 */
export function aggregateTickerWithPyth(
  tx: Transaction,
  client: WaterXClient,
  args: { ticker: string; priceInfoObjectId: string },
): void {
  aggregateTicker(tx, client, args);
}

/**
 * Append a `supra_rule::feed` on `collector` when the deployment has supra
 * enabled + wired (see {@link WaterXClient.getSupraRule}). No-op otherwise, so
 * Pyth-only deployments are unchanged.
 */
function maybeFeedSupra(
  tx: Transaction,
  client: WaterXClient,
  collector: TransactionArgument,
): void {
  const supra = client.getSupraRule();
  if (!supra) return;
  supraRuleFeed({
    package: supra.published_at,
    arguments: {
      collector,
      config: tx.object(supra.config),
      oracleHolder: tx.object(supra.oracle_holder),
    },
  })(tx);
}

/**
 * {@link aggregateTicker} for a **constant-only** ticker (no Pyth update needed —
 * the price comes from the on-chain `constant_rule::Config`).
 *
 * Throws if the ticker ALSO has a `pyth_rule.feeds` entry (a dual-feed transition
 * ticker): feeding only the constant leg would leave the still-weighted Pyth rule
 * absent from the collector and abort `aggregate` with `EMissingPriceSource`. Such
 * tickers must go through {@link aggregateTicker} with a `priceInfoObjectId` (or
 * {@link refreshOraclePrices}), which feeds both.
 */
export function aggregateTickerWithConstant(
  tx: Transaction,
  client: WaterXClient,
  args: { ticker: string },
): void {
  if (client.config.packages.pyth_rule?.feeds?.[args.ticker] !== undefined) {
    throw new Error(
      `'${args.ticker}' is in pyth_rule.feeds (dual-feed) — feed both via aggregateTicker({ priceInfoObjectId }) / refreshOraclePrices, not aggregateTickerWithConstant`,
    );
  }
  aggregateTicker(tx, client, { ticker: args.ticker });
}

/**
 * Refresh multiple tickers in one PTB. For each ticker {@link aggregateTicker}
 * feeds whichever rules it is configured for (Pyth if it has a `pyth_rule.feeds`
 * entry, Supra when enabled, Constant when it's a constant ticker). Tickers with a
 * Pyth feed are updated on-chain via one shared Pyth accumulator first; the rest
 * (constant-only) skip Pyth entirely.
 */
export async function refreshOraclePrices(
  tx: Transaction,
  client: WaterXClient,
  tickers: string[],
  opts: {
    cache?: PythCache;
    sponsorFund?: { fund: TransactionArgument; packageId: string };
  } = {},
): Promise<void> {
  if (tickers.length === 0) return;

  // Every ticker with a pyth_rule.feeds entry needs the on-chain Pyth update
  // first (one shared accumulator). Constant-only tickers (no pyth feed) skip it.
  const pythTickers = tickers.filter(
    (t) => client.config.packages.pyth_rule?.feeds?.[t] !== undefined,
  );
  const priceInfoByTicker = new Map<string, string>();
  if (pythTickers.length > 0) {
    const entries = pythTickers.map((t) => client.getPythFeed(t));
    await updatePythPrices(
      tx,
      client,
      entries.map((e) => e.feed_id),
      opts.cache,
      opts.sponsorFund,
    );
    pythTickers.forEach((t, i) => priceInfoByTicker.set(t, entries[i]!.price_info_object));
  }

  // Aggregate each ticker, feeding whichever rules it is configured for.
  for (const ticker of tickers) {
    aggregateTicker(tx, client, { ticker, priceInfoObjectId: priceInfoByTicker.get(ticker) });
  }
}

/**
 * Opens a `Fund` hot potato from the shared PythSponsor pool. Pass the
 * returned `{ fund, packageId }` straight to `refreshOraclePrices` as
 * `sponsorFund`, then `reimbursePythSponsor` once the TradingRequest is
 * built to attach the `PythSponsorRule` witness and return leftover
 * balance.
 */
export function openPythSponsorFund(
  tx: Transaction,
  client: WaterXClient,
): { fund: TransactionArgument; packageId: string } {
  const entry = client.config.packages.pyth_sponsor_rule;
  if (!entry?.published_at || !entry.pyth_sponsor) {
    throw new Error(
      "pyth_sponsor_rule.{published_at,pyth_sponsor} missing — sponsor flow unavailable",
    );
  }
  const [fund] = sponsorRequest({
    package: entry.published_at,
    arguments: { self: tx.object(entry.pyth_sponsor) },
  })(tx);
  return { fund: fund as unknown as TransactionArgument, packageId: entry.published_at };
}

/**
 * Consumes the `Fund` hot potato from `openPythSponsorFund`, returns any
 * leftover SUI to the sponsor pool, and attaches the `PythSponsorRule`
 * witness to the given `TradingRequest<C_TOKEN>` so `trading::execute`
 * can satisfy a checklist that includes `PythSponsorRule`.
 */
export function reimbursePythSponsor(
  tx: Transaction,
  client: WaterXClient,
  fund: TransactionArgument,
  tradingRequest: TransactionArgument,
  collateralType: string,
): void {
  const entry = client.config.packages.pyth_sponsor_rule;
  if (!entry?.published_at || !entry.pyth_sponsor) {
    throw new Error("pyth_sponsor_rule missing from config");
  }
  sponsorReimburse({
    package: entry.published_at,
    arguments: {
      self: tx.object(entry.pyth_sponsor),
      fund: fund as unknown as TransactionArgument,
      tradingReq: tradingRequest as unknown as TransactionArgument,
    },
    typeArguments: [collateralType],
  })(tx);
}

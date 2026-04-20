/**
 * Pyth price feed integration for WaterX Perp DEX.
 *
 * Fetches price update data from Hermes REST API, builds Move calls for Sui.
 * Does NOT depend on @pythnetwork/pyth-sui-js — uses direct Hermes REST + Move calls.
 */

import { fromHex, toHex } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import { aggregate as aggregateCall } from "../generated/bucket_v2_oracle/aggregator.ts";
import { _new as collectorNewCall } from "../generated/bucket_v2_oracle/collector.ts";

// ============================================================================
// Types
// ============================================================================

export type PythConfig = {
  pythStateId: string;
  wormholeStateId: string;
  /** Hermes REST endpoint. Defaults to stable (mainnet) or beta (testnet). */
  hermesEndpoint: string;
};

type PriceTableInfo = { id: string; fieldType: string };
type PythStateInfo = { packageId: string; baseUpdateFee: bigint };

// ============================================================================
// Cache — one per client instance to avoid redundant RPC reads
// ============================================================================

export class PythCache {
  pythStateInfo?: PythStateInfo;
  wormholePackageId?: string;
  priceTableInfo?: PriceTableInfo;
  priceFeedObjectIdCache = new Map<string, string | undefined>();
}

// ============================================================================
// Hermes REST fetch (no SDK required)
// ============================================================================

/**
 * Fetches latest price update data from Hermes (public REST; no API key).
 * Returns raw accumulator message buffers for Pyth Move update.
 */
export async function fetchPriceFeedsUpdateData(
  endpoint: string,
  priceIds: string[],
): Promise<Uint8Array[]> {
  if (priceIds.length === 0) return [];

  const url = new URL("/v2/updates/price/latest", endpoint);
  priceIds.forEach((id) => url.searchParams.append("ids[]", id));

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hermes price fetch failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    binary?: { encoding?: string; data?: string[] };
  };

  const data = json.binary?.data;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Hermes returned no binary price data");
  }

  return data.map((hexStr: string) => fromHex(hexStr));
}

// ============================================================================
// Accumulator message parsing
// ============================================================================

/**
 * Extracts the VAA bytes from an accumulator message.
 * Layout: [magic:4][major:1][minor:1][trailingSize:1][trailing:N][proof_type:1][vaaSize:2][vaa:M]...
 */
function extractVaaBytesFromAccumulatorMessage(accumulatorMessage: Uint8Array): Uint8Array {
  const view = new DataView(
    accumulatorMessage.buffer,
    accumulatorMessage.byteOffset,
    accumulatorMessage.byteLength,
  );
  const trailingPayloadSize = view.getUint8(6);
  const vaaSizeOffset = 7 + trailingPayloadSize + 1; // +1 for proof_type
  const vaaSize = view.getUint16(vaaSizeOffset, false); // big-endian
  const vaaOffset = vaaSizeOffset + 2;
  return accumulatorMessage.subarray(vaaOffset, vaaOffset + vaaSize);
}

// ============================================================================
// On-chain reads (cached)
// ============================================================================

function getPackageIdFromObjectJson(json: Record<string, unknown>, objectId: string): string {
  const upgradeCap =
    (json.upgrade_cap as Record<string, unknown> | undefined) ??
    ((json.fields as Record<string, unknown> | undefined)?.upgrade_cap as
      | Record<string, unknown>
      | undefined);
  const fromFields = (upgradeCap?.fields as Record<string, unknown> | undefined)?.package;
  const pkg =
    typeof upgradeCap?.package === "string"
      ? upgradeCap.package
      : typeof fromFields === "string"
        ? fromFields
        : undefined;
  if (!pkg) throw new Error(`Cannot get package id for object ${objectId}`);
  return pkg;
}

async function getWormholePackageId(
  client: SuiGrpcClient,
  wormholeStateId: string,
  cache?: PythCache,
): Promise<string> {
  if (cache?.wormholePackageId) return cache.wormholePackageId;
  const result = await client.getObject({
    objectId: wormholeStateId,
    include: { json: true },
  });
  const json = result.object?.json as Record<string, unknown> | null | undefined;
  if (!json) throw new Error(`Cannot get package id for object ${wormholeStateId}`);
  const pkg = getPackageIdFromObjectJson(json, wormholeStateId);
  if (cache) cache.wormholePackageId = pkg;
  return pkg;
}

async function getPythStateInfo(
  client: SuiGrpcClient,
  pythStateId: string,
  cache?: PythCache,
): Promise<PythStateInfo> {
  if (cache?.pythStateInfo) return cache.pythStateInfo;
  const result = await client.getObject({
    objectId: pythStateId,
    include: { json: true },
  });
  const json = result.object?.json as Record<string, unknown> | null | undefined;
  if (!json) throw new Error("Unable to fetch pyth state");
  const packageId = getPackageIdFromObjectJson(json, pythStateId);
  const fields = json.fields as Record<string, unknown> | undefined;
  const fee = (fields?.base_update_fee ?? json.base_update_fee) as string | undefined;
  if (fee === undefined) throw new Error("Unable to fetch pyth state base_update_fee");
  const info: PythStateInfo = { packageId, baseUpdateFee: BigInt(fee) };
  if (cache) cache.pythStateInfo = info;
  return info;
}

async function getPriceTableInfo(
  client: SuiGrpcClient,
  pythStateId: string,
  cache?: PythCache,
): Promise<PriceTableInfo> {
  if (cache?.priceTableInfo) return cache.priceTableInfo;

  let childId: string | undefined;
  let typeStr: string;

  interface DynamicFieldEntry {
    childId?: string;
    objectId?: string;
    valueType?: string;
    objectType?: string;
    name?: { type?: string };
  }

  if ("listDynamicFields" in client && typeof client.listDynamicFields === "function") {
    // gRPC path
    const list = await client.listDynamicFields({ parentId: pythStateId });
    const entry = (list.dynamicFields as DynamicFieldEntry[]).find((e) => {
      const vt = e.valueType || e.objectType || "";
      return vt.includes("PriceIdentifier") || vt.includes("price_info");
    });
    if (!entry) throw new Error("Price table not found in Pyth state dynamic fields");
    childId = entry.childId ?? entry.objectId;
    typeStr = entry.valueType || entry.objectType || "";
  } else if (
    "getDynamicFields" in client &&
    typeof (client as Record<string, unknown>)["getDynamicFields"] === "function"
  ) {
    // JSON-RPC fallback
    const getDynFields = (client as Record<string, (...args: unknown[]) => unknown>)[
      "getDynamicFields"
    ];
    const list = await getDynFields.call(client, { parentId: pythStateId });
    const rows: DynamicFieldEntry[] = (list as { data?: DynamicFieldEntry[] })?.data ?? [];
    const entry = rows.find((e) => {
      const vt = e.objectType || e.name?.type || "";
      return vt.includes("PriceIdentifier") || vt.includes("price_info");
    });
    if (!entry) throw new Error("Price table not found in Pyth state dynamic fields");
    childId = entry.objectId;
    typeStr = entry.objectType || entry.name?.type || "";
  } else {
    throw new Error("Client does not support listDynamicFields or getDynamicFields");
  }

  if (!childId) throw new Error("Price table not found in Pyth state dynamic fields");

  const pkgMatch = typeStr.match(/(0x[a-fA-F0-9]+)::price_identifier::PriceIdentifier/);
  if (!pkgMatch) {
    throw new Error(`Cannot extract package address from price table type: ${typeStr}`);
  }
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
    name: {
      type: `${table.fieldType}::price_identifier::PriceIdentifier`,
      bcs: keyBytes,
    },
  });
  const value = result.dynamicField?.value as { bcs?: Uint8Array } | undefined;
  const objectId = !value?.bcs || value.bcs.length < 32 ? undefined : "0x" + toHex(value.bcs);

  if (cache) cache.priceFeedObjectIdCache.set(cacheKey, objectId);
  return objectId;
}

// ============================================================================
// Concurrency helper
// ============================================================================

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

// ============================================================================
// Wormhole VAA verification
// ============================================================================

function verifyVaas(
  tx: Transaction,
  wormholePackageId: string,
  wormholeStateId: string,
  vaas: Uint8Array[],
): TransactionArgument[] {
  const verified: TransactionArgument[] = [];
  for (const vaa of vaas) {
    const vaaArg = tx.pure.vector("u8", vaa);
    const [verifiedVaa] = tx.moveCall({
      target: `${wormholePackageId}::vaa::parse_and_verify`,
      arguments: [tx.object(wormholeStateId), vaaArg, tx.object.clock()],
    });
    verified.push(verifiedVaa as TransactionArgument);
  }
  return verified;
}

// ============================================================================
// Main: Build Pyth price update calls in a PTB
// ============================================================================

/**
 * Appends Pyth price update Move calls to `tx` and returns
 * PriceInfoObject IDs (one per feedId, in same order).
 *
 * PTB flow:
 * 1. wormhole::vaa::parse_and_verify — verify the VAA in the accumulator message
 * 2. pyth::create_authenticated_price_infos_using_accumulator — decode price proofs
 * 3. pyth::update_single_price_feed — update each feed (pays base_update_fee)
 * 4. hot_potato_vector::destroy — clean up the hot potato
 *
 * After this, PriceInfoObjects are updated and can be read by pyth_rule::feed().
 */
export async function buildPythPriceUpdateCalls(
  tx: Transaction,
  client: SuiGrpcClient,
  config: PythConfig,
  updates: Uint8Array[],
  feedIds: string[],
  cache?: PythCache,
  sponsorFund?: { fund: TransactionArgument; packageId: string },
): Promise<string[]> {
  if (updates.length === 0) {
    throw new Error("No price update data provided; Hermes may have returned empty results");
  }
  if (updates.length > 1) {
    throw new Error("Only a single accumulator message is supported per transaction");
  }

  const [pythState, wormholePackageId, table] = await Promise.all([
    getPythStateInfo(client, config.pythStateId, cache),
    getWormholePackageId(client, config.wormholeStateId, cache),
    getPriceTableInfo(client, config.pythStateId, cache),
  ]);
  const priceInfoObjectIds = await runWithConcurrency(feedIds, 4, (feedId) =>
    getPriceFeedObjectId(client, table, feedId, cache, config.pythStateId),
  );

  const { packageId: pythPackageId, baseUpdateFee } = pythState;

  // 1. Verify VAA
  const vaa = extractVaaBytesFromAccumulatorMessage(updates[0]!);
  const verifiedVaas = verifyVaas(tx, wormholePackageId, config.wormholeStateId, [vaa]);

  // 2. Create authenticated price infos
  const accBytesArg = tx.pure.vector("u8", updates[0]!) as TransactionArgument;
  const [priceUpdatesHotPotato] = tx.moveCall({
    target: `${pythPackageId}::pyth::create_authenticated_price_infos_using_accumulator`,
    arguments: [tx.object(config.pythStateId), accBytesArg, verifiedVaas[0]!, tx.object.clock()],
  });

  // 3. Update each price feed (pay fee from sponsor fund or gas)
  let hotPotato = priceUpdatesHotPotato;
  for (let i = 0; i < feedIds.length; i++) {
    const priceInfoObjectId = priceInfoObjectIds[i];
    if (!priceInfoObjectId) {
      throw new Error(
        `Price feed ${feedIds[i]} not found on-chain; create it first via pyth::create_price_feeds_using_accumulator`,
      );
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
        tx.object(config.pythStateId),
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

// ============================================================================
// Convenience: Fetch + Build in one call
// ============================================================================

/**
 * All-in-one: fetches price data from Hermes and appends Pyth update calls to the PTB.
 * Returns PriceInfoObject IDs that can then be passed to pyth_rule::feed().
 */
export async function updatePythPrices(
  tx: Transaction,
  client: SuiGrpcClient,
  config: PythConfig,
  feedIds: string[],
  cache?: PythCache,
  sponsorFund?: { fund: TransactionArgument; packageId: string },
): Promise<string[]> {
  const updates = await fetchPriceFeedsUpdateData(config.hermesEndpoint, feedIds);
  return buildPythPriceUpdateCalls(tx, client, config, updates, feedIds, cache, sponsorFund);
}

// ============================================================================
// PTB helpers: feed prices into bucket_oracle via pyth_rule
// ============================================================================

/**
 * After Pyth prices are updated in the PTB, feed them into bucket_oracle
 * PriceCollectors via pyth_rule::feed.
 *
 * Does NOT create collectors or aggregate — the caller manages the collector
 * lifecycle so multiple sources can feed into the same collector.
 */
export function feedPythRule(
  tx: Transaction,
  collector: TransactionArgument,
  params: {
    pythRulePackageId: string;
    pythRuleConfigId: string;
    pythStateId: string;
    tokenType: string;
    priceInfoObjectId: string;
  },
): void {
  tx.moveCall({
    target: `${params.pythRulePackageId}::pyth_rule::feed`,
    typeArguments: [params.tokenType],
    arguments: [
      collector,
      tx.object(params.pythRuleConfigId),
      tx.object.clock(),
      tx.object(params.pythStateId),
      tx.object(params.priceInfoObjectId),
    ],
  });
}

/**
 * Legacy helper — creates collectors, feeds Pyth, aggregates.
 * For multi-source (Pyth + Supra), use buildOracleFeedCalls from tx-builders instead.
 */
export function buildPythRuleFeedCalls(
  tx: Transaction,
  params: {
    pythRulePackageId: string;
    pythRuleConfigId: string;
    bucketOraclePackageId: string;
    pythStateId: string;
    feeds: Array<{
      tokenType: string;
      aggregatorId: string;
      priceInfoObjectId: string;
    }>;
  },
): TransactionArgument[] {
  const results: TransactionArgument[] = [];

  for (const feed of params.feeds) {
    const [collector] = collectorNewCall({
      package: params.bucketOraclePackageId,
      typeArguments: [feed.tokenType],
    })(tx);

    feedPythRule(tx, collector as TransactionArgument, {
      pythRulePackageId: params.pythRulePackageId,
      pythRuleConfigId: params.pythRuleConfigId,
      pythStateId: params.pythStateId,
      tokenType: feed.tokenType,
      priceInfoObjectId: feed.priceInfoObjectId,
    });

    const [priceResult] = aggregateCall({
      package: params.bucketOraclePackageId,
      arguments: { self: feed.aggregatorId, collector: collector as TransactionArgument },
      typeArguments: [feed.tokenType],
    })(tx);

    results.push(priceResult as TransactionArgument);
  }

  return results;
}

import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import {
  AccountDataViewBcs,
  mapAccountDataView,
  mapCursorView,
  mapMarketExposure,
  mapMarketView,
  mapOrderView,
  mapPositionView,
  mapRegistryView,
  MarketViewBcs,
  OrderViewBcs,
  PositionViewBcs,
  RegistryViewBcs,
} from "./bcs.ts";
import type { PredictClient } from "./client.ts";
import type {
  AccountDataView,
  CursorView,
  MarketExposure,
  MarketIdInput,
  MarketPage,
  MarketView,
  OrderView,
  PageParams,
  PositionPage,
  PositionView,
  RegistryView,
} from "./types.ts";
import {
  marketIdArg,
  resolveAccountPackageId,
  resolveAccountRegistry,
  resolveGlobalConfig,
  resolveMarketRegistry,
  resolvePackageId,
  resolveSettlementCoinType,
  toBigInt,
} from "./utils.ts";

export function extractReturnBytes(result: any, commandIndex = 0, returnIndex = 0): Uint8Array {
  if (result.$kind === "FailedTransaction") {
    const err = result.FailedTransaction.status.error;
    throw new Error(`Simulate transaction failed: ${err?.message ?? JSON.stringify(err)}`);
  }

  const bcsBytes = result.commandResults?.[commandIndex]?.returnValues?.[returnIndex]?.bcs;
  if (bcsBytes) return new Uint8Array(bcsBytes);

  const legacy = result.results?.[commandIndex]?.returnValues?.[returnIndex];
  if (legacy) return new Uint8Array(legacy[0]);

  throw new Error(`No return value at command[${commandIndex}].returnValues[${returnIndex}]`);
}

export interface ViewBaseParams {
  packageId?: string;
  marketRegistry?: string;
  accountRegistry?: string;
  settlementCoinType?: string;
}

export async function getRegistry(
  client: PredictClient,
  params: ViewBaseParams = {},
): Promise<RegistryView> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::registry`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [tx.object(resolveMarketRegistry(client, params.marketRegistry))],
  });
  const result = await client.simulate(tx);
  return mapRegistryView(RegistryViewBcs.parse(extractReturnBytes(result)));
}

export async function getOrder(
  client: PredictClient,
  params: ViewBaseParams & { orderId: bigint | number | string },
): Promise<OrderView> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::order`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.u64(toBigInt(params.orderId)),
    ],
  });
  const result = await client.simulate(tx);
  return mapOrderView(OrderViewBcs.parse(extractReturnBytes(result)));
}

export async function getPosition(
  client: PredictClient,
  params: ViewBaseParams & { positionId: bigint | number | string },
): Promise<PositionView> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::position`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.u64(toBigInt(params.positionId)),
    ],
  });
  const result = await client.simulate(tx);
  return mapPositionView(PositionViewBcs.parse(extractReturnBytes(result)));
}

export async function getMarketById(
  client: PredictClient,
  params: ViewBaseParams & { marketId: MarketIdInput },
): Promise<MarketView> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::market_by_id`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      marketIdArg(tx, params.marketId),
    ],
  });
  const result = await client.simulate(tx);
  return mapMarketView(MarketViewBcs.parse(extractReturnBytes(result)));
}

export async function getMarketByKey(
  client: PredictClient,
  params: ViewBaseParams & { marketKey: bigint | number | string },
): Promise<MarketView> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::market_by_key`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.u64(toBigInt(params.marketKey)),
    ],
  });
  const result = await client.simulate(tx);
  return mapMarketView(MarketViewBcs.parse(extractReturnBytes(result)));
}

export async function getMarketExposure(
  client: PredictClient,
  params: ViewBaseParams & { marketId: MarketIdInput },
): Promise<MarketExposure> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::market_exposure`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      marketIdArg(tx, params.marketId),
    ],
  });
  const result = await client.simulate(tx);
  return mapMarketExposure(
    bcs.u64().parse(extractReturnBytes(result, 0, 0)),
    bcs.u64().parse(extractReturnBytes(result, 0, 1)),
    bcs.u64().parse(extractReturnBytes(result, 0, 2)),
    bcs.u64().parse(extractReturnBytes(result, 0, 3)),
  );
}

export async function getMarketExposureByKey(
  client: PredictClient,
  params: ViewBaseParams & { marketKey: bigint | number | string },
): Promise<MarketExposure> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::market_exposure_by_key`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.u64(toBigInt(params.marketKey)),
    ],
  });
  const result = await client.simulate(tx);
  return mapMarketExposure(
    bcs.u64().parse(extractReturnBytes(result, 0, 0)),
    bcs.u64().parse(extractReturnBytes(result, 0, 1)),
    bcs.u64().parse(extractReturnBytes(result, 0, 2)),
    bcs.u64().parse(extractReturnBytes(result, 0, 3)),
  );
}

async function readCursor(
  client: PredictClient,
  functionName: string,
  params: ViewBaseParams = {},
): Promise<CursorView> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::${functionName}`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [tx.object(resolveMarketRegistry(client, params.marketRegistry))],
  });
  const result = await client.simulate(tx);
  return mapCursorView(
    bcs.u64().parse(extractReturnBytes(result, 0, 0)),
    bcs.option(bcs.u64()).parse(extractReturnBytes(result, 0, 1)),
    bcs.option(bcs.u64()).parse(extractReturnBytes(result, 0, 2)),
  );
}

export function getOrderCursor(client: PredictClient, params: ViewBaseParams = {}) {
  return readCursor(client, "order_cursor", params);
}

export function getPositionCursor(client: PredictClient, params: ViewBaseParams = {}) {
  return readCursor(client, "position_cursor", params);
}

export function getUnresolvedMarketCursor(client: PredictClient, params: ViewBaseParams = {}) {
  return readCursor(client, "unresolved_market_cursor", params);
}

export function getResolvedMarketCursor(client: PredictClient, params: ViewBaseParams = {}) {
  return readCursor(client, "resolved_market_cursor", params);
}

const DEFAULT_PAGE_LIMIT = 100n;

/** Encode an optional cursor key as a Move `Option<u64>` pure arg (`undefined` → none / from front). */
function startArg(tx: Transaction, start?: bigint | number | string) {
  return tx.pure(bcs.option(bcs.u64()).serialize(start === undefined ? null : toBigInt(start)));
}

/** Every unresolved (active) market in one call. Prefer `getUnresolvedMarketsPage` when the table is large. */
export async function getUnresolvedMarkets(
  client: PredictClient,
  params: ViewBaseParams = {},
): Promise<MarketView[]> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::unresolved_markets`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [tx.object(resolveMarketRegistry(client, params.marketRegistry))],
  });
  const result = await client.simulate(tx);
  return bcs.vector(MarketViewBcs).parse(extractReturnBytes(result)).map(mapMarketView);
}

async function readMarketsPage(
  client: PredictClient,
  functionName: "unresolved_markets_page" | "resolved_markets_page",
  params: PageParams = {},
): Promise<MarketPage> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::${functionName}`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      startArg(tx, params.start),
      tx.pure.u64(params.limit === undefined ? DEFAULT_PAGE_LIMIT : toBigInt(params.limit)),
    ],
  });
  const result = await client.simulate(tx);
  const markets = bcs
    .vector(MarketViewBcs)
    .parse(extractReturnBytes(result, 0, 0))
    .map(mapMarketView);
  const next = bcs.option(bcs.u64()).parse(extractReturnBytes(result, 0, 1));
  return { markets, nextCursor: next == null ? null : BigInt(next) };
}

export function getUnresolvedMarketsPage(client: PredictClient, params: PageParams = {}) {
  return readMarketsPage(client, "unresolved_markets_page", params);
}

export function getResolvedMarketsPage(client: PredictClient, params: PageParams = {}) {
  return readMarketsPage(client, "resolved_markets_page", params);
}

export async function getPositionsPage(
  client: PredictClient,
  params: PageParams = {},
): Promise<PositionPage> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::positions_page`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      startArg(tx, params.start),
      tx.pure.u64(params.limit === undefined ? DEFAULT_PAGE_LIMIT : toBigInt(params.limit)),
    ],
  });
  const result = await client.simulate(tx);
  const positions = bcs
    .vector(PositionViewBcs)
    .parse(extractReturnBytes(result, 0, 0))
    .map(mapPositionView);
  const next = bcs.option(bcs.u64()).parse(extractReturnBytes(result, 0, 1));
  return { positions, nextCursor: next == null ? null : BigInt(next) };
}

export interface GetAccountIdsParams {
  /** Wallet address that owns sub-accounts in the registry. */
  owner: string;
  accountRegistry?: string;
  /** `waterx_account` package id (defaults to `client.waterxAccountPackageId()`). */
  accountPackageId?: string;
}

/**
 * Registry account ids (`0x2::object::ID`) for an owner via `waterx_account::account::account_ids`.
 * Use these ids with `getAccountData`, `deposit`, and `placeOrder` — not Suiscan "Account" object addresses.
 */
export async function getAccountIds(
  client: PredictClient,
  params: GetAccountIdsParams,
): Promise<string[]> {
  const pkg = resolveAccountPackageId(client, params.accountPackageId);
  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg}::account::account_ids`,
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.pure.address(params.owner),
    ],
  });
  const result = await client.simulate(tx);
  return bcs.vector(bcs.Address).parse(extractReturnBytes(result));
}

export async function getAccountData(
  client: PredictClient,
  params: ViewBaseParams & { accountId: string },
): Promise<AccountDataView> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::account`,
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.pure.id(params.accountId),
    ],
  });
  const result = await client.simulate(tx);
  return mapAccountDataView(AccountDataViewBcs.parse(extractReturnBytes(result)));
}

export async function getAccountOrderIds(
  client: PredictClient,
  params: ViewBaseParams & { accountId: string; marketKey: bigint | number | string },
): Promise<bigint[]> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::account_order_ids`,
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.pure.id(params.accountId),
      tx.pure.u64(toBigInt(params.marketKey)),
    ],
  });
  const result = await client.simulate(tx);
  return bcs
    .vector(bcs.u64())
    .parse(extractReturnBytes(result))
    .map((v) => BigInt(v));
}

export async function getAccountPositionIds(
  client: PredictClient,
  params: ViewBaseParams & { accountId: string; marketKey: bigint | number | string },
): Promise<bigint[]> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::account_position_ids`,
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.pure.id(params.accountId),
      tx.pure.u64(toBigInt(params.marketKey)),
    ],
  });
  const result = await client.simulate(tx);
  return bcs
    .vector(bcs.u64())
    .parse(extractReturnBytes(result))
    .map((v) => BigInt(v));
}

export async function getAccountOrderIdsByMarketId(
  client: PredictClient,
  params: ViewBaseParams & { accountId: string; marketId: MarketIdInput },
): Promise<bigint[]> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::account_order_ids_by_market_id`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.pure.id(params.accountId),
      marketIdArg(tx, params.marketId),
    ],
  });
  const result = await client.simulate(tx);
  return bcs
    .vector(bcs.u64())
    .parse(extractReturnBytes(result))
    .map((v) => BigInt(v));
}

export async function getAccountPositionIdsByMarketId(
  client: PredictClient,
  params: ViewBaseParams & { accountId: string; marketId: MarketIdInput },
): Promise<bigint[]> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::account_position_ids_by_market_id`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.pure.id(params.accountId),
      marketIdArg(tx, params.marketId),
    ],
  });
  const result = await client.simulate(tx);
  return bcs
    .vector(bcs.u64())
    .parse(extractReturnBytes(result))
    .map((v) => BigInt(v));
}

export async function isKeeper(
  client: PredictClient,
  params: { packageId?: string; globalConfig?: string; keeper: string },
): Promise<boolean> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::global_config::is_keeper`,
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      tx.pure.address(params.keeper),
    ],
  });
  const result = await client.simulate(tx);
  return bcs.bool().parse(extractReturnBytes(result));
}

export async function getKeeperAddresses(
  client: PredictClient,
  params: { packageId?: string; globalConfig?: string } = {},
): Promise<string[]> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::global_config::keeper_addresses`,
    arguments: [tx.object(resolveGlobalConfig(client, params.globalConfig))],
  });
  const result = await client.simulate(tx);
  return bcs.vector(bcs.Address).parse(extractReturnBytes(result));
}

export async function getAllowedVersions(
  client: PredictClient,
  params: { packageId?: string; globalConfig?: string } = {},
): Promise<number[]> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::global_config::allowed_versions`,
    arguments: [tx.object(resolveGlobalConfig(client, params.globalConfig))],
  });
  const result = await client.simulate(tx);
  return bcs
    .vector(bcs.u16())
    .parse(extractReturnBytes(result))
    .map((v) => Number(v));
}

export async function isPredictionProtocolAssetAllowed(
  client: PredictClient,
  params: {
    accountPackageId?: string;
    accountRegistry?: string;
    predictionPackageId?: string;
    coinType?: string;
  } = {},
): Promise<boolean> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolveAccountPackageId(client, params.accountPackageId)}::account::is_protocol_asset_allowed`,
    typeArguments: [
      `${resolvePackageId(client, params.predictionPackageId)}::account_data::WaterXPrediction`,
      params.coinType ?? client.settlementCoinType(),
    ],
    arguments: [tx.object(resolveAccountRegistry(client, params.accountRegistry))],
  });
  const result = await client.simulate(tx);
  return bcs.bool().parse(extractReturnBytes(result));
}

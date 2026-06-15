/**
 * Read-only queries built on top of `waterx_perp_view`.
 *
 * Each helper builds a one-shot PTB, runs `client.simulate(tx)`, and
 * decodes the first command's return values into the matching generated
 * BCS struct. The simulated sender is the zero address.
 */

import { fromBase64 } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "./client.ts";
import { DRY_RUN_SENDER } from "./constants.ts";
import {
  burnFeeRate as burnFeeRateCall,
  creditSupply as creditSupplyCall,
  hasAsset as hasAssetCall,
  mintFeeRate as mintFeeRateCall,
} from "./generated/native_custody/custody_vault.ts";
import {
  accountBalance as accountBalanceCall,
  accountIds as accountIdsCall,
} from "./generated/waterx_account/account.ts";
import {
  AccountData,
  accountData as accountDataCall,
  getAccountOrders as getAccountOrdersCall,
  getAccountPositions as getAccountPositionsCall,
  getMarketOrders as getMarketOrdersCall,
  getMarketPositions as getMarketPositionsCall,
  getRedeemRequests as getRedeemRequestsCall,
  GlobalConfigData,
  globalConfigData as globalConfigDataCall,
  MarketData,
  marketData as marketDataCall,
  OrderData,
  orderData as orderDataCall,
  PoolData,
  poolData as poolDataCall,
  PositionData,
  positionData as positionDataCall,
  positionExists as positionExistsCall,
  RedeemRequestData,
  TokenPoolData,
  tokenPoolData as tokenPoolDataCall,
} from "./generated/waterx_perp_view/view.ts";
// ============================================================================
// Referral queries (waterx_referral::referral_table)
// ============================================================================

import {
  isValidReferralCode as isValidReferralCodeCall,
  referralCodeExists as referralCodeExistsCall,
  tryGetRefer as tryGetReferCall,
} from "./generated/waterx_referral/referral_table.ts";
import {
  bridgeFeeAmount as bridgeFeeAmountCall,
  bridgeFeeRate as bridgeFeeRateCall,
  bridgeMinFee as bridgeMinFeeCall,
  wouldExecuteWormhole as wouldExecuteWormholeCall,
} from "./generated/withdrawal_queue/withdrawal_queue.ts";
import {
  dailyBurned as dailyBurnedCall,
  dailyBurnLimit as dailyBurnLimitCall,
  dailyMinted as dailyMintedCall,
  dailyMintLimit as dailyMintLimitCall,
  maxBurnPerTx as maxBurnPerTxCall,
  maxMintPerTx as maxMintPerTxCall,
  mintedFor as mintedForCall,
  paused as pausedCall,
  personalBurnCapAmount as personalBurnCapAmountCall,
  personalBurned as personalBurnedCall,
} from "./generated/wormhole_bridge/wormhole_bridge.ts";

// ============================================================================
// Simulate / decode helpers
// ============================================================================

interface SimulationCommandResult {
  returnValues?: { bcs?: Uint8Array | string; value?: { bcs?: Uint8Array | string } }[];
}

interface SimulationResult {
  $kind?: string;
  FailedTransaction?: {
    status?: { error?: { message?: string } };
  };
  commandResults?: SimulationCommandResult[] | null;
}

function toBytes(b: Uint8Array | string | undefined): Uint8Array | undefined {
  if (!b) return undefined;
  if (typeof b === "string") return fromBase64(b);
  // gRPC returns Uint8Array; JSON-RPC serialization may turn it into a
  // numeric-indexed object. Normalize both.
  if (b instanceof Uint8Array) return b;
  return new Uint8Array(Object.values(b as Record<string, number>));
}

async function simulateRaw(client: WaterXClient, tx: Transaction): Promise<SimulationResult> {
  tx.setSender(DRY_RUN_SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  if (sim.$kind === "FailedTransaction") {
    const err = sim.FailedTransaction?.status?.error?.message ?? "FailedTransaction";
    throw new Error(`simulate aborted: ${err}`);
  }
  return sim;
}

function extractAt(sim: SimulationResult, commandIndex: number, returnIndex = 0): Uint8Array {
  const ret = sim.commandResults?.[commandIndex]?.returnValues?.[returnIndex];
  const bytes = toBytes(ret?.bcs) ?? toBytes(ret?.value?.bcs);
  if (!bytes) {
    throw new Error(
      `simulate returned no BCS value at commandResults[${commandIndex}].returnValues[${returnIndex}]`,
    );
  }
  return bytes;
}

async function simulateAndExtract(
  client: WaterXClient,
  tx: Transaction,
  commandIndex = 0,
  returnIndex = 0,
): Promise<Uint8Array> {
  const sim = await simulateRaw(client, tx);
  return extractAt(sim, commandIndex, returnIndex);
}

function withLp(client: WaterXClient, lpType?: string): string {
  return lpType ?? client.wlpType();
}

// ============================================================================
// Account
// ============================================================================

export type AccountDataView = ReturnType<typeof AccountData.parse>;

/**
 * Look up the registered AccountData for a given wxa account ID.
 * Returns `undefined` if the account has no perp data slot installed yet
 * (the slot auto-installs on the first `add_position` / `add_order`).
 * The underlying view fn returns `Option<AccountData>`.
 */
export async function getAccountData(
  client: WaterXClient,
  accountId: string,
): Promise<AccountDataView | undefined> {
  const tx = new Transaction();
  accountDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId,
    },
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  const opt = bcs.option(AccountData).parse(bytes);
  return opt ?? undefined;
}

// ============================================================================
// Market / Pool / Token pool
// ============================================================================

export type MarketDataView = ReturnType<typeof MarketData.parse>;
export type PoolDataView = ReturnType<typeof PoolData.parse>;
export type TokenPoolDataView = ReturnType<typeof TokenPoolData.parse>;
export type GlobalConfigDataView = ReturnType<typeof GlobalConfigData.parse>;

export async function getMarketData(
  client: WaterXClient,
  args: { ticker: string; lpType?: string },
): Promise<MarketDataView> {
  const tx = new Transaction();
  marketDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return MarketData.parse(await simulateAndExtract(client, tx));
}

export async function getPoolData(
  client: WaterXClient,
  args: { lpType?: string } = {},
): Promise<PoolDataView> {
  const tx = new Transaction();
  poolDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: { pool: tx.object(client.config.packages.wlp.wlp_pool) },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return PoolData.parse(await simulateAndExtract(client, tx));
}

export async function getTokenPoolData(
  client: WaterXClient,
  args: { tokenIndex: bigint | number; lpType?: string },
): Promise<TokenPoolDataView> {
  const tx = new Transaction();
  tokenPoolDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      tokenIndex: args.tokenIndex,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return TokenPoolData.parse(await simulateAndExtract(client, tx));
}

export async function getGlobalConfigData(client: WaterXClient): Promise<GlobalConfigDataView> {
  const tx = new Transaction();
  globalConfigDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: { cfg: tx.object(client.config.packages.waterx_perp.global_config) },
  })(tx);
  return GlobalConfigData.parse(await simulateAndExtract(client, tx));
}

// ============================================================================
// Position
// ============================================================================

export type PositionDataView = ReturnType<typeof PositionData.parse>;

export async function positionExists(
  client: WaterXClient,
  args: { ticker: string; positionId: bigint | number; lpType?: string },
): Promise<boolean> {
  const tx = new Transaction();
  positionExistsCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      positionId: args.positionId,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  return bcs.bool().parse(bytes);
}

export async function getPosition(
  client: WaterXClient,
  args: {
    ticker: string;
    positionId: bigint | number;
    /** Human-readable USD prices for Pnl / liq price calc; pass 0n if unsure. */
    basePriceUsd: bigint | number;
    collateralPriceUsd: bigint | number;
    lpType?: string;
  },
): Promise<PositionDataView> {
  const tx = new Transaction();
  positionDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      basePriceUsd: args.basePriceUsd,
      collateralPriceUsd: args.collateralPriceUsd,
      positionId: args.positionId,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return PositionData.parse(await simulateAndExtract(client, tx));
}

// ============================================================================
// Order
// ============================================================================

export type OrderDataView = ReturnType<typeof OrderData.parse>;

export async function getOrder(
  client: WaterXClient,
  args: {
    ticker: string;
    orderId: bigint | number;
    orderTypeTag: number;
    triggerPrice: bigint | number;
    basePriceUsd: bigint | number;
    lpType?: string;
  },
): Promise<OrderDataView> {
  const tx = new Transaction();
  orderDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      basePriceUsd: args.basePriceUsd,
      orderTypeTag: args.orderTypeTag,
      triggerPrice: args.triggerPrice,
      orderId: args.orderId,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return OrderData.parse(await simulateAndExtract(client, tx));
}

// ============================================================================
// Paginated lists
// ============================================================================

export interface PageOpts {
  cursor?: bigint | number;
  pageSize?: bigint | number;
}

export async function getMarketOrders(
  client: WaterXClient,
  args: {
    ticker: string;
    basePriceUsd?: bigint | number;
    lpType?: string;
  } & PageOpts,
): Promise<{ orders: OrderDataView[]; nextCursor?: bigint }> {
  const tx = new Transaction();
  getMarketOrdersCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      basePriceUsd: args.basePriceUsd ?? 0n,
      cursor: args.cursor ?? 0n,
      pageSize: args.pageSize ?? 100n,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);

  tx.setSender(DRY_RUN_SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  const ret = sim.commandResults?.[0]?.returnValues;
  if (!ret) return { orders: [] };
  const ordersBytes = toBytes(ret[0]?.bcs) ?? toBytes(ret[0]?.value?.bcs);
  const cursorBytes = toBytes(ret[1]?.bcs) ?? toBytes(ret[1]?.value?.bcs);
  if (!ordersBytes) return { orders: [] };
  const ordersBuf = ordersBytes;
  const orders = bcs.vector(OrderData).parse(ordersBuf);
  let nextCursor: bigint | undefined;
  if (cursorBytes) {
    const cb = cursorBytes;
    const opt = bcs.option(bcs.u64()).parse(cb);
    if (opt) nextCursor = BigInt(opt);
  }
  return { orders, nextCursor };
}

export async function getMarketPositions(
  client: WaterXClient,
  args: {
    ticker: string;
    basePriceUsd: bigint | number;
    collateralPriceUsd?: bigint | number;
    lpType?: string;
  } & PageOpts,
): Promise<{ positions: PositionDataView[]; nextCursor?: bigint }> {
  const tx = new Transaction();
  getMarketPositionsCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      basePriceUsd: args.basePriceUsd,
      collateralPriceUsd: args.collateralPriceUsd ?? 0n,
      cursor: args.cursor ?? 0n,
      pageSize: args.pageSize ?? 100n,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);

  tx.setSender(DRY_RUN_SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  const ret = sim.commandResults?.[0]?.returnValues;
  if (!ret) return { positions: [] };
  const positionsBytes = toBytes(ret[0]?.bcs) ?? toBytes(ret[0]?.value?.bcs);
  const cursorBytes = toBytes(ret[1]?.bcs) ?? toBytes(ret[1]?.value?.bcs);
  if (!positionsBytes) return { positions: [] };
  const buf = positionsBytes;
  const positions = bcs.vector(PositionData).parse(buf);
  let nextCursor: bigint | undefined;
  if (cursorBytes) {
    const cb = cursorBytes;
    const opt = bcs.option(bcs.u64()).parse(cb);
    if (opt) nextCursor = BigInt(opt);
  }
  return { positions, nextCursor };
}

export async function getAccountPositions(
  client: WaterXClient,
  args: {
    ticker: string;
    accountObjectAddress: string;
    basePriceUsd: bigint | number;
    collateralPriceUsd?: bigint | number;
    lpType?: string;
  },
): Promise<PositionDataView[]> {
  const tx = new Transaction();
  getAccountPositionsCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      basePriceUsd: args.basePriceUsd,
      collateralPriceUsd: args.collateralPriceUsd ?? 0n,
      accountObjectAddress: args.accountObjectAddress,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return bcs.vector(PositionData).parse(await simulateAndExtract(client, tx));
}

export async function getAccountOrders(
  client: WaterXClient,
  args: {
    ticker: string;
    accountObjectAddress: string;
    basePriceUsd?: bigint | number;
    lpType?: string;
  },
): Promise<OrderDataView[]> {
  const tx = new Transaction();
  getAccountOrdersCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      basePriceUsd: args.basePriceUsd ?? 0n,
      accountObjectAddress: args.accountObjectAddress,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return bcs.vector(OrderData).parse(await simulateAndExtract(client, tx));
}

export type RedeemRequestDataView = ReturnType<typeof RedeemRequestData.parse>;

export async function getRedeemRequests(
  client: WaterXClient,
  args: { lpType?: string } & PageOpts = {},
): Promise<{ requests: RedeemRequestDataView[]; nextCursor?: bigint }> {
  const tx = new Transaction();
  getRedeemRequestsCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      cursor: args.cursor ?? 0n,
      pageSize: args.pageSize ?? 100n,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);

  tx.setSender(DRY_RUN_SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  const ret = sim.commandResults?.[0]?.returnValues;
  if (!ret) return { requests: [] };
  const reqBytes = toBytes(ret[0]?.bcs) ?? toBytes(ret[0]?.value?.bcs);
  const cursorBytes = toBytes(ret[1]?.bcs) ?? toBytes(ret[1]?.value?.bcs);
  if (!reqBytes) return { requests: [] };
  const buf = reqBytes;
  const requests = bcs.vector(RedeemRequestData).parse(buf);
  let nextCursor: bigint | undefined;
  if (cursorBytes) {
    const cb = cursorBytes;
    const opt = bcs.option(bcs.u64()).parse(cb);
    if (opt) nextCursor = BigInt(opt);
  }
  return { requests, nextCursor };
}

function requireReferralPackage(client: WaterXClient): { pkg: string; table: string } {
  const pkg = client.config.packages.waterx_referral?.published_at;
  const table = client.config.packages.waterx_referral?.referral_table;
  if (!pkg || !table) {
    throw new Error(
      "referral package not configured: set config.packages.waterx_referral.{published_at,referral_table}",
    );
  }
  return { pkg, table };
}

/** Returns the referrer address bound to `referee`, or `undefined` if none. */
export async function getRefererFor(
  client: WaterXClient,
  referee: string,
): Promise<string | undefined> {
  const { pkg, table } = requireReferralPackage(client);
  const tx = new Transaction();
  tryGetReferCall({
    package: pkg,
    arguments: { table: tx.object(table), referee },
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  const opt = bcs.option(bcs.Address).parse(bytes);
  return opt ?? undefined;
}

/** True if `code` is a syntactically valid referral code (matches the contract's char rules). */
export async function isValidReferralCode(client: WaterXClient, code: string): Promise<boolean> {
  const { pkg } = requireReferralPackage(client);
  const tx = new Transaction();
  isValidReferralCodeCall({ package: pkg, arguments: { code } })(tx);
  const bytes = await simulateAndExtract(client, tx);
  return bcs.bool().parse(bytes);
}

/** True if `code` is already claimed in the on-chain ReferralTable. */
export async function referralCodeExists(client: WaterXClient, code: string): Promise<boolean> {
  const { pkg, table } = requireReferralPackage(client);
  const tx = new Transaction();
  referralCodeExistsCall({
    package: pkg,
    arguments: { table: tx.object(table), code },
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  return bcs.bool().parse(bytes);
}

// ============================================================================
// wxa account reads (waterx_account — works on credit-only deployments,
// which have no waterx_perp_view). Simulate `account::*` view functions.
// ============================================================================

/**
 * List the wxa account IDs owned by `owner` (`account::account_ids`).
 * Returns `[]` when the owner has never created an account. Use this to
 * resolve the `account_id` a cross-chain deposit must target before
 * filling the EVM `suiRecipient` field.
 */
export async function getAccountsByOwner(client: WaterXClient, owner: string): Promise<string[]> {
  const tx = new Transaction();
  accountIdsCall({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      owner,
    },
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  return bcs.vector(bcs.Address).parse(bytes);
}

/**
 * A wxa account's stored `Balance<T>` (`account::account_balance<T>`).
 * `coinType` defaults to the deployment's CREDIT type — i.e. the bridged
 * balance available to withdraw. Returns `0n` for an unknown coin type.
 */
export async function getAccountBalance(
  client: WaterXClient,
  accountId: string,
  coinType?: string,
): Promise<bigint> {
  const tx = new Transaction();
  accountBalanceCall({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId,
    },
    typeArguments: [coinType ?? client.creditType()],
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  return BigInt(bcs.u64().parse(bytes));
}

// ============================================================================
// Native custody (custody_vault)
// ============================================================================

function requireCustody(client: WaterXClient): { pkg: string; vault: string; creditType: string } {
  const nc = client.config.packages.native_custody;
  if (!nc?.vault) {
    throw new Error("native_custody not configured — set config.packages.native_custody.vault");
  }
  return { pkg: nc.published_at, vault: nc.vault, creditType: client.creditType() };
}

/** Vault-wide native-custody state. */
export interface CustodyVaultData {
  /** Total CREDIT minted by the custody vault (`credit_supply`). */
  creditSupply: bigint;
}

/** Reads vault-wide native-custody state via `custody_vault::credit_supply`. */
export async function getCustodyVaultData(client: WaterXClient): Promise<CustodyVaultData> {
  const { pkg, vault, creditType } = requireCustody(client);
  const tx = new Transaction();
  creditSupplyCall({
    package: pkg,
    arguments: { vault: tx.object(vault) },
    typeArguments: [creditType],
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  return { creditSupply: BigInt(bcs.u64().parse(bytes)) };
}

/** Per-asset native-custody state for one backing asset. */
export interface CustodyAssetData {
  /** Whether the asset is registered as a `SingleVault` on the custody vault. */
  registered: boolean;
  /** 1e9-scaled default mint fee rate (`0n` when the asset is not registered). */
  mintFeeRate: bigint;
  /** 1e9-scaled default burn fee rate (`0n` when the asset is not registered). */
  burnFeeRate: bigint;
}

/**
 * Reads per-asset native-custody state for backing asset `assetType`.
 *
 * Fee rates are the vault's default config — queried with the zero address as
 * caller, so no partner discount is applied — as 1e9-scaled `Float` values.
 * When the asset is not registered, returns `registered: false` with `0n` rates.
 *
 * Note: the `SingleVault` balance / decimal / backing / min-burn / deprecated
 * fields are not exposed here — the contract's getters for those return a
 * `&SingleVault<T>` reference, which a PTB simulate cannot read.
 */
export async function getCustodyAssetData(
  client: WaterXClient,
  assetType: string,
): Promise<CustodyAssetData> {
  const { pkg, vault, creditType } = requireCustody(client);
  const typeArguments: [string, string] = [assetType, creditType];

  const hasTx = new Transaction();
  hasAssetCall({ package: pkg, arguments: { vault: hasTx.object(vault) }, typeArguments })(hasTx);
  const registered = bcs.bool().parse(await simulateAndExtract(client, hasTx));
  if (!registered) return { registered: false, mintFeeRate: 0n, burnFeeRate: 0n };

  const mintTx = new Transaction();
  mintFeeRateCall({
    package: pkg,
    arguments: { vault: mintTx.object(vault), caller: DRY_RUN_SENDER },
    typeArguments,
  })(mintTx);
  const mintFeeRate = BigInt(bcs.u128().parse(await simulateAndExtract(client, mintTx)));

  const burnTx = new Transaction();
  burnFeeRateCall({
    package: pkg,
    arguments: { vault: burnTx.object(vault), caller: DRY_RUN_SENDER },
    typeArguments,
  })(burnTx);
  const burnFeeRate = BigInt(bcs.u128().parse(await simulateAndExtract(client, burnTx)));

  return { registered: true, mintFeeRate, burnFeeRate };
}

// ============================================================================
// Wormhole bridge (rate-limit / cap reads)
// ============================================================================

/**
 * Live rate-limit / cap snapshot read from the `wormhole_bridge::Bridge`
 * shared object. All amounts are raw base units of the bridged credit coin.
 *
 * `dailyMinted` / `dailyBurned` are the sliding-window sums as the on-chain
 * `daily_minted` / `daily_burned` views report them — buckets that rotated
 * out of the trailing window are evicted lazily on the next mint/burn, so
 * these can read slightly high until then (conservative).
 */
export interface BridgeLimitsView {
  paused: boolean;
  dailyMintLimit: bigint;
  dailyMinted: bigint;
  maxMintPerTx: bigint;
  dailyBurnLimit: bigint;
  dailyBurned: bigint;
  maxBurnPerTx: bigint;
  /** Per-account 24h burn cap; 0n means the gate is disabled. */
  personalBurnCapAmount: bigint;
  /** Present only when `accountId` is supplied — burn counted in that
   *  account's current window (the per-account cap key is the account id). */
  personalBurned?: bigint;
  /** Present only when `backing` is supplied — `minted_for(chainId, token)`,
   *  the amount currently withdrawable to that EVM (chain, token). */
  backingMinted?: bigint;
}

export interface BridgeLimitsArgs {
  /** wxa trading account id — enables the per-account `personalBurned` read. */
  accountId?: string;
  /** Wormhole destination chain id + 20-byte EVM token — enables the
   *  `mintedFor` backing read. */
  backing?: { wormholeChainId: number; token: Uint8Array | number[] };
}

/**
 * Batched read of the bridge's rate-limit / cap state in a single simulate.
 * Pass `accountId` to also fetch the per-account burn usage, and `backing`
 * to also fetch the destination-chain backing (`minted_for`).
 *
 * Throws if `wormhole_bridge` (or its `Bridge` object id) is absent from the
 * canonical config — e.g. on a network where the Sui bridge isn't published.
 */
export async function getBridgeLimits(
  client: WaterXClient,
  args: BridgeLimitsArgs = {},
): Promise<BridgeLimitsView> {
  const pkg = client.config.packages.wormhole_bridge;
  if (!pkg?.bridge) {
    throw new Error(
      "wormhole_bridge is not deployed on this network (no `bridge` object id in config)",
    );
  }
  const packageId = pkg.published_at;
  const bridge = pkg.bridge;

  const tx = new Transaction();
  // Fixed-order view calls; indices tracked below.
  pausedCall({ package: packageId, arguments: { bridge } })(tx); // 0
  dailyMintLimitCall({ package: packageId, arguments: { bridge } })(tx); // 1
  dailyMintedCall({ package: packageId, arguments: { bridge } })(tx); // 2
  maxMintPerTxCall({ package: packageId, arguments: { bridge } })(tx); // 3
  dailyBurnLimitCall({ package: packageId, arguments: { bridge } })(tx); // 4
  dailyBurnedCall({ package: packageId, arguments: { bridge } })(tx); // 5
  maxBurnPerTxCall({ package: packageId, arguments: { bridge } })(tx); // 6
  personalBurnCapAmountCall({ package: packageId, arguments: { bridge } })(tx); // 7

  let backingIdx = -1;
  if (args.backing) {
    backingIdx = 8;
    mintedForCall({
      package: packageId,
      arguments: {
        bridge,
        chainId: args.backing.wormholeChainId,
        token: Array.from(args.backing.token),
      },
    })(tx);
  }

  let personalIdx = -1;
  if (args.accountId) {
    personalIdx = backingIdx === -1 ? 8 : 9;
    // Clock (0x6) is auto-injected by the generated wrapper.
    personalBurnedCall({
      package: packageId,
      arguments: { bridge, user: args.accountId },
    })(tx);
  }

  const sim = await simulateRaw(client, tx);
  const u64At = (i: number): bigint => BigInt(bcs.u64().parse(extractAt(sim, i)));

  const view: BridgeLimitsView = {
    paused: bcs.bool().parse(extractAt(sim, 0)),
    dailyMintLimit: u64At(1),
    dailyMinted: u64At(2),
    maxMintPerTx: u64At(3),
    dailyBurnLimit: u64At(4),
    dailyBurned: u64At(5),
    maxBurnPerTx: u64At(6),
    personalBurnCapAmount: u64At(7),
  };
  if (backingIdx >= 0) view.backingMinted = u64At(backingIdx);
  if (personalIdx >= 0) view.personalBurned = u64At(personalIdx);
  return view;
}

// ============================================================================
// Withdrawal queue — bridge fee estimate (withdrawal_queue v4)
// ============================================================================

export interface BridgeFeeView {
  /** Raw fee charged on a wormhole (Sui → EVM) exit of `amount`:
   *  `max(ceil(effectiveRate * amount), effectiveMinFee)`. */
  feeAmount: bigint;
  /** Whether the exit clears the on-chain net-zero guard — i.e. a strictly
   *  positive amount remains after the fee. Gate "estimated fee" UI on THIS,
   *  not `feeAmount` alone: a dust `amount`, or a min-fee floor ≥ `amount`,
   *  makes `feeAmount >= amount` and the exit would abort (audit L1). */
  wouldExecute: boolean;
  /** Effective % rate for the chain (per-chain override → default → 0),
   *  1e9-scaled (the `Float`-as-`u128` ABI convention). */
  effectiveRate: bigint;
  /** Effective minimum-fee floor for the chain (override → default → 0),
   *  in CREDIT base units. */
  effectiveMinFee: bigint;
  /** Net CREDIT the recipient receives after the fee; `0n` when the exit
   *  wouldn't execute (`wouldExecute === false`). */
  netAmount: bigint;
}

function requireWithdrawalQueue(client: WaterXClient): { pkg: string; queue: string } {
  const wq = client.config.packages.withdrawal_queue;
  if (!wq?.queue) {
    throw new Error(
      "withdrawal_queue is not deployed on this network (no `queue` object id in config)",
    );
  }
  return { pkg: wq.published_at, queue: wq.queue };
}

/**
 * Estimate the bridge fee for a wormhole (Sui → EVM) CREDIT exit of `amount`
 * to `evmDestinationChain`, read in a single simulate from the on-chain
 * `withdrawal_queue` views. The charged fee is
 * `max(ceil(effectiveRate * amount), effectiveMinFee)`.
 *
 * Surface UI off `wouldExecute`, NOT `feeAmount` alone — `feeAmount` is the raw
 * fee and can equal/exceed `amount` (ceil rounding on a dust entry, or a min-fee
 * floor larger than the entry), in which case the on-chain exit aborts its
 * net-zero guard (audit L1). `netAmount` is `0n` whenever `wouldExecute` is
 * false.
 *
 * @param args.amount             CREDIT base units (the bridged coin's smallest unit).
 * @param args.evmDestinationChain WORMHOLE chain id of the destination EVM.
 * @param args.creditType         CREDIT coin type; defaults to `client.creditType()`.
 */
export async function getBridgeFee(
  client: WaterXClient,
  args: { evmDestinationChain: number; amount: bigint | number; creditType?: string },
): Promise<BridgeFeeView> {
  const { pkg, queue } = requireWithdrawalQueue(client);
  const amount = BigInt(args.amount);
  const common = {
    package: pkg,
    typeArguments: [args.creditType ?? client.creditType()] as [string],
  };
  const chain = args.evmDestinationChain;

  const tx = new Transaction();
  // Fixed-order view calls; indices tracked below.
  bridgeFeeAmountCall({
    ...common,
    arguments: { queue, evmDestinationChain: chain, amount },
  })(tx); // 0
  wouldExecuteWormholeCall({
    ...common,
    arguments: { queue, evmDestinationChain: chain, amount },
  })(tx); // 1
  bridgeFeeRateCall({ ...common, arguments: { queue, evmDestinationChain: chain } })(tx); // 2
  bridgeMinFeeCall({ ...common, arguments: { queue, evmDestinationChain: chain } })(tx); // 3

  const sim = await simulateRaw(client, tx);
  const feeAmount = BigInt(bcs.u64().parse(extractAt(sim, 0)));
  const wouldExecute = bcs.bool().parse(extractAt(sim, 1));

  return {
    feeAmount,
    wouldExecute,
    effectiveRate: BigInt(bcs.u128().parse(extractAt(sim, 2))),
    effectiveMinFee: BigInt(bcs.u64().parse(extractAt(sim, 3))),
    netAmount: wouldExecute ? amount - feeAmount : 0n,
  };
}

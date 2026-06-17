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
  personalBurnCapAmount as personalBurnCapAmountCall,
  personalBurned as personalBurnedCall,
} from "./generated/waterx_credit/credit_registry.ts";
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
  hourlyBurned as hourlyBurnedCall,
  hourlyBurnLimit as hourlyBurnLimitCall,
  hourlyMinted as hourlyMintedCall,
  hourlyMintLimit as hourlyMintLimitCall,
  maxBurnPerTx as maxBurnPerTxCall,
  maxMintPerTx as maxMintPerTxCall,
  mintedFor as mintedForCall,
  paused as pausedCall,
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

async function simulateAndExtract(
  client: WaterXClient,
  tx: Transaction,
  commandIndex = 0,
  returnIndex = 0,
): Promise<Uint8Array> {
  tx.setSender(DRY_RUN_SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  if (sim.$kind === "FailedTransaction") {
    const err = sim.FailedTransaction?.status?.error?.message ?? "FailedTransaction";
    throw new Error(`simulate aborted: ${err}`);
  }
  const cmd = sim.commandResults?.[commandIndex];
  const ret = cmd?.returnValues?.[returnIndex];
  const bytes = toBytes(ret?.bcs) ?? toBytes(ret?.value?.bcs);
  if (!bytes) {
    throw new Error(
      `simulate returned no BCS value at commandResults[${commandIndex}].returnValues[${returnIndex}]`,
    );
  }
  return bytes;
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
// Wormhole bridge limits (hourly rate windows on-chain; exposed as daily* for FE parity)
// ============================================================================

export interface GetBridgeLimitsParams {
  /** wxa account id — enables per-account `personalBurned`. */
  accountId?: string;
  /** Wormhole chain id + 20-byte EVM token — enables `backingMinted`. */
  backing?: { wormholeChainId: number; token: number[] };
}

/** On-chain bridge + credit-registry rate-limit snapshot (u64 fields). */
export interface BridgeLimitsView {
  paused: boolean;
  /** Hourly mint window cap (legacy DTO name: dailyMintLimit). */
  dailyMintLimit: bigint;
  dailyMinted: bigint;
  maxMintPerTx: bigint;
  dailyBurnLimit: bigint;
  dailyBurned: bigint;
  maxBurnPerTx: bigint;
  personalBurnCapAmount: bigint;
  personalBurned?: bigint;
  backingMinted?: bigint;
}

async function simulateAllReturnBytes(
  client: WaterXClient,
  tx: Transaction,
): Promise<(Uint8Array | undefined)[]> {
  tx.setSender(DRY_RUN_SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  if (sim.$kind === "FailedTransaction") {
    const err = sim.FailedTransaction?.status?.error?.message ?? "FailedTransaction";
    throw new Error(`simulate aborted: ${err}`);
  }
  return (sim.commandResults ?? []).map((cmd) => {
    const ret = cmd?.returnValues?.[0];
    return toBytes(ret?.bcs) ?? toBytes(ret?.value?.bcs);
  });
}

/**
 * Read wormhole_bridge rate limits + optional credit-registry personal burn +
 * optional per-(chain, token) backing minted — one devInspect PTB.
 */
export async function getBridgeLimits(
  client: WaterXClient,
  params: GetBridgeLimitsParams = {},
): Promise<BridgeLimitsView> {
  const bridgePkg = client.config.packages.wormhole_bridge;
  const bridgeId = bridgePkg?.bridge;
  if (!bridgePkg?.published_at || !bridgeId) {
    throw new Error("wormhole_bridge not configured for this deployment");
  }

  const creditPkg = client.config.packages.waterx_credit;
  const registryId = creditPkg?.credit_registry;
  const creditType = client.creditType();

  const tx = new Transaction();
  const bridgeArgs = { bridge: tx.object(bridgeId) };
  const wormholePkg = bridgePkg.published_at;

  pausedCall({ package: wormholePkg, arguments: bridgeArgs })(tx);
  hourlyMintLimitCall({ package: wormholePkg, arguments: bridgeArgs })(tx);
  hourlyMintedCall({ package: wormholePkg, arguments: bridgeArgs })(tx);
  maxMintPerTxCall({ package: wormholePkg, arguments: bridgeArgs })(tx);
  hourlyBurnLimitCall({ package: wormholePkg, arguments: bridgeArgs })(tx);
  hourlyBurnedCall({ package: wormholePkg, arguments: bridgeArgs })(tx);
  maxBurnPerTxCall({ package: wormholePkg, arguments: bridgeArgs })(tx);

  let personalCapIdx: number | undefined;
  let personalBurnedIdx: number | undefined;
  let backingIdx: number | undefined;
  let nextIdx = 7;

  if (registryId && creditPkg?.published_at) {
    personalCapIdx = nextIdx++;
    personalBurnCapAmountCall({
      package: creditPkg.published_at,
      arguments: { registry: tx.object(registryId) },
      typeArguments: [creditType],
    })(tx);
    if (params.accountId) {
      personalBurnedIdx = nextIdx++;
      personalBurnedCall({
        package: creditPkg.published_at,
        arguments: { registry: tx.object(registryId), user: params.accountId },
        typeArguments: [creditType],
      })(tx);
    }
  }

  if (params.backing) {
    backingIdx = nextIdx;
    mintedForCall({
      package: wormholePkg,
      arguments: {
        bridge: tx.object(bridgeId),
        chainId: params.backing.wormholeChainId,
        token: params.backing.token,
      },
    })(tx);
  }

  const results = await simulateAllReturnBytes(client, tx);

  const parseU64 = (idx: number): bigint => {
    const bytes = results[idx];
    if (!bytes) throw new Error(`getBridgeLimits: missing simulate result at command ${idx}`);
    return BigInt(bcs.u64().parse(bytes));
  };
  const parseBool = (idx: number): boolean => {
    const bytes = results[idx];
    if (!bytes) throw new Error(`getBridgeLimits: missing simulate result at command ${idx}`);
    return bcs.bool().parse(bytes);
  };

  const view: BridgeLimitsView = {
    paused: parseBool(0),
    dailyMintLimit: parseU64(1),
    dailyMinted: parseU64(2),
    maxMintPerTx: parseU64(3),
    dailyBurnLimit: parseU64(4),
    dailyBurned: parseU64(5),
    maxBurnPerTx: parseU64(6),
    personalBurnCapAmount: personalCapIdx !== undefined ? parseU64(personalCapIdx) : 0n,
  };

  if (personalBurnedIdx !== undefined) {
    view.personalBurned = parseU64(personalBurnedIdx);
  }
  if (backingIdx !== undefined) {
    view.backingMinted = parseU64(backingIdx);
  }

  return view;
}

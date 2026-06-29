/**
 * Market / pool / token-pool / global-config + account-data reads
 * (`waterx_perp_view`).
 */

import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import {
  AccountData,
  accountData as accountDataCall,
  GlobalConfigData,
  globalConfigData as globalConfigDataCall,
  MarketData,
  marketData as marketDataCall,
  PoolData,
  poolData as poolDataCall,
  TokenPoolData,
  tokenPoolData as tokenPoolDataCall,
} from "../../generated/waterx_perp_view/view.ts";
import type { PerpClient } from "../client.ts";
import { simulateAndExtract, withLp } from "./simulate.ts";

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
  client: PerpClient,
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
  client: PerpClient,
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
  client: PerpClient,
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
  client: PerpClient,
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

export async function getGlobalConfigData(client: PerpClient): Promise<GlobalConfigDataView> {
  const tx = new Transaction();
  globalConfigDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: { cfg: tx.object(client.config.packages.waterx_perp.global_config) },
  })(tx);
  return GlobalConfigData.parse(await simulateAndExtract(client, tx));
}

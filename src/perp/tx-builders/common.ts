/**
 * Shared scaffolding for the high-level perp `build*Tx` composers:
 * `CommonBuildOpts`, the new-or-reuse PTB helper, the WLP pool-oracle refresh,
 * and the request+execute envelope (optional Pyth-sponsor flow + pre-sweep).
 */

import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import {
  openPythSponsorFund,
  PythCache,
  refreshOraclePrices,
  reimbursePythSponsor,
} from "../../oracle/index.ts";
import { getCollateralAssets } from "../../utils/config.ts";
import type { PerpClient } from "../client.ts";
import { executeTrading } from "../user/trading.ts";
import { updateTokenValue } from "../user/wlp.ts";
import { appendConsolidateForSpend } from "./consolidate.ts";

export interface CommonBuildOpts {
  /** Append to an existing PTB instead of creating a new one. */
  tx?: Transaction;
  /** Skip oracle refresh entirely (caller manages freshness). Default: false. */
  skipOraclePriceRefresh?: boolean;
  /** Share a `PythCache` across builders to avoid redundant pyth_state reads. */
  pythCache?: PythCache;
  /**
   * Wire the `pyth_sponsor_rule` flow:
   *   - open a Fund via `pyth_sponsor_rule::request(sponsor)`
   *   - pay Pyth update fees from the Fund (instead of `tx.gas`)
   *   - reimburse leftover into the sponsor pool + attach
   *     `PythSponsorRule` witness to the TradingRequest so markets
   *     whose `request_checklist` contains `PythSponsorRule` accept it
   * Default: true (matches the testnet/mainnet checklist config).
   * Pass `false` only when the market checklist is empty.
   */
  useSponsor?: boolean;
  /**
   * Pre-sweep parked backing assets (USDC, USDsui, …) at the wxa account's
   * address into USD credit, plus any CREDIT coins/funds at the address into
   * the internal wxa slot — see {@link appendConsolidateForSpend}. Skips empty
   * buckets via gRPC probes so it's safe on any account.
   *
   * Default: `true`. Set to `false` to skip (e.g. caller already swept,
   * deployment lacks `native_custody`, or the gRPC reads aren't worth
   * the latency).
   *
   * Each enabled call adds 2 gRPC reads per configured backing asset
   * (`getBalance` + `listCoins`).
   *
   * Only honored by async builders (this is an async sweep). Sync
   * builders never auto-prepend the sweep — for those, call
   * {@link buildConsolidateToUsdTx} separately.
   */
  consolidateToUsd?: boolean;
}

interface RequestParams {
  ticker: string;
  collateralType: string;
  lpType?: string;
}

export function newTx(opts?: CommonBuildOpts): Transaction {
  return opts?.tx ?? new Transaction();
}

/**
 * Refresh every WLP pool-token oracle (+ caller-supplied extra tickers) and
 * bump each pool token's `last_price_refresh_timestamp` so the pool's
 * `assert_prices_fresh` passes when the next `mint_wlp` / `request_redeem` /
 * trading `execute` runs in the same PTB.
 */
export async function refreshWlpPoolOracles(
  tx: Transaction,
  client: PerpClient,
  extraTickers: string[],
  opts: {
    cache?: PythCache;
    sponsorFund?: { fund: TransactionArgument; packageId: string };
    lpType?: string;
  },
): Promise<void> {
  const poolTickers = getCollateralAssets(client.config);
  const oracleTickers = Array.from(new Set([...extraTickers, ...poolTickers]));
  await refreshOraclePrices(tx, client, oracleTickers, {
    cache: opts.cache,
    sponsorFund: opts.sponsorFund,
  });
  for (const tokenType of Object.values(client.config.packages.wlp.pool_tokens)) {
    updateTokenValue(client, tx, { tokenType, lpType: opts.lpType });
  }
}

/**
 * Build the *Request + execute envelope with optional Pyth sponsor flow:
 *
 *   [fund = sponsor.request()]
 *   refreshOraclePrices(..., sponsorFund?)
 *   req = buildRequest()
 *   [sponsor.reimburse(fund, req)]
 *   trading::execute(req)
 */
export async function wrapRequestAndExecute(
  client: PerpClient,
  tx: Transaction,
  req: RequestParams & { accountId: string },
  collateralTicker: string,
  opts: CommonBuildOpts | undefined,
  buildRequest: (sponsorFund?: {
    fund: TransactionArgument;
    packageId: string;
  }) => TransactionArgument,
): Promise<void> {
  await maybeConsolidate(client, tx, req.accountId, opts);

  const useSponsor = opts?.useSponsor ?? true;
  let sponsorFund: { fund: TransactionArgument; packageId: string } | undefined;
  if (useSponsor) sponsorFund = openPythSponsorFund(tx, client);

  if (!opts?.skipOraclePriceRefresh) {
    await refreshWlpPoolOracles(tx, client, [req.ticker, collateralTicker], {
      cache: opts?.pythCache,
      sponsorFund,
      lpType: req.lpType,
    });
  }

  const tradingReq = buildRequest(sponsorFund);

  if (sponsorFund) {
    reimbursePythSponsor(tx, client, sponsorFund.fund, tradingReq, req.collateralType);
  }

  executeTrading(client, tx, {
    ticker: req.ticker,
    collateralType: req.collateralType,
    lpType: req.lpType,
    request: tradingReq,
  });
}

/** Run the async sweep iff `consolidateToUsd !== false`. */
export async function maybeConsolidate(
  client: PerpClient,
  tx: Transaction,
  accountId: string,
  opts: CommonBuildOpts | undefined,
): Promise<void> {
  if (opts?.consolidateToUsd === false) return;
  await appendConsolidateForSpend(client, tx, accountId);
}

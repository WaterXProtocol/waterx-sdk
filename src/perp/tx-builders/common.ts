/**
 * Shared scaffolding for the high-level perp `build*Tx` composers:
 * `CommonBuildOpts`, the new-or-reuse PTB helper, the WLP pool-oracle refresh,
 * and the request+execute envelope (optional pre-sweep).
 */

import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import { appendConsolidateForSpend } from "../../account/funding/consolidate.ts";
import { refreshOraclePrices, type UpdateDataProvider } from "../../oracle/index.ts";
import type { PerpClient } from "../client.ts";
import { executeTrading } from "../user/trading.ts";
import { updateTokenValue } from "../user/wlp.ts";

export interface CommonBuildOpts {
  /** Append to an existing PTB instead of creating a new one. */
  tx?: Transaction;
  /**
   * Skip oracle refresh entirely (caller manages freshness). Default: false.
   *
   * This is the SHARED-REFRESH composition lever: a caller batching several
   * builders into one PTB refreshes once, up front, then passes the same `tx`
   * to each builder with this flag set —
   *
   *   const tx = new Transaction();
   *   await refreshOraclePrices(tx, client.perp, allTickers);
   *   await buildIncreasePositionTx(client.perp, { ...a, tx, skipOraclePriceRefresh: true });
   *   await buildPlaceOrderTx(client.perp, { ...b, tx, skipOraclePriceRefresh: true });
   *
   * — one refresh covering `allTickers` (every builder's market + collateral
   * tickers + the WLP pool tokens) instead of N. This is not just a gas
   * saving: under `waterx_rule` a repeated per-builder refresh would submit
   * the same signed timestamp twice per symbol in one PTB, paying full
   * verification for an on-chain abstain (the F-014 per-symbol replay
   * high-water mark). NEVER share one fetched waterx envelope across two
   * CONCURRENT builds for the same symbol, though — across transactions a
   * replayed timestamp ABORTS `EReplayedSignature` on the single-rule feed
   * entries.
   */
  skipOraclePriceRefresh?: boolean;
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
  /**
   * BE prefetch-cache seam for the oracle update-data fetch — forwarded
   * verbatim into `refreshOraclePrices`'s `updateDataProvider` opt (see
   * `UpdateDataProvider` in `oracle/price-update-rule.ts`). Default: none
   * (always a live fetch). A caller-supplied provider that misses or throws
   * still falls back to a live fetch — this option can only make a refresh
   * faster, never break it.
   */
  updateDataProvider?: UpdateDataProvider;
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
    lpType?: string;
    updateDataProvider?: UpdateDataProvider;
  },
): Promise<void> {
  const poolTickers = client.pricedPoolTickers();
  const oracleTickers = Array.from(new Set([...extraTickers, ...poolTickers]));
  await refreshOraclePrices(tx, client, oracleTickers, {
    updateDataProvider: opts.updateDataProvider,
  });
  for (const tokenType of Object.values(client.config.packages.wlp.pool_tokens)) {
    updateTokenValue(client, tx, { tokenType, lpType: opts.lpType });
  }
}

/**
 * Build the *Request + execute envelope:
 *
 *   [maybeConsolidate(tx)]
 *   refreshOraclePrices(...)
 *   req = buildRequest()
 *   trading::execute(req)
 *
 * Accepted ordering caveat: `maybeConsolidate` runs FIRST and can itself
 * append PTB commands (the consolidation sweep) before the refresh's own
 * pre-checks run — so a throw out of `refreshOraclePrices` here is NOT the
 * "zero commands appended" guarantee it gives its own callers (see its
 * docblock in `aggregate.ts`); `tx` can already carry the sweep. This is the
 * same discard-tx-on-throw contract every `build*Tx` composer already has for
 * mid-build on-chain-read failures — not a new hole. It matters only for a
 * caller that passed in their OWN `opts.tx` (reusing one `Transaction`
 * across builder calls, e.g. to compose several actions in one PTB); such a
 * caller must discard the whole `tx` on any throw from this function, not
 * just retry the failed step.
 */
export async function wrapRequestAndExecute(
  client: PerpClient,
  tx: Transaction,
  req: RequestParams & { accountId: string },
  collateralTicker: string,
  opts: CommonBuildOpts | undefined,
  buildRequest: () => TransactionArgument,
): Promise<void> {
  await maybeConsolidate(client, tx, req.accountId, opts);

  if (!opts?.skipOraclePriceRefresh) {
    await refreshWlpPoolOracles(tx, client, [req.ticker, collateralTicker], {
      lpType: req.lpType,
      updateDataProvider: opts?.updateDataProvider,
    });
  }

  const tradingReq = buildRequest();

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

/**
 * Shared scaffolding for the high-level perp `build*Tx` composers:
 * `CommonBuildOpts`, the new-or-reuse PTB helper, the WLP pool-oracle refresh,
 * and the request+execute envelope (pre-sweep + refresh + execute).
 */

import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import { appendConsolidateForSpend } from "../../account/funding/consolidate.ts";
import {
  OracleTickerUnservedError,
  refreshOraclePrices,
  type OracleRefreshSummary,
  type UpdateDataProvider,
} from "../../oracle/index.ts";
import { getCollateralAssets } from "../../utils/config.ts";
import type { PerpClient } from "../client.ts";
import { executeTrading } from "../user/trading.ts";
import { updateTokenValue } from "../user/wlp.ts";

export interface CommonBuildOpts {
  /** Append to an existing PTB instead of creating a new one. */
  tx?: Transaction;
  /** Skip oracle refresh entirely (caller manages freshness). Default: false. */
  skipOraclePriceRefresh?: boolean;
  /**
   * Proceed even when a ticker this transaction DEPENDS ON received no oracle
   * leg — i.e. `refreshOraclePrices` reported it as `skipped` because no
   * listed source could price it. Default `false`: the build throws
   * {@link OracleTickerUnservedError} rather than append a trade / mint /
   * redeem that would execute against whatever price the `Oracle` already
   * holds (which can still be inside the on-chain freshness window, so the
   * action succeeds at a stale price instead of failing).
   *
   * Set `true` only to deliberately accept the pre-existing on-chain price.
   * Unrelated to `skipOraclePriceRefresh`, which bypasses the refresh
   * entirely and implies the same acceptance.
   */
  allowUnrefreshedPrices?: boolean;
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
 *
 * Returns the refresh summary, and callers MUST act on it — this function
 * appends `update_token_value` for every configured pool token
 * unconditionally, including tokens this refresh did not price. That call
 * re-stamps `last_price_refresh_timestamp` with `clock.timestamp_ms()` off
 * the price the `Oracle` already holds, so `assert_prices_fresh` passes
 * afterwards either way: **the chain does NOT reject a stale pool price on
 * this path.** Use {@link assertTickersRefreshed} for the tickers an action
 * names, and {@link assertWlpPoolRefreshed} for anything that values the pool
 * (mint / redeem).
 */
export async function refreshWlpPoolOracles(
  tx: Transaction,
  client: PerpClient,
  extraTickers: string[],
  opts: {
    lpType?: string;
    updateDataProvider?: UpdateDataProvider;
  },
): Promise<OracleRefreshSummary> {
  const poolTickers = getCollateralAssets(client.config);
  const oracleTickers = Array.from(new Set([...extraTickers, ...poolTickers]));
  const summary = await refreshOraclePrices(tx, client, oracleTickers, {
    updateDataProvider: opts.updateDataProvider,
  });
  for (const tokenType of Object.values(client.config.packages.wlp.pool_tokens)) {
    updateTokenValue(client, tx, { tokenType, lpType: opts.lpType });
  }
  return summary;
}

/**
 * Fail the build when any ACTION-CRITICAL ticker went unpriced.
 *
 * `required` is the subset of the refresh the appended action reads — the
 * traded market + its collateral, or a WLP deposit/redeem ticker — never the
 * whole refreshed set: a pool token no source prices is the pool's own
 * `assert_prices_fresh` problem, and failing the build on it would take down
 * every unrelated trade.
 *
 * No-op under `allowUnrefreshedPrices`. Runs AFTER the refresh appended its
 * commands, so `tx` is already dirty on throw — the same discard-tx-on-throw
 * contract every composer has (see {@link wrapRequestAndExecute}).
 */
export function assertTickersRefreshed(
  client: PerpClient,
  summary: OracleRefreshSummary,
  required: string[],
  opts: CommonBuildOpts | undefined,
): void {
  if (opts?.allowUnrefreshedPrices) return;
  const skipped = new Set(summary.skipped);
  const unserved = [...new Set(required)].filter((ticker) => skipped.has(ticker));
  if (unserved.length > 0) {
    throw new OracleTickerUnservedError(unserved, client.oracleSources);
  }
}

/**
 * Fail the build when ANY WLP pool asset went unpriced.
 *
 * Stricter than {@link assertTickersRefreshed}, and deliberately so: `mint_wlp`
 * sizes the LP payout against the pool's **whole** `pricing_tvl_usd` /
 * `pool.tvl_usd` (it takes `&WlpAum`), so a stale price on ANY pool asset
 * mis-mints — not just on the deposit ticker.
 *
 * The on-chain guard does NOT catch this. `refreshWlpPoolOracles` appends
 * `update_token_value` for every pool token, and that call re-stamps
 * `last_price_refresh_timestamp` with `clock.timestamp_ms()` off whatever
 * price the `Oracle` already holds — so `assert_prices_fresh` passes
 * afterwards whether or not this PTB actually refreshed that asset. The build
 * is the only place the gap can be caught.
 *
 * Two distinct failures, both fatal:
 *
 * 1. A pool asset whose ticker no listed source served — it is in
 *    `summary.skipped`.
 * 2. A pool asset the config wires NO ready rule for — `getCollateralAssets`
 *    drops it before the refresh, so it never even reaches `skipped`. Silent
 *    without this check.
 */
export function assertWlpPoolRefreshed(
  client: PerpClient,
  summary: OracleRefreshSummary,
  opts: CommonBuildOpts | undefined,
): void {
  if (opts?.allowUnrefreshedPrices) return;
  const priceable = new Set(getCollateralAssets(client.config));
  const skipped = new Set(summary.skipped);
  const poolTickers = Object.keys(client.config.packages.wlp.pool_tokens);
  const unpriceable = poolTickers.filter((ticker) => !priceable.has(ticker));
  const unserved = poolTickers.filter((ticker) => skipped.has(ticker));
  if (unpriceable.length === 0 && unserved.length === 0) return;
  throw new OracleTickerUnservedError(
    [...new Set([...unpriceable, ...unserved])],
    client.oracleSources,
    unpriceable.length > 0
      ? `WLP pool asset(s) ${unpriceable.join(", ")} have no fully-wired oracle rule in ` +
          "this config at all, so they never reached the refresh."
      : "They are WLP pool assets, and mint/redeem values the whole pool.",
  );
}

/**
 * Build the *Request + execute envelope:
 *
 *   [maybeConsolidate(tx)]
 *   refreshOraclePrices(...)      // throws if the traded ticker went unpriced
 *   req = buildRequest()
 *   trading::execute(req)
 *
 * No fee leg: Pyth Core was the only source that charged an on-chain update
 * fee, and it (with `pyth_sponsor_rule`) is gone — every remaining source
 * verifies a signature and pays nothing.
 *
 * `maybeConsolidate` runs FIRST and can itself append PTB commands (the
 * consolidation sweep) before anything downstream can fail, so `tx` may
 * already carry commands when this function throws. That is the same
 * discard-tx-on-throw contract every `build*Tx` composer already has for
 * mid-build on-chain-read failures. It matters only for a caller that passed
 * in their OWN `opts.tx` (reusing one `Transaction` across builder calls, e.g.
 * to compose several actions in one PTB); such a caller must discard the whole
 * `tx` on any throw from this function, not just retry the failed step.
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
    const summary = await refreshWlpPoolOracles(tx, client, [req.ticker, collateralTicker], {
      lpType: req.lpType,
      updateDataProvider: opts?.updateDataProvider,
    });
    // The traded market and its collateral are what `execute` prices against —
    // proceeding on a stale price for either is exactly the silent-loss case.
    assertTickersRefreshed(client, summary, [req.ticker, collateralTicker], opts);
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

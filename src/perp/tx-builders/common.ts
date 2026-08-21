/**
 * Shared scaffolding for the high-level perp `build*Tx` composers:
 * `CommonBuildOpts`, the new-or-reuse PTB helper, the WLP pool-oracle refresh,
 * and the request+execute envelope (optional pre-sweep).
 */

import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import { appendConsolidateForSpend } from "../../account/funding/consolidate.ts";
import {
  OracleTickerUnservedError,
  partitionServableTickers,
  refreshOraclePrices,
  type OracleRefreshSummary,
  type UpdateDataProvider,
} from "../../oracle/index.ts";
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
   * high-water mark).
   *
   * Sharing one fetched waterx snapshot across CONCURRENT builds is safe on
   * these paths: every builder here feeds through `collect_*`, where a
   * replayed per-symbol timestamp ABSTAINS rather than aborting — the chain
   * already holds a price at least that fresh. `EReplayedSignature` is raised
   * only by the single-rule `feed_*` entries, which no `build*Tx` uses. The
   * cost of sharing is a contribution that does not count, not a failed
   * transaction.
   */
  skipOraclePriceRefresh?: boolean;
  /**
   * Build even when a ticker this action depends on could not be refreshed.
   *
   * `refreshOraclePrices` SKIPS tickers no listed source serves (it is a broad
   * primitive — losing 29 tickers because the 30th is unconfigured is the wrong
   * trade). The composers then fail closed on the subset their specific action
   * actually depends on. This opts out of that check, building against whatever
   * price the chain already holds.
   *
   * Rarely correct. The on-chain guards do NOT cover for it: `mint_wlp` sizes
   * the payout off `pool.tvl_usd`, and `assert_prices_fresh` only compares each
   * token's `last_price_refresh_timestamp` against
   * `price_refresh_threshold_ms` — so a pool asset last refreshed by SOMEONE
   * ELSE minutes ago passes, and the mint is valued off that stale price.
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
 * Fail the build when a ticker THIS action depends on went unrefreshed.
 *
 * The split of responsibility: `refreshOraclePrices` skips (it cannot know
 * which of its tickers were load-bearing), the composer asserts (it does).
 */
export function assertTickersRefreshed(
  client: PerpClient,
  summary: OracleRefreshSummary,
  required: string[],
  opts: CommonBuildOpts | undefined,
  /** Appended to the error, to say why THESE tickers were load-bearing. */
  why?: string,
): void {
  if (opts?.allowUnrefreshedPrices) return;
  const skipped = new Set(summary.skipped);
  const unserved = [...new Set(required)].filter((ticker) => skipped.has(ticker));
  if (unserved.length > 0) {
    throw new OracleTickerUnservedError(unserved, client.oracleSources, why);
  }
}

/**
 * Fail the build when ANY WLP pool asset went unpriced — stricter than
 * {@link assertTickersRefreshed}, and deliberately so.
 *
 * `mint_wlp` / `settle_redeem` take `&WlpAum` and size the payout against the
 * pool's WHOLE `tvl_usd`, so a stale price on any pool asset mis-values the
 * trade — not just a stale price on the deposit ticker.
 *
 * Nothing on chain catches the gap. Two paths, neither of which fails:
 *   - the asset IS bumped: `update_token_value` calls `oracle::get_price`,
 *     which aborts `EStalePrice` unless this PTB aggregated it — loud, safe;
 *   - the asset is NOT bumped (it was skipped, so no leg was emitted): its
 *     `last_price_refresh_timestamp` keeps whatever a previous transaction
 *     left, and `assert_prices_fresh` only asks that it be within
 *     `price_refresh_threshold_ms`. A recent-enough stale price PASSES.
 *
 * So the silent case is exactly the skipped one, and the build is the only
 * place it can be caught.
 */
export function assertWlpPoolRefreshed(
  client: PerpClient,
  summary: OracleRefreshSummary,
  opts: CommonBuildOpts | undefined,
): void {
  // Every pool asset is required — that IS the WLP-specific part. The general
  // assert does the rest; there is no second class of fault to detect, because
  // `refreshWlpPoolOracles` requests the whole pool, so anything this client
  // cannot price is necessarily in `summary.skipped` already.
  assertTickersRefreshed(
    client,
    summary,
    Object.keys(client.config.packages.wlp?.pool_tokens ?? {}),
    opts,
    "They are WLP pool assets, and mint/redeem values the WHOLE pool. ",
  );
}

/**
 * Refresh every WLP pool-token oracle (+ caller-supplied extra tickers) and
 * bump each pool token's `last_price_refresh_timestamp` so the pool's
 * `assert_prices_fresh` passes when the next `mint_wlp` / `request_redeem` /
 * trading `execute` runs in the same PTB.
 *
 * Fails closed via {@link assertWlpPoolRefreshed} — see there for why a gap is
 * otherwise silent rather than an on-chain abort.
 */
export async function refreshWlpPoolOracles(
  tx: Transaction,
  client: PerpClient,
  extraTickers: string[],
  /** The build's options — `lpType`, plus `allowUnrefreshedPrices` / `updateDataProvider`. */
  opts: CommonBuildOpts & { lpType?: string },
): Promise<OracleRefreshSummary> {
  // EVERY pool asset is requested, not a pre-filtered subset. Filtering here
  // was the bug: a token the fed set cannot price was dropped from BOTH the
  // refresh and the bump, so nothing on chain objected (see
  // `assertWlpPoolRefreshed` for why `assert_prices_fresh` lets that through)
  // and the mint was valued off a stale price. Ask for all of them, fail the
  // build on any gap, then bump.
  const poolTokens = client.config.packages.wlp?.pool_tokens ?? {};
  // `refreshOraclePrices` dedupes its own input, so a plain concat is enough.
  const oracleTickers = [...extraTickers, ...Object.keys(poolTokens)];

  // Fail closed BEFORE the fetch, on EVERYTHING this build depends on.
  //
  // `refreshOraclePrices` no longer throws on an unservable ticker (it skips
  // and reports), so nothing is gained by waiting for it — and waiting costs
  // the full off-chain fetch plus every collector/aggregate moveCall appended
  // to a caller-supplied `tx`, all discarded on the throw. The predicate is
  // pure config, so the pre-flight answer is identical to the summary's, free.
  //
  // Two required sets, each with its own explanation: `extraTickers` are the
  // caller's action-critical ones (the traded market + its collateral, or a
  // WLP deposit ticker), and the pool is required wholesale because mint and
  // redeem value the WHOLE pool.
  const planned = plannedSummary(client, oracleTickers);
  assertTickersRefreshed(client, planned, extraTickers, opts);
  assertWlpPoolRefreshed(client, planned, opts);

  const summary = await refreshOraclePrices(tx, client, oracleTickers, {
    updateDataProvider: opts.updateDataProvider,
  });

  // Bump only what was actually AGGREGATED, not every pool entry.
  //
  // `update_token_value` calls `oracle::get_price`, which aborts `EStalePrice`
  // unless this PTB aggregated that ticker. Normally the asserts above
  // guarantee it — but `allowUnrefreshedPrices` skips them by design, and
  // bumping a skipped asset then produced a transaction guaranteed to abort,
  // which made the escape hatch unusable on exactly the deployments that need
  // it. Driving the loop off the summary makes the opt-out mean what it says:
  // build with whatever prices the chain already holds, and touch nothing else.
  const aggregated = new Set(summary.refreshed);
  for (const [ticker, tokenType] of Object.entries(poolTokens)) {
    if (!aggregated.has(ticker)) continue;
    updateTokenValue(client, tx, { tokenType, lpType: opts.lpType });
  }
  return summary;
}

/**
 * What {@link refreshOraclePrices} WOULD report for `tickers`, computed from
 * config alone.
 *
 * Same predicate, same partition — so a pre-flight assert cannot disagree with
 * the summary the refresh later returns, and a build destined to fail can fail
 * before spending a network round trip or mutating the caller's transaction.
 */
function plannedSummary(client: PerpClient, tickers: string[]): OracleRefreshSummary {
  const { servable, unservable } = partitionServableTickers(client, tickers);
  return { refreshed: servable, skipped: unservable };
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
    // The action-critical pair for a trade — the market being traded and the
    // collateral it is margined in — is passed as the extras, which
    // `refreshWlpPoolOracles` fails closed on before it fetches anything.
    await refreshWlpPoolOracles(tx, client, [req.ticker, collateralTicker], {
      ...opts,
      lpType: req.lpType,
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

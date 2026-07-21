/**
 * Shared scaffolding for the high-level perp `build*Tx` composers:
 * `CommonBuildOpts`, the new-or-reuse PTB helper, the WLP pool-oracle refresh,
 * and the request+execute envelope (optional Pyth-sponsor flow + pre-sweep).
 */

import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import { appendConsolidateForSpend } from "../../account/funding/consolidate.ts";
import {
  openPythSponsorFund,
  PythCache,
  refreshOraclePrices,
  reimbursePythSponsor,
  type OracleFeeSource,
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
  /** Share a `PythCache` across builders to avoid redundant pyth_state reads. */
  pythCache?: PythCache;
  /**
   * @deprecated No longer a fee-source decision. `wrapRequestAndExecute` now
   * opens (and reimburses) the `pyth_sponsor_rule` Fund purely from config
   * presence — whenever `client.config.packages.pyth_sponsor_rule` is
   * deployed, the fund is ALWAYS opened, regardless of this flag (see
   * `OracleFeeSourceUnavailable` in `oracle/pyth.ts`). This closes the gap
   * where a market whose checklist required `PythSponsorRule`, or a caller
   * that mis-set this flag, silently drew from `tx.gas` and failed
   * ON-CHAIN instead of at build time. Use `allowGasFee` for the
   * non-sponsored case instead. Kept accepted (as a no-op) only so existing
   * callers keep compiling; will be removed in a future major version.
   */
  useSponsor?: boolean;
  /**
   * Explicit opt-in to draw the Pyth update fee from `tx.gas` when this
   * client's config has no `pyth_sponsor_rule` deployed. Ignored whenever a
   * sponsor fund IS available — the sponsor pool always wins over `tx.gas`
   * when one can be opened (see `useSponsor`'s deprecation note above).
   * Required for flows with no `TradingRequest` to reimburse a sponsor fund
   * against (e.g. `buildMintWlpTx` — see its doc comment). Building an
   * oracle refresh with neither a sponsor fund nor this flag throws
   * `OracleFeeSourceUnavailable` instead of silently drawing from `tx.gas`
   * (Enoki-sponsored transactions reject any `tx.gas` draw). Default:
   * `false`.
   */
  allowGasFee?: boolean;
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
    cache?: PythCache;
    /** Forwarded to `refreshOraclePrices` — already resolved by the caller (see `OracleFeeSource`). */
    feeSource?: OracleFeeSource;
    lpType?: string;
    updateDataProvider?: UpdateDataProvider;
  },
): Promise<void> {
  const poolTickers = getCollateralAssets(client.config);
  const oracleTickers = Array.from(new Set([...extraTickers, ...poolTickers]));
  await refreshOraclePrices(tx, client, oracleTickers, {
    cache: opts.cache,
    feeSource: opts.feeSource,
    updateDataProvider: opts.updateDataProvider,
  });
  for (const tokenType of Object.values(client.config.packages.wlp.pool_tokens)) {
    updateTokenValue(client, tx, { tokenType, lpType: opts.lpType });
  }
}

/**
 * Build the *Request + execute envelope with the config-driven Pyth sponsor flow:
 *
 *   [maybeConsolidate(tx)]
 *   [fund = sponsor.request()]
 *   refreshOraclePrices(..., feeSource?)
 *   req = buildRequest()
 *   [sponsor.reimburse(fund, req)]
 *   trading::execute(req)
 *
 * Accepted ordering caveat: `maybeConsolidate` runs FIRST and can itself
 * append PTB commands (the consolidation sweep) before the fee-source check
 * inside `refreshOraclePrices` ever runs — so an `OracleFeeSourceUnavailable`
 * throw here is NOT the "zero commands appended" guarantee
 * `refreshOraclePrices` gives its own callers (see its docblock in
 * `aggregate.ts`); `tx` can already carry the sweep. This is the same
 * discard-tx-on-throw contract every `build*Tx` composer already has for
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
  buildRequest: (sponsorFund?: {
    fund: TransactionArgument;
    packageId: string;
  }) => TransactionArgument,
): Promise<void> {
  await maybeConsolidate(client, tx, req.accountId, opts);

  // Fee source + witness attachment is config-driven, not a caller flag: the
  // sponsor fund is opened (and later reimbursed) whenever this client's
  // config has `pyth_sponsor_rule` deployed — regardless of the deprecated
  // `useSponsor` flag (see its JSDoc). `allowGasFee` is the only caller lever
  // left, and it only matters when config has NO sponsor rule to open (see
  // `OracleFeeSourceUnavailable` in `oracle/pyth.ts`).
  //
  // `feeSource` is resolved HERE, once, from that same decision — sponsor
  // beats gas structurally because this is the only branch that ever sees
  // both candidates; everything downstream (`refreshWlpPoolOracles` →
  // `refreshOraclePrices` → `BuildUpdateOpts` → `PythCoreRule` →
  // `buildPythPriceUpdateCalls`) just carries the single resolved value.
  let sponsorFund: { fund: TransactionArgument; packageId: string } | undefined;
  if (client.config.packages.pyth_sponsor_rule) {
    sponsorFund = openPythSponsorFund(tx, client);
  }
  const feeSource: OracleFeeSource | undefined = sponsorFund
    ? { kind: "sponsor", ...sponsorFund }
    : opts?.allowGasFee
      ? { kind: "gas" }
      : undefined;

  if (!opts?.skipOraclePriceRefresh) {
    await refreshWlpPoolOracles(tx, client, [req.ticker, collateralTicker], {
      cache: opts?.pythCache,
      feeSource,
      lpType: req.lpType,
      updateDataProvider: opts?.updateDataProvider,
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

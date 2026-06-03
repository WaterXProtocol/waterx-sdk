/**
 * High-level transaction builders that compose oracle refresh + the
 * appropriate `*_request` + `execute` for a single user-side action.
 *
 * Each top-level builder:
 *   1. Creates a fresh `Transaction` (or appends to one you pass in).
 *   2. Refreshes the on-chain `Oracle` for the base + collateral tickers
 *      via Pyth (uses `utils/pyth.ts`).
 *   3. Calls the request builder.
 *   4. If `useSponsor` (default true on testnet): opens a Fund via
 *      `pyth_sponsor_rule::request`, then closes it with `reimburse`
 *      which attaches the `PythSponsorRule` witness to the
 *      TradingRequest so the market's `request_checklist` is satisfied.
 *   5. Executes the trading request via `trading::execute`.
 */

import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "./client.ts";
import { consumeDepositDirect } from "./generated/waterx_account/direct_rule.ts";
import { requestDepositFromFunds, requestDepositFromReceivings } from "./user/account.ts";
import {
  consumeCreditDeposit,
  enqueueWithdrawal,
  executeWithdrawalNative,
  executeWithdrawalWormhole,
  redeemVaa,
  requestCreditWithdraw,
  routeNative,
  routeWormhole,
  type RedeemVaaParams,
  type RouteWormholeParams,
} from "./user/credit.ts";
import { mintCreditFromRequest } from "./user/custody.ts";
import {
  addPreOrderRequest,
  cancelOrderRequest,
  cancelPreOrderRequest,
  placeOrderRequest,
  updateOrderRequest,
  type AddPreOrderRequestParams,
  type CancelOrderRequestParams,
  type CancelPreOrderRequestParams,
  type PlaceOrderRequestParams,
  type UpdateOrderRequestParams,
} from "./user/order.ts";
import { claimReward, stake, unstake } from "./user/staking.ts";
import {
  closePositionRequest,
  decreasePositionRequest,
  depositCollateralRequest,
  executeTrading,
  increasePositionRequest,
  withdrawCollateralRequest,
  type ClosePositionRequestParams,
  type DecreasePositionRequestParams,
  type DepositCollateralRequestParams,
  type IncreasePositionRequestParams,
  type WithdrawCollateralRequestParams,
} from "./user/trading.ts";
import {
  cancelRedeemWlp,
  mintWlp,
  requestRedeemWlp,
  updateTokenValue,
  type CancelRedeemWlpParams,
  type MintWlpParams,
  type RequestRedeemWlpParams,
} from "./user/wlp.ts";
import { getCollateralAssets } from "./utils/config.ts";
import {
  openPythSponsorFund,
  PythCache,
  refreshOraclePrices,
  reimbursePythSponsor,
  updatePythPrices,
} from "./utils/pyth.ts";

// ============================================================================
// Common opts
// ============================================================================

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
   * address into USD credit before the main action — drains the funds
   * accumulator and TTO'd `Coin<T>` objects via
   * {@link appendConsolidateToUsd}, settles into the account in the same
   * PTB. Skips empty buckets via gRPC probes so it's safe on any account.
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

function newTx(opts?: CommonBuildOpts): Transaction {
  return opts?.tx ?? new Transaction();
}

/**
 * Refresh every WLP pool-token oracle (+ caller-supplied extra tickers) and
 * bump each pool token's `last_price_refresh_timestamp` so the pool's
 * `assert_prices_fresh` passes when the next `mint_wlp` / `request_redeem` /
 * trading `execute` runs in the same PTB.
 */
async function refreshWlpPoolOracles(
  tx: Transaction,
  client: WaterXClient,
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
async function wrapRequestAndExecute(
  client: WaterXClient,
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

// ============================================================================
// Consolidate parked backing assets → USD credit (pre-action sweep)
// ============================================================================

/**
 * For every backing asset registered on `native_custody`, append two drain
 * legs to `tx`:
 *
 *   `requestDepositFromFunds<T>`      → `mintCreditFromRequest<T, USD>` → `consumeDepositDirect<USD>`
 *   `requestDepositFromReceivings<T>` → `mintCreditFromRequest<T, USD>` → `consumeDepositDirect<USD>`
 *
 * Empty legs are skipped — the on-chain `mint` rejects zero-amount deposits.
 * Returns the number of drain legs added (useful for logging / early-out).
 *
 * Silently no-ops when `native_custody` / `waterx_credit` aren't configured
 * for the loaded deployment.
 */
export async function appendConsolidateToUsd(
  client: WaterXClient,
  tx: Transaction,
  accountId: string,
): Promise<number> {
  if (!client.config.packages.native_custody?.vault) return 0;
  if (!client.config.packages.waterx_credit?.credit_type) return 0;

  let legs = 0;
  for (const asset of client.getNativeAssets()) {
    // Funds-accumulator leg (transfer_coin / send_funds path).
    const bal = (await client.getBalance({
      owner: accountId,
      coinType: asset.type,
    })) as { balance?: { addressBalance?: string } };
    if (BigInt(bal.balance?.addressBalance ?? "0") > 0n) {
      const fromFunds = requestDepositFromFunds(client, tx, {
        accountId,
        coinType: asset.type,
      });
      foldDepositRequestToUsd(client, tx, fromFunds, asset.type);
      legs += 1;
    }

    // Receivings leg (TTO'd Coin<T> path).
    const coins = (await client.listCoins({
      owner: accountId,
      coinType: asset.type,
    })) as { objects?: { objectId?: string; version?: string; digest?: string }[] };
    const refs = (coins.objects ?? []).filter(
      (c): c is { objectId: string; version: string; digest: string } =>
        !!c.objectId && !!c.version && !!c.digest,
    );
    if (refs.length > 0) {
      const receivings = refs.map((c) =>
        tx.receivingRef({ objectId: c.objectId, version: c.version, digest: c.digest }),
      ) as unknown as TransactionArgument[];
      const fromReceivings = requestDepositFromReceivings(client, tx, {
        accountId,
        coinType: asset.type,
        receivings,
      });
      foldDepositRequestToUsd(client, tx, fromReceivings, asset.type);
      legs += 1;
    }
  }
  return legs;
}

function foldDepositRequestToUsd(
  client: WaterXClient,
  tx: Transaction,
  depositRequest: TransactionArgument,
  assetType: string,
): void {
  const usdReq = mintCreditFromRequest(client, tx, {
    depositRequest,
    assetType,
  });
  consumeDepositDirect({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      req: usdReq as unknown as string,
    },
    typeArguments: [client.creditType()],
  })(tx);
}

/** Internal: run the async sweep iff `consolidateToUsd !== false`. */
async function maybeConsolidate(
  client: WaterXClient,
  tx: Transaction,
  accountId: string,
  opts: CommonBuildOpts | undefined,
): Promise<void> {
  if (opts?.consolidateToUsd === false) return;
  await appendConsolidateToUsd(client, tx, accountId);
}

/**
 * Standalone PTB that drains every backing asset parked at the account's
 * address into USD credit under the account — see {@link appendConsolidateToUsd}.
 *
 * Returns an empty `Transaction` when nothing is parked. Callers can
 * `client.simulate(tx)` to detect a no-op before submitting.
 */
export async function buildConsolidateToUsdTx(
  client: WaterXClient,
  accountId: string,
  tx?: Transaction,
): Promise<Transaction> {
  const txOut = tx ?? new Transaction();
  await appendConsolidateToUsd(client, txOut, accountId);
  return txOut;
}

// ============================================================================
// Position lifecycle (close / increase / decrease)
// ============================================================================

export interface BuildClosePositionParams extends ClosePositionRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildClosePositionTx(
  client: WaterXClient,
  params: BuildClosePositionParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => closePositionRequest(client, tx, params),
  );
  return tx;
}

export interface BuildIncreasePositionParams
  extends IncreasePositionRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildIncreasePositionTx(
  client: WaterXClient,
  params: BuildIncreasePositionParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => increasePositionRequest(client, tx, params),
  );
  return tx;
}

export interface BuildDecreasePositionParams
  extends DecreasePositionRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildDecreasePositionTx(
  client: WaterXClient,
  params: BuildDecreasePositionParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => decreasePositionRequest(client, tx, params),
  );
  return tx;
}

// ============================================================================
// Deposit / withdraw collateral
// ============================================================================

export interface BuildDepositCollateralParams
  extends DepositCollateralRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildDepositCollateralTx(
  client: WaterXClient,
  params: BuildDepositCollateralParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => depositCollateralRequest(client, tx, params),
  );
  return tx;
}

export interface BuildWithdrawCollateralParams
  extends WithdrawCollateralRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildWithdrawCollateralTx(
  client: WaterXClient,
  params: BuildWithdrawCollateralParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => withdrawCollateralRequest(client, tx, params),
  );
  return tx;
}

// ============================================================================
// Order lifecycle (place / cancel / update / pre-order)
// ============================================================================

export interface BuildPlaceOrderParams extends PlaceOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildPlaceOrderTx(
  client: WaterXClient,
  params: BuildPlaceOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => placeOrderRequest(client, tx, params),
  );
  return tx;
}

export interface BuildCancelOrderParams extends CancelOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildCancelOrderTx(
  client: WaterXClient,
  params: BuildCancelOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => cancelOrderRequest(client, tx, params),
  );
  return tx;
}

export interface BuildUpdateOrderParams extends UpdateOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildUpdateOrderTx(
  client: WaterXClient,
  params: BuildUpdateOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => updateOrderRequest(client, tx, params),
  );
  return tx;
}

export interface BuildCancelPreOrderParams extends CancelPreOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildCancelPreOrderTx(
  client: WaterXClient,
  params: BuildCancelPreOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => cancelPreOrderRequest(client, tx, params),
  );
  return tx;
}

export interface BuildAddPreOrderParams extends AddPreOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildAddPreOrderTx(
  client: WaterXClient,
  params: BuildAddPreOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => addPreOrderRequest(client, tx, params),
  );
  return tx;
}

// ============================================================================
// WLP mint
// ============================================================================

export interface BuildMintWlpParams extends MintWlpParams, CommonBuildOpts {
  /** Oracle ticker for the deposited token (must be a registered pool token). */
  depositTicker: string;
}

/**
 * Mints WLP from a deposit asset already in the wxa account's stored
 * balance. Refreshes every pool-token oracle + bumps each pool token's
 * `last_price_refresh_timestamp` so `assert_prices_fresh` inside
 * `mint_wlp` passes.
 *
 * Does NOT use the pyth_sponsor flow — `mint_wlp` produces no
 * `TradingRequest`, so there's nothing for the sponsor to attach its
 * witness to. Pyth update fees come from `tx.gas`.
 */
export async function buildMintWlpTx(
  client: WaterXClient,
  params: BuildMintWlpParams,
): Promise<Transaction> {
  const tx = newTx(params);

  await maybeConsolidate(client, tx, params.accountId, params);

  if (!params.skipOraclePriceRefresh) {
    await refreshWlpPoolOracles(tx, client, [params.depositTicker], {
      cache: params.pythCache,
      lpType: params.lpType,
    });
  }

  mintWlp(client, tx, params);
  return tx;
}

// ============================================================================
// WLP mint + stake (atomic)
// ============================================================================

export interface BuildMintAndStakeWlpParams extends BuildMintWlpParams {
  /**
   * Staking pool alias (key into `waterx_staking.pools`). Defaults to `"WLP"`.
   */
  stakeAlias?: string;
}

/**
 * Mints WLP and immediately stakes the minted amount into the WLP staking pool
 * in the same PTB. The mint's `lp_amount` return is piped directly into the
 * `stake` call so no precision loss / dust can occur.
 *
 * Use this instead of `buildMintWlpTx` when the product flow is "deposit USD
 * and earn rewards" — un-staked WLP sitting in the wxa account's `Balance<WLP>`
 * slot earns nothing.
 */
export async function buildMintAndStakeWlpTx(
  client: WaterXClient,
  params: BuildMintAndStakeWlpParams,
): Promise<Transaction> {
  const tx = newTx(params);

  await maybeConsolidate(client, tx, params.accountId, params);

  if (!params.skipOraclePriceRefresh) {
    await refreshWlpPoolOracles(tx, client, [params.depositTicker], {
      cache: params.pythCache,
      lpType: params.lpType,
    });
  }

  const stakeAlias = params.stakeAlias ?? "WLP";
  const lpAmount = mintWlp(client, tx, params);
  stake(client, tx, {
    accountId: params.accountId,
    stakeAlias,
    stakeType: params.lpType ?? client.wlpType(),
    stakeAmount: lpAmount,
    bucketAccount: params.bucketAccount,
  });
  return tx;
}

// ============================================================================
// WLP unstake + request-redeem (atomic)
// ============================================================================

export interface BuildUnstakeAndRequestRedeemWlpParams
  extends Omit<RequestRedeemWlpParams, "lpAmount">, CommonBuildOpts {
  /** Amount of staked WLP to unstake and enqueue for redemption. */
  withdrawalAmount: bigint | number;
  /** Staking pool alias. Defaults to `"WLP"`. */
  stakeAlias?: string;
}

/**
 * Unstakes WLP from the staking pool and immediately enqueues a redeem request
 * in the same PTB. Mirror of `buildMintAndStakeWlpTx` for withdrawals.
 *
 * Refreshes every WLP pool-token oracle by default — `request_redeem` runs
 * `assert_prices_fresh` internally, so a stale oracle would abort the PTB.
 * Pass `skipOraclePriceRefresh: true` only when the caller is composing this
 * into a larger PTB that already pre-pumps prices.
 */
export async function buildUnstakeAndRequestRedeemWlpTx(
  client: WaterXClient,
  params: BuildUnstakeAndRequestRedeemWlpParams,
): Promise<Transaction> {
  const tx = newTx(params);
  const stakeAlias = params.stakeAlias ?? "WLP";

  await maybeConsolidate(client, tx, params.accountId, params);

  if (!params.skipOraclePriceRefresh) {
    await refreshWlpPoolOracles(tx, client, [], {
      cache: params.pythCache,
      lpType: params.lpType,
    });
  }

  unstake(client, tx, {
    accountId: params.accountId,
    stakeAlias,
    stakeType: params.lpType ?? client.wlpType(),
    withdrawalAmount: params.withdrawalAmount,
    bucketAccount: params.bucketAccount,
  });

  requestRedeemWlp(client, tx, {
    accountId: params.accountId,
    redeemTokenType: params.redeemTokenType,
    lpAmount: params.withdrawalAmount,
    lpType: params.lpType,
    bucketAccount: params.bucketAccount,
  });

  return tx;
}

// ============================================================================
// WLP cancel-redeem + re-stake (atomic)
// ============================================================================

export interface BuildCancelRedeemAndStakeWlpParams extends CancelRedeemWlpParams, CommonBuildOpts {
  accountId: string;
  /**
   * WLP amount (base units) that was originally enqueued by `request_redeem`
   * and is being returned to the wxa account by `cancel_redeem` — gets
   * re-staked into the WLP staking pool in the same PTB.
   */
  stakeAmount: bigint | number;
  /** Staking pool alias. Defaults to `"WLP"`. */
  stakeAlias?: string;
}

/**
 * Cancels a pending WLP redeem request and re-stakes the returned WLP in the
 * same PTB. Third partner of `buildMintAndStakeWlpTx` /
 * `buildUnstakeAndRequestRedeemWlpTx`; together they keep the product
 * invariant that user-held WLP is always staked.
 */
export function buildCancelRedeemAndStakeWlpTx(
  client: WaterXClient,
  params: BuildCancelRedeemAndStakeWlpParams,
): Transaction {
  const tx = newTx(params);
  const stakeAlias = params.stakeAlias ?? "WLP";

  cancelRedeemWlp(client, tx, {
    requestId: params.requestId,
    lpType: params.lpType,
    bucketAccount: params.bucketAccount,
  });

  stake(client, tx, {
    accountId: params.accountId,
    stakeAlias,
    stakeType: params.lpType ?? client.wlpType(),
    stakeAmount: params.stakeAmount,
    bucketAccount: params.bucketAccount,
  });

  return tx;
}

// ============================================================================
// Claim rewards → wxa account (TTO)
// ============================================================================

export interface BuildClaimRewardsToAccountParams extends CommonBuildOpts {
  accountId: string;
  /** Staking pool alias. Defaults to `"WLP"`. */
  stakeAlias?: string;
  /** Fully-qualified stake coin type. Defaults to `client.wlpType()`. */
  stakeType?: string;
  /**
   * Reward coin types to claim. Defaults to every rewarder configured for the
   * stake pool in `waterx_staking.rewarders[stakeAlias]`.
   */
  rewarderTypes?: string[];
  bucketAccount?: string | TransactionArgument;
}

/**
 * Claims every accrued reward for `accountId` on the given stake pool. Each
 * resulting `Coin<R>` is TTO'd to the wxa account's UID address via
 * `wxa_account::transfer_coin<R>` (the default behaviour of the Move
 * `staking::claim` entry — no deposit-policy registration required for the
 * reward token). The account owner collects each coin via
 * `wxa_account::receive` in a separate user action.
 */
export function buildClaimRewardsToAccountTx(
  client: WaterXClient,
  params: BuildClaimRewardsToAccountParams,
): Transaction {
  const tx = newTx(params);
  const stakeAlias = params.stakeAlias ?? "WLP";
  const stakeType = params.stakeType ?? client.wlpType();
  const rewarderTypes = params.rewarderTypes ?? client.getRewarderTypes(stakeAlias);
  if (rewarderTypes.length === 0) {
    throw new Error(
      `buildClaimRewardsToAccountTx: no rewarders configured for stakeAlias=${stakeAlias}`,
    );
  }

  for (const rewardType of rewarderTypes) {
    claimReward(client, tx, {
      accountId: params.accountId,
      stakeAlias,
      stakeType,
      rewardType,
      bucketAccount: params.bucketAccount,
    });
  }

  return tx;
}

// ============================================================================
// Cross-chain credit / bridge
// ============================================================================

export interface BuildRedeemVaaParams extends RedeemVaaParams {
  /** Append to an existing PTB instead of creating a new one. */
  tx?: Transaction;
}

/**
 * Mint (EVM → Sui): `redeem_vaa<CREDIT>` + consume the resulting
 * `DepositRequest<CREDIT>` via the configured wxa deposit policy, in one
 * PTB. The recipient wxa account is encoded in the VAA payload.
 */
export function buildRedeemVaaTx(client: WaterXClient, params: BuildRedeemVaaParams): Transaction {
  const tx = params.tx ?? new Transaction();
  const req = redeemVaa(client, tx, params);
  consumeCreditDeposit(client, tx, { depositRequest: req, creditType: params.creditType });
  return tx;
}

export type CreditWithdrawRoute =
  | ({ kind: "wormhole" } & RouteWormholeParams)
  | { kind: "native"; assetType: string };

export interface BuildRequestCreditWithdrawParams {
  accountId: string;
  amount: bigint | number;
  /** Sui-side recipient (honored for native payouts; ignored for wormhole). */
  recipient: string;
  route: CreditWithdrawRoute;
  creditType?: string;
  bucketAccount?: string | TransactionArgument;
  tx?: Transaction;
}

/**
 * Withdraw (user side): encode the route, `account::request_withdraw<CREDIT>`,
 * then `withdrawal_queue::enqueue<CREDIT>` — all in one PTB. A keeper later
 * drains the parked entry via {@link buildExecuteWithdrawalTx}.
 */
export function buildRequestCreditWithdrawTx(
  client: WaterXClient,
  params: BuildRequestCreditWithdrawParams,
): Transaction {
  const tx = params.tx ?? new Transaction();
  const route =
    params.route.kind === "wormhole"
      ? routeWormhole(client, tx, params.route)
      : routeNative(client, tx, { assetType: params.route.assetType });
  const wreq = requestCreditWithdraw(client, tx, {
    accountId: params.accountId,
    amount: params.amount,
    recipient: params.recipient,
    route,
    creditType: params.creditType,
    bucketAccount: params.bucketAccount,
  });
  enqueueWithdrawal(client, tx, { withdrawRequest: wreq, creditType: params.creditType });
  return tx;
}

export type ExecuteWithdrawalRoute =
  | {
      kind: "wormhole";
      /**
       * `Coin<SUI>` paying the Wormhole message fee. Omit to mint a zero-value
       * coin via `0x2::coin::zero<SUI>` — sponsor-safe (never touches `tx.gas`,
       * so Shinami-style gas stations don't reject the PTB) and free as long as
       * `WormholeState.message_fee == 0`. Pass an explicit coin (e.g.
       * `tx.object(...)`) once Wormhole raises the message fee.
       */
      wormholeFeeCoin?: TransactionArgument;
    }
  | { kind: "native"; assetType: string };

export interface BuildExecuteWithdrawalParams {
  /** Queue entry key (from the `Enqueued` event). */
  key: bigint | number;
  route: ExecuteWithdrawalRoute;
  creditType?: string;
  /** Executor identity (must be on the queue allowlist). Defaults to tx sender. */
  bucketAccount?: string | TransactionArgument;
  tx?: Transaction;
}

/** Keeper: drain one parked queue entry. */
export function buildExecuteWithdrawalTx(
  client: WaterXClient,
  params: BuildExecuteWithdrawalParams,
): Transaction {
  const tx = params.tx ?? new Transaction();
  if (params.route.kind === "wormhole") {
    const fee =
      params.route.wormholeFeeCoin ??
      tx.moveCall({ target: "0x2::coin::zero", typeArguments: ["0x2::sui::SUI"] });
    executeWithdrawalWormhole(client, tx, {
      key: params.key,
      wormholeFee: fee,
      creditType: params.creditType,
      bucketAccount: params.bucketAccount,
    });
  } else {
    executeWithdrawalNative(client, tx, {
      key: params.key,
      assetType: params.route.assetType,
      creditType: params.creditType,
      bucketAccount: params.bucketAccount,
    });
  }
  return tx;
}

// ============================================================================
// Re-exports
// ============================================================================

export {
  openPythSponsorFund,
  PythCache,
  refreshOraclePrices,
  reimbursePythSponsor,
  updatePythPrices,
};

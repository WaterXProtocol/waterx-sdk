/**
 * On-chain discovery for e2e simulates: paginated `getMarketPositions` + wxa balance gates.
 * Mirrors discovery semantics documented for `pnpm audit:e2e-discovery` histogram labels (`DiscoverPositionGateResult`).
 */
import type { WaterXClient } from "../../../src/client.ts";
import type { PositionDataView, RedeemRequestDataView } from "../../../src/fetch.ts";
import { getMarketData, getMarketPositions, getRedeemRequests } from "../../../src/fetch.ts";
import { wxaAccountIdHints } from "./canonical-testnet-account.ts";
import { resolveE2eNetwork } from "./e2e-client.ts";
import { resolveDefaultUsdcCoinProbeAttempts } from "./e2e-discovery-caps.ts";
import {
  getAccountOwnerByAccountId,
  getWxaAccountBalance,
} from "./fetch-read-helpers-for-tests.ts";
import { activeLifecycleTickersForClient, lifecycleTickerRow } from "./lifecycle-test-markets.ts";
import { runWithConcurrency } from "./run-with-concurrency.ts";

export { resolveDefaultUsdcCoinProbeAttempts };

export type DiscoveredPosition = {
  ticker: string;
  positionId: bigint;
  position: PositionDataView;
  accountObjectAddress: string;
  ownerAddress: string;
  /** `pool_tokens` key for collateral Move type (e.g. `USDCUSD`). */
  collateralPoolTicker: string;
};

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
}

export function normalizeMoveType(t: string): string {
  return t.replace(/^0x/i, "").toLowerCase();
}

function recordStr(o: unknown): Record<string, unknown> | null {
  return o && typeof o === "object" ? (o as Record<string, unknown>) : null;
}

/** Canonical TypeName string from view `PositionData.collateral_type`. */
export function collateralTypeFqName(p: PositionDataView): string {
  const x = recordStr(p) ?? {};
  const ct = x.collateral_type ?? x.collateralType;
  if (typeof ct === "string") return ct;
  const inner = recordStr(ct);
  if (inner && typeof inner.name === "string") return inner.name;
  return "";
}

export function posAccountObjectAddress(p: PositionDataView): string {
  const x = recordStr(p) ?? {};
  const v = x.account_object_address ?? x.accountObjectAddress;
  return typeof v === "string" ? v : String(v ?? "");
}

export function posPositionIdBigInt(p: PositionDataView): bigint {
  const x = recordStr(p) ?? {};
  const raw = x.position_id ?? x.positionId;
  if (typeof raw === "bigint") return raw;
  return BigInt(String(raw ?? "0"));
}

export function posLeverageBps(p: PositionDataView): bigint {
  const x = recordStr(p) ?? {};
  const raw = x.leverage_bps ?? x.leverageBps;
  return typeof raw === "bigint" ? raw : BigInt(String(raw ?? "0"));
}

export function posUpdateTimestampMs(p: PositionDataView): bigint {
  const x = recordStr(p) ?? {};
  const raw = x.update_timestamp ?? x.updateTimestamp;
  return typeof raw === "bigint" ? raw : BigInt(String(raw ?? "0"));
}

export function posCollateralAmount(p: PositionDataView): bigint {
  const x = recordStr(p) ?? {};
  const raw = x.collateral_amount ?? x.collateralAmount;
  return typeof raw === "bigint" ? raw : BigInt(String(raw ?? "0"));
}

export function posSize(p: PositionDataView): bigint {
  const x = recordStr(p) ?? {};
  const raw = x.size;
  return typeof raw === "bigint" ? raw : BigInt(String(raw ?? "0"));
}

/**
 * Map position collateral `TypeName` string → `wlp.pool_tokens` ticker key (`USDCUSD`, …).
 */
export function resolveCollateralPoolTicker(
  client: WaterXClient,
  collateralFqName: string,
): string {
  const target = normalizeMoveType(collateralFqName);
  const pt = client.config.packages.wlp?.pool_tokens ?? {};
  for (const [ticker, ty] of Object.entries(pt)) {
    if (normalizeMoveType(ty) === target) return ticker;
  }
  return "USDCUSD";
}

function cooldownElapsed(updateTimestampMs: bigint, cooldownMs: bigint, slackMs = 750): boolean {
  const eligibleAt = Number(updateTimestampMs) + Number(cooldownMs) + slackMs;
  return Date.now() >= eligibleAt;
}

async function marketCooldownMs(client: WaterXClient, ticker: string): Promise<bigint> {
  try {
    const m = await getMarketData(client, { ticker });
    return BigInt(m.cooldown_ms);
  } catch {
    return 0n;
  }
}

export type DiscoverPositionGateResult =
  | { ok: true; ownerAddress: string }
  | { ok: false; code: string; detail?: string };

export type DiscoverPositionGateCtx = {
  maxLevBpsForFilter: bigint | null;
  cooldownMs: bigint;
  usdcCoinType: string;
};

export type DiscoverPositionUsdcProbeBudget = { used: number; max: number };

export async function evaluatePositionAgainstDiscoverOpts(
  client: WaterXClient,
  p: PositionDataView,
  opts: DiscoverActivePositionOpts,
  ctx: DiscoverPositionGateCtx,
  usdcProbeBudget: DiscoverPositionUsdcProbeBudget | null,
): Promise<DiscoverPositionGateResult> {
  const minCol = opts.minCollateralAmount ?? 0n;
  const minPos = opts.minPositionSize;
  const requireCd = opts.requireCooldownElapsed ?? true;
  const minAccUsdc = opts.minAccountUsdcBalance ?? 0n;
  const utilPct = opts.maxLeverageUtilizationPercent;
  const minCollBal = opts.minAccountBalanceForPositionCollateral;
  const minUsdcObjects = opts.minUsdcCoinObjects;
  const minPerUsdcCoin = opts.minBalancePerUsdcCoin;
  const maxUsdcCoinProbes = opts.maxUsdcCoinProbeAttempts ?? resolveDefaultUsdcCoinProbeAttempts();

  const sz = posSize(p);
  const lev = posLeverageBps(p);
  const collAmt = posCollateralAmount(p);
  const accountId = posAccountObjectAddress(p);

  if (sz <= 0n) return { ok: false, code: "size_zero" };
  if (minPos != null && minPos > 0n && sz < minPos) {
    return { ok: false, code: "min_position_size", detail: `${sz} < ${minPos}` };
  }
  if (collAmt < minCol) {
    return {
      ok: false,
      code: "min_collateral_amount",
      detail: `${collAmt} < ${minCol}`,
    };
  }
  if (
    requireCd &&
    ctx.cooldownMs > 0n &&
    !cooldownElapsed(posUpdateTimestampMs(p), ctx.cooldownMs)
  ) {
    return { ok: false, code: "cooldown_not_elapsed" };
  }
  if (ctx.maxLevBpsForFilter != null && utilPct != null) {
    const cap = (ctx.maxLevBpsForFilter * BigInt(utilPct)) / 100n;
    if (lev > cap) {
      return {
        ok: false,
        code: "leverage_above_util_cap",
        detail: `leverageBps=${lev} cap=${cap} (maxMarket=${ctx.maxLevBpsForFilter} util=${utilPct}%)`,
      };
    }
  }

  let ownerAddress: string;
  try {
    ownerAddress = await getAccountOwnerByAccountId(client, accountId);
  } catch (e) {
    return {
      ok: false,
      code: "owner_lookup_failed",
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  if (minAccUsdc > 0n) {
    try {
      const bal = await getWxaAccountBalance(client, accountId, ctx.usdcCoinType);
      if (bal < minAccUsdc) {
        return {
          ok: false,
          code: "account_usdc_below_min",
          detail: `have=${bal} need>=${minAccUsdc}`,
        };
      }
    } catch (e) {
      return {
        ok: false,
        code: "account_usdc_balance_error",
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }

  if (minCollBal != null && minCollBal > 0n) {
    const collTicker = resolveCollateralPoolTicker(client, collateralTypeFqName(p));
    const collType = client.getPoolTokenType(collTicker);
    try {
      const bal = await getWxaAccountBalance(client, accountId, collType);
      if (bal < minCollBal) {
        return {
          ok: false,
          code: "position_collateral_balance_low",
          detail: `${collTicker} have=${bal} need>=${minCollBal}`,
        };
      }
    } catch (e) {
      return {
        ok: false,
        code: "position_collateral_balance_error",
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }

  const minWalletUsdcTotal = opts.minWalletUsdcTotal;
  if (minWalletUsdcTotal != null && minWalletUsdcTotal > 0n) {
    try {
      const { objects } = await client.listCoins({
        owner: ownerAddress,
        coinType: ctx.usdcCoinType,
      });
      const total = objects.reduce((s, o) => s + BigInt(o.balance ?? "0"), 0n);
      if (total < minWalletUsdcTotal) {
        return {
          ok: false,
          code: "wallet_usdc_below_min",
          detail: `have=${total} need>=${minWalletUsdcTotal}`,
        };
      }
    } catch (e) {
      return {
        ok: false,
        code: "wallet_usdc_list_error",
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }

  if (
    minUsdcObjects != null &&
    minUsdcObjects >= 1 &&
    minPerUsdcCoin != null &&
    minPerUsdcCoin > 0n
  ) {
    if (usdcProbeBudget == null && maxUsdcCoinProbes < 1) {
      return { ok: false, code: "usdc_coin_split_skipped", detail: "max probes 0" };
    }
    if (usdcProbeBudget != null) {
      if (usdcProbeBudget.used >= usdcProbeBudget.max) {
        return { ok: false, code: "usdc_probes_exhausted" };
      }
      usdcProbeBudget.used += 1;
    }
    try {
      const bal = await getWxaAccountBalance(client, accountId, ctx.usdcCoinType);
      const eligible = minPerUsdcCoin > 0n ? Number(bal / minPerUsdcCoin) : 0;
      if (eligible < minUsdcObjects) {
        return {
          ok: false,
          code: "usdc_coin_objects_insufficient",
          detail: `eligibleChunks=${eligible} need>=${minUsdcObjects} (minPerChunk=${minPerUsdcCoin}, bal=${bal})`,
        };
      }
    } catch (e) {
      return {
        ok: false,
        code: "usdc_coin_list_error",
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return { ok: true, ownerAddress };
}

export type DiscoverActivePositionOpts = {
  maxPages?: number;
  pageSize?: number;
  minCollateralAmount?: bigint;
  requireCooldownElapsed?: boolean;
  minAccountUsdcBalance?: bigint;
  maxLeverageUtilizationPercent?: number;
  minAccountBalanceForPositionCollateral?: bigint;
  minUsdcCoinObjects?: number;
  minBalancePerUsdcCoin?: bigint;
  maxUsdcCoinProbeAttempts?: number;
  minWalletUsdcTotal?: bigint;
  minPositionSize?: bigint;
  positionPick?: "first" | "maxSize";
};

function resolveDefaultStatefulLeverageUtilPct(): number {
  const raw = process.env.WATERX_E2E_DISCOVERY_MAX_LEVERAGE_UTIL_PCT?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 1 && n <= 99) return n;
  }
  return 93;
}

function resolveLastTierStatefulLeverageUtilPct(): number {
  const raw = process.env.WATERX_E2E_DISCOVERY_LAST_TIER_LEVERAGE_PCT?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 1 && n <= 99) return n;
  }
  return 98;
}

function resolveStatefulDiscoveryMaxPages(): number {
  const raw = process.env.WATERX_E2E_DISCOVERY_MAX_PAGES?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 1 && n <= 50) return n;
  }
  return 20;
}

function resolvePartialDecreaseMinPositionSize(): bigint {
  const raw = process.env.WATERX_E2E_DISCOVERY_MIN_POSITION_SIZE?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = BigInt(raw);
    if (n > 0n) return n;
  }
  return 500_000n;
}

export const DISCOVERY_OPTS_STATEFUL_SIMULATE: DiscoverActivePositionOpts = {
  maxPages: resolveStatefulDiscoveryMaxPages(),
  maxLeverageUtilizationPercent: resolveDefaultStatefulLeverageUtilPct(),
  minAccountBalanceForPositionCollateral: 6_000_000n,
};

export const DISCOVERY_OPTS_STATEFUL_SIMULATE_PARTIAL_DECREASE: DiscoverActivePositionOpts = {
  ...DISCOVERY_OPTS_STATEFUL_SIMULATE,
  minPositionSize: resolvePartialDecreaseMinPositionSize(),
  positionPick: "maxSize",
};

export async function discoverActivePositionFirstMatchingTiers(
  client: WaterXClient,
  ticker: string,
  tiers: readonly DiscoverActivePositionOpts[],
): Promise<DiscoveredPosition | null> {
  for (const opts of tiers) {
    const hit = await discoverActivePosition(client, ticker, opts);
    if (hit) return hit;
  }
  return null;
}

export function discoveryTiersForStatefulMatrix(): DiscoverActivePositionOpts[] {
  const pages = Math.max(resolveStatefulDiscoveryMaxPages(), 20);
  const { minAccountBalanceForPositionCollateral, maxLeverageUtilizationPercent } =
    DISCOVERY_OPTS_STATEFUL_SIMULATE;
  const lastLev = resolveLastTierStatefulLeverageUtilPct();
  const deepTier: DiscoverActivePositionOpts = {
    maxPages: pages,
    positionPick: "maxSize",
    minAccountBalanceForPositionCollateral,
    maxLeverageUtilizationPercent,
  };
  const tiers: DiscoverActivePositionOpts[] = [
    DISCOVERY_OPTS_STATEFUL_SIMULATE_PARTIAL_DECREASE,
    { ...DISCOVERY_OPTS_STATEFUL_SIMULATE, positionPick: "maxSize" },
    deepTier,
  ];
  if (maxLeverageUtilizationPercent != null && lastLev > maxLeverageUtilizationPercent) {
    tiers.push({
      ...deepTier,
      maxLeverageUtilizationPercent: lastLev,
    });
  }
  appendFinalMatrixLevUtilTier(tiers, deepTier, {
    requireBaseLevUtil: true,
    baseLevUtil: maxLeverageUtilizationPercent,
  });
  return tiers;
}

function clampLevUtilPct(n: number): number {
  return Math.min(99, Math.max(1, Math.floor(n)));
}

const MATRIX_FINAL_LEV_UTIL_PCT = 99;

function appendFinalMatrixLevUtilTier(
  tiers: DiscoverActivePositionOpts[],
  deepTier: DiscoverActivePositionOpts,
  opts: { requireBaseLevUtil: boolean; baseLevUtil: number | null | undefined },
): void {
  if (opts.requireBaseLevUtil && opts.baseLevUtil == null) return;
  const last = tiers[tiers.length - 1]?.maxLeverageUtilizationPercent ?? 0;
  if (last < MATRIX_FINAL_LEV_UTIL_PCT) {
    tiers.push({ ...deepTier, maxLeverageUtilizationPercent: MATRIX_FINAL_LEV_UTIL_PCT });
  }
}

export function discoveryTiersForStatefulMatrixLeverageCap(
  ceilingUtilPct: number,
): DiscoverActivePositionOpts[] {
  const u = clampLevUtilPct(ceilingUtilPct);
  const last = clampLevUtilPct(u + 7);
  const pages = Math.max(resolveStatefulDiscoveryMaxPages(), 20);
  const { minAccountBalanceForPositionCollateral } = DISCOVERY_OPTS_STATEFUL_SIMULATE;
  const tierPartial: DiscoverActivePositionOpts = {
    ...DISCOVERY_OPTS_STATEFUL_SIMULATE_PARTIAL_DECREASE,
    maxLeverageUtilizationPercent: u,
  };
  const tierStateful: DiscoverActivePositionOpts = {
    ...DISCOVERY_OPTS_STATEFUL_SIMULATE,
    maxLeverageUtilizationPercent: u,
    positionPick: "maxSize",
  };
  const deepTier: DiscoverActivePositionOpts = {
    maxPages: pages,
    positionPick: "maxSize",
    minAccountBalanceForPositionCollateral,
    maxLeverageUtilizationPercent: u,
  };
  const tiers: DiscoverActivePositionOpts[] = [tierPartial, tierStateful, deepTier];
  if (last > u) {
    tiers.push({ ...deepTier, maxLeverageUtilizationPercent: last });
  }
  appendFinalMatrixLevUtilTier(tiers, deepTier, {
    requireBaseLevUtil: false,
    baseLevUtil: undefined,
  });
  return tiers;
}

/** Alias — no per-ticker overrides in v3 lifecycle table. */
export function discoveryTiersForStatefulMatrixForTicker(_ticker: string) {
  void _ticker;
  return discoveryTiersForStatefulMatrix();
}

/** @deprecated Use {@link discoveryTiersForStatefulMatrixForTicker}. */
export function discoveryTiersForStatefulMatrixForBase(baseOrTicker: string) {
  return discoveryTiersForStatefulMatrixForTicker(baseOrTicker);
}

export async function discoverActivePositionForNegativeOpen(
  client: WaterXClient,
  ticker: string,
  opts?: Omit<DiscoverActivePositionOpts, "minAccountUsdcBalance">,
): Promise<DiscoveredPosition | null> {
  const row = lifecycleTickerRow(ticker);
  return discoverActivePosition(client, ticker, {
    ...opts,
    minAccountUsdcBalance: row.simulateOpenCollateral,
  });
}

export async function discoverActivePosition(
  client: WaterXClient,
  ticker: string,
  opts?: DiscoverActivePositionOpts,
): Promise<DiscoveredPosition | null> {
  void client.getMarket(ticker);

  const maxPages = opts?.maxPages ?? 15;
  const pageSize = opts?.pageSize ?? 40;
  const utilPct = opts?.maxLeverageUtilizationPercent;
  const minUsdcObjects = opts?.minUsdcCoinObjects;
  const minPerUsdcCoin = opts?.minBalancePerUsdcCoin;
  if (
    minUsdcObjects != null &&
    minUsdcObjects >= 1 &&
    (minPerUsdcCoin == null || minPerUsdcCoin <= 0n)
  ) {
    throw new Error(
      "discoverActivePosition: minBalancePerUsdcCoin (> 0n) is required when minUsdcCoinObjects is set",
    );
  }
  const maxUsdcCoinProbes = opts?.maxUsdcCoinProbeAttempts ?? resolveDefaultUsdcCoinProbeAttempts();
  const requireUsdcCoinSplit =
    minUsdcObjects != null && minUsdcObjects >= 1 && minPerUsdcCoin != null && minPerUsdcCoin > 0n;
  const usdcProbeState = { used: 0, max: maxUsdcCoinProbes };
  const positionPick = opts?.positionPick ?? "first";

  let maxLevBpsForFilter: bigint | null = null;
  if (utilPct != null && utilPct >= 1 && utilPct <= 99) {
    try {
      const md = await getMarketData(client, { ticker });
      maxLevBpsForFilter = BigInt(md.max_leverage_bps);
    } catch {
      maxLevBpsForFilter = null;
    }
  }

  const basePriceUsd = BigInt(Math.max(1, Math.round(lifecycleTickerRow(ticker).approxUsdHint)));
  let cursor = 0n;
  const usdcCoinType = client.getPoolTokenType("USDCUSD");
  const cooldownMs = await marketCooldownMs(client, ticker);
  let best: DiscoveredPosition | null = null;

  for (let page = 0; page < maxPages; page++) {
    const { positions, nextCursor } = await getMarketPositions(client, {
      ticker,
      basePriceUsd,
      collateralPriceUsd: 1n,
      cursor,
      pageSize,
    });

    for (const p of positions) {
      const gate = await evaluatePositionAgainstDiscoverOpts(
        client,
        p,
        opts ?? {},
        { maxLevBpsForFilter, cooldownMs, usdcCoinType },
        requireUsdcCoinSplit ? usdcProbeState : null,
      );
      if (!gate.ok) {
        if (gate.code === "usdc_probes_exhausted") return null;
        continue;
      }

      const row: DiscoveredPosition = {
        ticker,
        positionId: posPositionIdBigInt(p),
        position: p,
        accountObjectAddress: posAccountObjectAddress(p),
        ownerAddress: gate.ownerAddress,
        collateralPoolTicker: resolveCollateralPoolTicker(client, collateralTypeFqName(p)),
      };
      if (positionPick === "first") {
        return row;
      }
      if (best == null || posSize(p) > posSize(best.position)) {
        best = row;
      }
    }

    if (nextCursor === undefined) break;
    cursor = nextCursor;
  }

  return best;
}

function mergeFundedProbeScanOpts(opts: DiscoverActivePositionOpts): DiscoverActivePositionOpts {
  return {
    ...opts,
    maxPages: opts.maxPages ?? Math.max(resolveStatefulDiscoveryMaxPages(), 24),
  };
}

export async function discoverFundedProbe(
  client: WaterXClient,
  opts: DiscoverActivePositionOpts & { minAccountUsdcBalance: bigint },
): Promise<DiscoveredPosition | null> {
  const tickers = activeLifecycleTickersForClient(client);
  if (tickers.length === 0) return null;

  const scanOpts = mergeFundedProbeScanOpts(opts);

  const parallel =
    process.env.WATERX_E2E_DISCOVERY_PROBE_PARALLEL?.trim() !== "0" &&
    process.env.WATERX_E2E_DISCOVERY_PROBE_PARALLEL?.trim() !== "false";

  if (!parallel) {
    for (const t of tickers) {
      const hit = await discoverActivePosition(client, t, scanOpts);
      if (hit) return hit;
    }
    return null;
  }

  const conc = resolveDiscoveryProbeConcurrency();
  const hits = await runWithConcurrency(tickers, conc, (t) =>
    discoverActivePosition(client, t, scanOpts),
  );
  for (let i = 0; i < tickers.length; i++) {
    const hit = hits[i];
    if (hit) return hit;
  }
  return null;
}

export async function discoverFundedProbeWithoutPositionOnTicker(
  client: WaterXClient,
  openOnTicker: string,
  opts: DiscoverActivePositionOpts & { minAccountUsdcBalance: bigint },
): Promise<DiscoveredPosition | null> {
  const scanOpts = mergeFundedProbeScanOpts(opts);
  const others = activeLifecycleTickersForClient(client).filter((t) => t !== openOnTicker);
  for (const scanTicker of others) {
    const hit = await discoverActivePosition(client, scanTicker, scanOpts);
    if (!hit) continue;
    const openOnTarget = await discoverActivePositionForAccount(
      client,
      openOnTicker,
      hit.accountObjectAddress,
      { maxPages: 8, requireCooldownElapsed: false },
    );
    if (openOnTarget == null) return hit;
  }
  return null;
}

/** @deprecated Use {@link discoverFundedProbeWithoutPositionOnTicker}. */
export async function discoverFundedProbeWithoutPositionOnBase(
  client: WaterXClient,
  openOnBase: string,
  opts: DiscoverActivePositionOpts & { minAccountUsdcBalance: bigint },
): Promise<DiscoveredPosition | null> {
  return discoverFundedProbeWithoutPositionOnTicker(client, openOnBase, opts);
}

function resolveDiscoveryProbeConcurrency(): number {
  const raw = process.env.WATERX_E2E_DISCOVERY_PROBE_CONCURRENCY?.trim();
  if (!raw) return 3;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(8, Math.floor(n));
}

export async function discoverActivePositionForAccount(
  client: WaterXClient,
  ticker: string,
  accountObjectAddress: string,
  opts?: DiscoverActivePositionOpts,
): Promise<DiscoveredPosition | null> {
  void client.getMarket(ticker);

  const maxPages = opts?.maxPages ?? 12;
  const pageSize = opts?.pageSize ?? 40;
  const positionPick = opts?.positionPick ?? "first";
  const want = normAddr(accountObjectAddress);

  const basePriceUsd = BigInt(Math.max(1, Math.round(lifecycleTickerRow(ticker).approxUsdHint)));
  let cursor = 0n;
  const cooldownMs = await marketCooldownMs(client, ticker);
  const usdcCoinType = client.getPoolTokenType("USDCUSD");
  let best: DiscoveredPosition | null = null;

  for (let page = 0; page < maxPages; page++) {
    const { positions, nextCursor } = await getMarketPositions(client, {
      ticker,
      basePriceUsd,
      collateralPriceUsd: 1n,
      cursor,
      pageSize,
    });

    for (const p of positions) {
      if (normAddr(posAccountObjectAddress(p)) !== want) continue;
      const gate = await evaluatePositionAgainstDiscoverOpts(
        client,
        p,
        opts ?? {},
        { maxLevBpsForFilter: null, cooldownMs, usdcCoinType },
        null,
      );
      if (!gate.ok) continue;

      const row: DiscoveredPosition = {
        ticker,
        positionId: posPositionIdBigInt(p),
        position: p,
        accountObjectAddress: posAccountObjectAddress(p),
        ownerAddress: gate.ownerAddress,
        collateralPoolTicker: resolveCollateralPoolTicker(client, collateralTypeFqName(p)),
      };
      if (positionPick === "first") {
        return row;
      }
      if (best == null || posSize(p) > posSize(best.position)) {
        best = row;
      }
    }

    if (nextCursor === undefined) break;
    cursor = nextCursor;
  }

  return best;
}

export function e2eSkipReasonNoEligibleMarketPosition(ticker: string): string {
  return `No eligible open ${ticker} position found via market scan`;
}

export function e2eSkipReasonNoOpenPositionMarketDiscovery(ticker: string): string {
  return `No open ${ticker} position via market discovery`;
}

export function e2eSkipReasonUsdcCoinProbeExhausted(maxProbes: number): string {
  return `USDC wxa-balance chunk discovery exhausted after ${maxProbes} candidate probes (no account with enough split budget)`;
}

export function e2eSkipReasonNoPositionMatchingUsdcCoinSplit(
  ticker: string,
  maxProbes: number,
): string {
  return `No eligible open ${ticker} position with required USDC split budget (market scan or ${maxProbes} probes exhausted)`;
}

export async function discoverPositionsForAllActiveMarkets(
  client: WaterXClient,
): Promise<Map<string, DiscoveredPosition>> {
  const out = new Map<string, DiscoveredPosition>();
  for (const ticker of activeLifecycleTickersForClient(client)) {
    const hit = await discoverActivePosition(client, ticker, DISCOVERY_OPTS_STATEFUL_SIMULATE);
    if (hit) out.set(ticker, hit);
  }
  return out;
}

/** wxa `Account` id + registry owner — for v3 stored-balance simulate (`mintWlp`, `requestRedeemWlp`, …). */
export type DiscoveredWxaAccount = {
  accountId: string;
  ownerAddress: string;
};

/** Pending row from `getRedeemRequests` with resolvable recipient owner. */
export type DiscoveredRedeemRequest = DiscoveredWxaAccount & {
  requestId: bigint;
  lpAmount: bigint;
  redeemTokenType: string;
};

const WXA_ACCOUNT_CANDIDATE_CAP = 40;

function envWxaAccountIdHints(): string[] {
  return wxaAccountIdHints(resolveE2eNetwork());
}

/** Prefer integration-maintained wxa account, then redeem queue / market positions / funded probe. */
export async function collectWxaAccountIdCandidates(client: WaterXClient): Promise<string[]> {
  const candidates: string[] = [...envWxaAccountIdHints()];

  try {
    const { requests } = await getRedeemRequests(client, { cursor: 0n, pageSize: 50n });
    for (const accId of redeemRecipientAccountCandidates(requests)) {
      candidates.push(accId);
    }
  } catch {
    /* ignore */
  }

  try {
    const perMarket = await discoverPositionsForAllActiveMarkets(client);
    for (const hit of perMarket.values()) {
      if (hit?.accountObjectAddress) candidates.push(hit.accountObjectAddress);
      if (candidates.length >= WXA_ACCOUNT_CANDIDATE_CAP) break;
    }
  } catch {
    /* ignore */
  }

  try {
    const probe = await discoverFundedProbe(client, { minAccountUsdcBalance: 20_000_000n });
    if (probe) candidates.push(probe.accountObjectAddress);
  } catch {
    /* ignore */
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of candidates) {
    const key = normAddr(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
    if (out.length >= WXA_ACCOUNT_CANDIDATE_CAP) break;
  }
  return out;
}

export async function discoverWxaAccountWithStoredBalance(
  client: WaterXClient,
  opts: { coinType: string; minBalance: bigint },
): Promise<DiscoveredWxaAccount | null> {
  for (const accountId of await collectWxaAccountIdCandidates(client)) {
    try {
      const bal = await getWxaAccountBalance(client, accountId, opts.coinType);
      if (bal < opts.minBalance) continue;
      const ownerAddress = await getAccountOwnerByAccountId(client, accountId);
      return { accountId, ownerAddress };
    } catch {
      /* next candidate */
    }
  }
  return null;
}

export async function discoverWxaAccountWithWlpBalance(
  client: WaterXClient,
  minWlpBalance = 1n,
): Promise<DiscoveredWxaAccount | null> {
  return discoverWxaAccountWithStoredBalance(client, {
    coinType: client.wlpType(),
    minBalance: minWlpBalance,
  });
}

export async function discoverWxaAccountWithUsdcForWlpMint(
  client: WaterXClient,
  minUsdc: bigint,
): Promise<DiscoveredWxaAccount | null> {
  let usdcType: string;
  try {
    usdcType = client.getPoolTokenType("USDCUSD");
  } catch {
    return null;
  }
  return discoverWxaAccountWithStoredBalance(client, { coinType: usdcType, minBalance: minUsdc });
}

function redeemRequestIdBigInt(r: RedeemRequestDataView): bigint {
  const x = recordStr(r) ?? {};
  const raw = x.request_id ?? x.requestId;
  return typeof raw === "bigint" ? raw : BigInt(String(raw ?? "0"));
}

function redeemRecipientAccountId(r: RedeemRequestDataView): string {
  const x = recordStr(r) ?? {};
  const v = x.recipient_account_id ?? x.recipientAccountId;
  return typeof v === "string" ? v : String(v ?? "");
}

function redeemLpAmountBigInt(r: RedeemRequestDataView): bigint {
  const x = recordStr(r) ?? {};
  const raw = x.lp_amount ?? x.lpAmount;
  return typeof raw === "bigint" ? raw : BigInt(String(raw ?? "0"));
}

function redeemTokenTypeFqName(r: RedeemRequestDataView): string {
  const x = recordStr(r) ?? {};
  const tt = x.token_type ?? x.tokenType;
  if (typeof tt === "string") return tt;
  const inner = recordStr(tt);
  if (inner && typeof inner.name === "string") return inner.name;
  return "";
}

function redeemRecipientAccountCandidates(requests: RedeemRequestDataView[]): string[] {
  const out: string[] = [];
  for (const r of requests) {
    const acc = redeemRecipientAccountId(r);
    if (acc) out.push(acc);
  }
  return out;
}

/** Pending redeem row for a specific wxa `accountId`, if owner resolves. */
export async function findPendingRedeemForAccount(
  client: WaterXClient,
  accountId: string,
): Promise<DiscoveredRedeemRequest | null> {
  const want = normAddr(accountId);
  let cursor = 0n;
  let usdcFallback: string;
  try {
    usdcFallback = client.getPoolTokenType("USDCUSD");
  } catch {
    usdcFallback = "";
  }

  for (let page = 0; page < 5; page++) {
    const { requests, nextCursor } = await getRedeemRequests(client, { cursor, pageSize: 50n });
    for (const r of requests) {
      const recipient = redeemRecipientAccountId(r);
      if (!recipient || normAddr(recipient) !== want) continue;
      const requestId = redeemRequestIdBigInt(r);
      if (requestId === 0n) continue;
      try {
        const ownerAddress = await getAccountOwnerByAccountId(client, recipient);
        const tokenFq = redeemTokenTypeFqName(r) || usdcFallback;
        if (!tokenFq) continue;
        return {
          accountId: recipient,
          ownerAddress,
          requestId,
          lpAmount: redeemLpAmountBigInt(r),
          redeemTokenType: tokenFq,
        };
      } catch {
        /* next row */
      }
    }
    if (nextCursor === undefined) break;
    cursor = nextCursor;
  }
  return null;
}

/** First redeem-queue row whose recipient wxa account owner resolves (for cancel simulate). */
export async function discoverPendingRedeemRequest(
  client: WaterXClient,
): Promise<DiscoveredRedeemRequest | null> {
  let cursor = 0n;
  let usdcFallback: string;
  try {
    usdcFallback = client.getPoolTokenType("USDCUSD");
  } catch {
    usdcFallback = "";
  }

  for (let page = 0; page < 5; page++) {
    const { requests, nextCursor } = await getRedeemRequests(client, { cursor, pageSize: 50n });
    for (const r of requests) {
      const accountId = redeemRecipientAccountId(r);
      const requestId = redeemRequestIdBigInt(r);
      if (!accountId || requestId === 0n) continue;
      try {
        const ownerAddress = await getAccountOwnerByAccountId(client, accountId);
        const tokenFq = redeemTokenTypeFqName(r) || usdcFallback;
        if (!tokenFq) continue;
        return {
          accountId,
          ownerAddress,
          requestId,
          lpAmount: redeemLpAmountBigInt(r),
          redeemTokenType: tokenFq,
        };
      } catch {
        /* next row */
      }
    }
    if (nextCursor === undefined) break;
    cursor = nextCursor;
  }
  return null;
}

/**
 * Stateful simulate position discovery: optional env wxa account first (integration persistent slots),
 * then global market scan across lifecycle tickers.
 */
export async function discoverStatefulSimulatePosition(
  client: WaterXClient,
  opts: DiscoverActivePositionOpts = DISCOVERY_OPTS_STATEFUL_SIMULATE,
): Promise<DiscoveredPosition | null> {
  for (const accountId of envWxaAccountIdHints()) {
    for (const ticker of activeLifecycleTickersForClient(client)) {
      try {
        const hit = await discoverActivePositionForAccount(client, ticker, accountId, opts);
        if (hit) return hit;
      } catch {
        /* try next ticker */
      }
    }
  }

  for (const ticker of activeLifecycleTickersForClient(client)) {
    try {
      const hit = await discoverActivePosition(client, ticker, opts);
      if (hit) return hit;
    } catch {
      /* try next ticker */
    }
  }
  return null;
}

const WLP_WALLET_OWNER_CANDIDATE_CAP = 30;

function redeemRecipientWalletCandidates(requests: RedeemRequestDataView[]): string[] {
  const out: string[] = [];
  for (const r of requests) {
    const acc = redeemRecipientAccountId(r);
    if (acc) out.push(acc);
  }
  return out;
}

export async function discoverWalletOwnerWithCollateralCoin(
  client: WaterXClient,
  opts: {
    collateralPoolTicker: string;
    minBalance: bigint;
    probeMinAccountUsdc: bigint;
  },
): Promise<{ owner: string; coinObjectId: string; balance: bigint } | null> {
  let coinType: string;
  try {
    coinType = client.getPoolTokenType(opts.collateralPoolTicker);
  } catch {
    return null;
  }

  const candidates: string[] = [];
  const env = process.env.WATERX_E2E_WALLET_USDC_OWNER?.trim();
  if (env) candidates.push(env);

  try {
    const { requests } = await getRedeemRequests(client, { cursor: 0n, pageSize: 50n });
    for (const accId of redeemRecipientWalletCandidates(requests)) {
      try {
        const owner = await getAccountOwnerByAccountId(client, accId);
        candidates.push(owner);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const perMarket = await discoverPositionsForAllActiveMarkets(client);
    for (const hit of perMarket.values()) {
      if (hit?.ownerAddress) candidates.push(hit.ownerAddress);
      if (candidates.length >= WLP_WALLET_OWNER_CANDIDATE_CAP) break;
    }
  } catch {
    /* ignore */
  }

  try {
    const probe = await discoverFundedProbe(client, {
      minAccountUsdcBalance: opts.probeMinAccountUsdc,
    });
    if (probe) candidates.push(probe.ownerAddress);
  } catch {
    /* ignore */
  }

  const seen = new Set<string>();
  for (const owner of candidates) {
    const key = normAddr(owner);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const { objects } = await client.listCoins({ owner, coinType });
      let best: { objectId: string; balance: bigint } | null = null;
      for (const o of objects) {
        const bal = BigInt(o.balance ?? "0");
        if (bal < opts.minBalance) continue;
        if (!best || bal > best.balance) best = { objectId: o.objectId, balance: bal };
      }
      if (best) return { owner, coinObjectId: best.objectId, balance: best.balance };
    } catch {
      /* next candidate */
    }
  }
  return null;
}

export async function discoverWalletOwnerWithWlpCoin(
  client: WaterXClient,
  opts: { probeMinAccountUsdc: bigint },
): Promise<string | null> {
  const wlpType = client.wlpType();
  const candidates: string[] = [];
  const env = process.env.WATERX_E2E_WLP_REDEEM_OWNER?.trim();
  if (env) candidates.push(env);

  try {
    const { requests } = await getRedeemRequests(client, { cursor: 0n, pageSize: 50n });
    for (const accId of redeemRecipientWalletCandidates(requests)) {
      try {
        const owner = await getAccountOwnerByAccountId(client, accId);
        candidates.push(owner);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const perMarket = await discoverPositionsForAllActiveMarkets(client);
    for (const hit of perMarket.values()) {
      if (hit?.ownerAddress) candidates.push(hit.ownerAddress);
      if (candidates.length >= WLP_WALLET_OWNER_CANDIDATE_CAP) break;
    }
  } catch {
    /* ignore */
  }

  try {
    const probe = await discoverFundedProbe(client, {
      minAccountUsdcBalance: opts.probeMinAccountUsdc,
    });
    if (probe) candidates.push(probe.ownerAddress);
  } catch {
    /* ignore */
  }

  const seen = new Set<string>();
  for (const owner of candidates) {
    const key = normAddr(owner);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const { objects } = await client.listCoins({ owner, coinType: wlpType });
      if (objects.some((o) => BigInt(o.balance) > 0n)) return owner;
    } catch {
      /* next candidate */
    }
  }
  return null;
}

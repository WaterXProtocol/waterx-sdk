/**
 * On-chain discovery for e2e simulates: paginated `getMarketPositions` + account/coin gates.
 * For “no hits vs strict filters”, run `pnpm audit:e2e-discovery` (`scripts/audit-e2e-discovery-filters.ts`), which mirrors these gates.
 */
import type { WaterXClient } from "../../../src/client.ts";
import type { BaseAsset, CollateralAsset } from "../../../src/constants.ts";
import {
  getAccountBalance,
  getAccountCoins,
  getMarketCooldownMs,
  getMarketPositions,
  getMarketSummary,
  getRedeemRequests,
} from "../../../src/fetch.ts";
import type { PositionDataView } from "../../../src/view-types.ts";
import { resolveDefaultUsdcCoinProbeAttempts } from "./e2e-discovery-caps.ts";
import { getAccountOwnerByAccountId } from "./fetch-read-helpers-for-tests.ts";
import { activeLifecycleTestBases, lifecycleRow } from "./lifecycle-test-markets.ts";
import { runWithConcurrency } from "./run-with-concurrency.ts";

export { resolveDefaultUsdcCoinProbeAttempts };

export type DiscoveredPosition = {
  base: BaseAsset;
  positionId: bigint;
  position: PositionDataView;
  accountObjectAddress: string;
  ownerAddress: string;
  /** `CollateralAsset` matching `position.collateralType`, resolved via `client.config.collaterals`. */
  collateral: CollateralAsset;
};

function normalizeType(t: string): string {
  return t.replace(/^0x/i, "").toLowerCase();
}

/**
 * Map a position/order raw `collateralType` (Move `TypeName` string) to a SDK
 * `CollateralAsset` key. Defaults to `"USDC"` if no configured collateral matches.
 */
export function resolveCollateralAssetFromType(
  client: WaterXClient,
  collateralType: string,
): CollateralAsset {
  const target = normalizeType(collateralType);
  const entries = Object.entries(client.config.collaterals) as [
    CollateralAsset,
    { type: string },
  ][];
  for (const [asset, cfg] of entries) {
    if (normalizeType(cfg.type) === target) return asset;
  }
  return "USDC";
}

function cooldownElapsed(updateTimestampMs: bigint, cooldownMs: bigint, slackMs = 750): boolean {
  const eligibleAt = Number(updateTimestampMs) + Number(cooldownMs) + slackMs;
  return Date.now() >= eligibleAt;
}

/** Histogram / audit labels — keep stable for `pnpm audit:e2e-discovery`. */
export type DiscoverPositionGateResult =
  | { ok: true; ownerAddress: string }
  | { ok: false; code: string; detail?: string };

export type DiscoverPositionGateCtx = {
  maxLevBpsForFilter: bigint | null;
  cooldownMs: bigint;
  usdcType: string;
};

/**
 * Mutable USDC coin-split probe budget for {@link discoverActivePosition} only (increments `.used`
 * per candidate that reaches the coin-split check). Omit in audit histograms.
 */
export type DiscoverPositionUsdcProbeBudget = { used: number; max: number };

/**
 * Single-position gates shared with `scripts/audit-e2e-discovery-filters.ts` — must stay aligned
 * with {@link discoverActivePosition}.
 */
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

  if (p.size <= 0n) return { ok: false, code: "size_zero" };
  if (minPos != null && minPos > 0n && p.size < minPos) {
    return { ok: false, code: "min_position_size", detail: `${p.size} < ${minPos}` };
  }
  if (p.collateralAmount < minCol) {
    return {
      ok: false,
      code: "min_collateral_amount",
      detail: `${p.collateralAmount} < ${minCol}`,
    };
  }
  if (requireCd && ctx.cooldownMs > 0n && !cooldownElapsed(p.updateTimestamp, ctx.cooldownMs)) {
    return { ok: false, code: "cooldown_not_elapsed" };
  }
  if (ctx.maxLevBpsForFilter != null && utilPct != null) {
    const cap = (ctx.maxLevBpsForFilter * BigInt(utilPct)) / 100n;
    if (p.leverageBps > cap) {
      return {
        ok: false,
        code: "leverage_above_util_cap",
        detail: `leverageBps=${p.leverageBps} cap=${cap} (maxMarket=${ctx.maxLevBpsForFilter} util=${utilPct}%)`,
      };
    }
  }

  let ownerAddress: string;
  try {
    ownerAddress = await getAccountOwnerByAccountId(client, p.accountObjectAddress);
  } catch (e) {
    return {
      ok: false,
      code: "owner_lookup_failed",
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  if (minAccUsdc > 0n) {
    try {
      const bal = await getAccountBalance(client, p.accountObjectAddress, ctx.usdcType);
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
    const asset = resolveCollateralAssetFromType(client, p.collateralType);
    const collType = client.config.collaterals[asset].type;
    try {
      const bal = await getAccountBalance(client, p.accountObjectAddress, collType);
      if (bal < minCollBal) {
        return {
          ok: false,
          code: "position_collateral_balance_low",
          detail: `${asset} have=${bal} need>=${minCollBal}`,
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
      const coins = await getAccountCoins(client, p.accountObjectAddress, ctx.usdcType);
      const eligible = coins.filter((c) => BigInt(c.balance) >= minPerUsdcCoin).length;
      if (eligible < minUsdcObjects) {
        return {
          ok: false,
          code: "usdc_coin_objects_insufficient",
          detail: `eligible=${eligible} need>=${minUsdcObjects} (minPerCoin=${minPerUsdcCoin})`,
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

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
}

export type DiscoverActivePositionOpts = {
  maxPages?: number;
  pageSize?: number;
  minCollateralAmount?: bigint;
  requireCooldownElapsed?: boolean;
  /**
   * When set, only return positions whose `accountObjectAddress` has
   * `getAccountBalance(USDC) ≥ minAccountUsdcBalance`. Used to pick probes that
   * can actually fund `buildOpenPositionTx` / `buildDepositCollateralTx` on
   * shared chains.
   */
  minAccountUsdcBalance?: bigint;
  /**
   * When set (1–99), require `position.leverageBps <= (market.maxLeverageBps * pct) / 100`
   * so sequential withdraw / resize simulates do not immediately hit `err_exceed_max_leverage` (104)
   * on shared-chain positions that already sit at the cap.
   */
  maxLeverageUtilizationPercent?: number;
  /**
   * When set, require the account's balance for **this position's collateral coin type** to be
   * at least this amount (raw units). Covers USDC/USDSUI when `buildIncreasePositionTx` pulls
   * from the same account balance.
   */
  minAccountBalanceForPositionCollateral?: bigint;
  /**
   * When set with {@link minBalancePerUsdcCoin}, require at least this many TTO USDC coin objects
   * on the account, each with balance ≥ `minBalancePerUsdcCoin` (for single-PTB flows that pass
   * two distinct `receivingCoins`).
   */
  minUsdcCoinObjects?: number;
  /**
   * Raw units per USDC coin object; required when `minUsdcCoinObjects` is set (≥ 1).
   */
  minBalancePerUsdcCoin?: bigint;
  /**
   * Max `getAccountCoins` probes while scanning (only applies when `minUsdcCoinObjects` is set).
   * After this many eligible candidates still lack enough coin objects, discovery returns `null`.
   * Override with `WATERX_E2E_DISCOVERY_MAX_USDC_COIN_PROBES` (1–500; default **90**).
   */
  maxUsdcCoinProbeAttempts?: number;
  /**
   * Require `position.size` (u128 from `view::PositionData`) ≥ this value.
   * Use on shared mainnet where microscopic positions cannot satisfy v2 partial-close dust rules.
   */
  minPositionSize?: bigint;
  /**
   * `first` (default): return the first row matching filters (cheap).
   * `maxSize`: scan up to {@link maxPages} and return the eligible position with the largest `size`
   * (better for partial decrease / thin markets when early pages skew small).
   */
  positionPick?: "first" | "maxSize";
};

function resolveDefaultStatefulLeverageUtilPct(): number {
  const raw = process.env.WATERX_E2E_DISCOVERY_MAX_LEVERAGE_UTIL_PCT?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 1 && n <= 99) return n;
  }
  /**
   * Default 93: thin mainnet books often sit >90% of `maxLeverageBps`; matrix withdraw uses a tiny
   * collateral fraction (see derive-simulate-scenarios). Tighten via `WATERX_E2E_DISCOVERY_MAX_LEVERAGE_UTIL_PCT`.
   */
  return 93;
}

/** Final matrix tier only: relax leverage util% after stricter tiers miss (default 95). */
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

/** Floor for {@link DISCOVERY_OPTS_STATEFUL_SIMULATE_PARTIAL_DECREASE} (v2 partial-close dust). */
function resolvePartialDecreaseMinPositionSize(): bigint {
  const raw = process.env.WATERX_E2E_DISCOVERY_MIN_POSITION_SIZE?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = BigInt(raw);
    if (n > 0n) return n;
  }
  return 500_000n;
}

/**
 * Recommended filters for **stateful** simulate runners (increase / deposit / withdraw / full close):
 * skip near–max-leverage discoveries and accounts that cannot fund the next collateral leg.
 *
 * Does **not** set {@link DiscoverActivePositionOpts.minPositionSize} — use that for tiny positions
 * (e.g. PRD full close, collateral probes). For suites that **partial decrease** on v2 mainnet, use
 * {@link DISCOVERY_OPTS_STATEFUL_SIMULATE_PARTIAL_DECREASE} instead.
 *
 * **Not** where we assert protocol edge cases: `err_exceed_max_leverage` (104) at max leverage is
 * covered by dedicated suites (e.g. `trading-negative-simulate`, PRD TC-TRADE-003) that build
 * explicit `openPosition` / `withdraw` cases — use {@link discoverActivePositionForNegativeOpen} when
 * the PTB uses default USDC receiving coins. This preset only stabilizes **happy-path** dry-runs on
 * arbitrary discovered positions.
 *
 * Override leverage cutoff with `WATERX_E2E_DISCOVERY_MAX_LEVERAGE_UTIL_PCT` (1–99; default **93**).
 * Matrix adds a last tier with `WATERX_E2E_DISCOVERY_LAST_TIER_LEVERAGE_PCT` (1–99; default **98**)
 * when stricter tiers still miss. Override page depth with `WATERX_E2E_DISCOVERY_MAX_PAGES` (1–50).
 */
export const DISCOVERY_OPTS_STATEFUL_SIMULATE: DiscoverActivePositionOpts = {
  maxPages: resolveStatefulDiscoveryMaxPages(),
  maxLeverageUtilizationPercent: resolveDefaultStatefulLeverageUtilPct(),
  /** `e2ePtb.increaseCollateral` is typically 5 USDC; keep headroom for fees / rounding. */
  minAccountBalanceForPositionCollateral: 6_000_000n,
};

/**
 * Like {@link DISCOVERY_OPTS_STATEFUL_SIMULATE} but requires a larger `position.size` so
 * `buildDecreasePositionTx` / matrix partial closes are less likely to hit `err_invalid_size` (201)
 * on v2 shared mainnet (microscopic remainders vs chain dust rules).
 */
export const DISCOVERY_OPTS_STATEFUL_SIMULATE_PARTIAL_DECREASE: DiscoverActivePositionOpts = {
  ...DISCOVERY_OPTS_STATEFUL_SIMULATE,
  minPositionSize: resolvePartialDecreaseMinPositionSize(),
  positionPick: "maxSize",
};

/**
 * Apply discovery options in order until one returns a row. Use when strict filters
 * (e.g. {@link DISCOVERY_OPTS_STATEFUL_SIMULATE_PARTIAL_DECREASE}) yield no hit on a thin market
 * but a relaxed tier may still find a suitable position for other matrix ops; callers that run
 * partial decrease should treat simulate `201` as skip (see `stateDependentSimulateSkipReason` in simulate-assertions).
 */
export async function discoverActivePositionFirstMatchingTiers(
  client: WaterXClient,
  base: BaseAsset,
  tiers: readonly DiscoverActivePositionOpts[],
): Promise<DiscoveredPosition | null> {
  for (const opts of tiers) {
    const hit = await discoverActivePosition(client, base, opts);
    if (hit) return hit;
  }
  return null;
}

/**
 * Strict partial-decrease tier → stateful + maxSize → deeper pages (same lev util) → optional
 * **last** tier with higher `maxLeverageUtilizationPercent` only when still no hit (shared mainnet
 * often has only >88% max-leverage positions for thin bases).
 */
export function discoveryTiersForStatefulMatrix(): DiscoverActivePositionOpts[] {
  const pages = Math.max(resolveStatefulDiscoveryMaxPages(), 20);
  const { minAccountBalanceForPositionCollateral, maxLeverageUtilizationPercent } =
    DISCOVERY_OPTS_STATEFUL_SIMULATE;
  const lastLev = resolveLastTierStatefulLeverageUtilPct();
  const deepTier: DiscoverActivePositionOpts = {
    maxPages: pages,
    positionPick: "maxSize",
    /** Without this, tier-3 hits are often "position exists, zero spendable collateral" → fetchAccountCoins throws. */
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

/** Append a 99% max-leverage tier when the ladder’s last tier is still below that cap. */
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

/**
 * Same tier ladder as {@link discoveryTiersForStatefulMatrix}, but every tier's
 * `maxLeverageUtilizationPercent` is capped at `ceilingUtilPct` (and the optional
 * fourth tier at `min(ceilingUtilPct + 7, 99)`). Use for bases where default tiers
 * pick positions that still hit `err_exceed_max_leverage` (104) on small withdraws.
 */
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

/** Tighter leverage util% for SPYX matrix (still below default tiers’ final 99). Override: `WATERX_E2E_DISCOVERY_SPYX_MAX_LEV_UTIL_PCT`. */
function resolveSpyxStatefulLeverageUtilCap(): number {
  const raw = process.env.WATERX_E2E_DISCOVERY_SPYX_MAX_LEV_UTIL_PCT?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 1 && n <= 99) return n;
  }
  return 82;
}

/**
 * {@link discoveryTiersForStatefulMatrix} for most bases; **SPYX** uses a lower
 * leverage ceiling so discovered rows keep headroom for positive withdraw simulates.
 */
export function discoveryTiersForStatefulMatrixForBase(base: BaseAsset) {
  return base === "SPYX"
    ? discoveryTiersForStatefulMatrixLeverageCap(resolveSpyxStatefulLeverageUtilCap())
    : discoveryTiersForStatefulMatrix();
}

/**
 * Discovery for suites that call {@link buildOpenPositionTx} with **default USDC** collateral on a
 * discovered account: require TTO USDC balance ≥ that market's `simulateOpenCollateral` (see
 * `lifecycle-test-markets`) so `fetchAccountCoins` / `openPosition` can pull receiving coins (same
 * bar covers the tiny `collateralAmount: 1n` probe and the `simulateOpenCollateral` above-max-leverage case).
 */
export async function discoverActivePositionForNegativeOpen(
  client: WaterXClient,
  base: BaseAsset,
  opts?: Omit<DiscoverActivePositionOpts, "minAccountUsdcBalance">,
): Promise<DiscoveredPosition | null> {
  const row = lifecycleRow(base);
  return discoverActivePosition(client, base, {
    ...opts,
    minAccountUsdcBalance: row.simulateOpenCollateral,
  });
}

/**
 * Paginate `getMarketPositions`, pick first open position with optional collateral / cooldown filters,
 * then resolve owner via `get_account_owner`.
 */
export async function discoverActivePosition(
  client: WaterXClient,
  base: BaseAsset,
  opts?: DiscoverActivePositionOpts,
): Promise<DiscoveredPosition | null> {
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

  const m = client.getMarketEntry(base);
  let maxLevBpsForFilter: bigint | null = null;
  if (utilPct != null && utilPct >= 1 && utilPct <= 99) {
    try {
      const summary = await getMarketSummary(client, m.marketId, m.baseType);
      maxLevBpsForFilter = summary.maxLeverageBps;
    } catch {
      maxLevBpsForFilter = null;
    }
  }

  const basePriceUsd = Math.max(1, Math.round(lifecycleRow(base).approxPrice));
  let cursor = 0;
  const usdcType = client.config.collaterals.USDC.type;
  const cooldownMs = await getMarketCooldownMs(client, m.marketId);
  let best: DiscoveredPosition | null = null;

  for (let page = 0; page < maxPages; page++) {
    const { positions, nextCursor } = await getMarketPositions(
      client,
      base,
      basePriceUsd,
      cursor,
      pageSize,
      1,
    );

    for (const p of positions) {
      const gate = await evaluatePositionAgainstDiscoverOpts(
        client,
        p,
        opts ?? {},
        { maxLevBpsForFilter, cooldownMs, usdcType },
        requireUsdcCoinSplit ? usdcProbeState : null,
      );
      if (!gate.ok) {
        if (gate.code === "usdc_probes_exhausted") return null;
        continue;
      }

      const row: DiscoveredPosition = {
        base,
        positionId: p.positionId,
        position: p,
        accountObjectAddress: p.accountObjectAddress,
        ownerAddress: gate.ownerAddress,
        collateral: resolveCollateralAssetFromType(client, p.collateralType),
      };
      if (positionPick === "first") {
        return row;
      }
      if (best == null || p.size > best.position.size) {
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

/**
 * Pick the first discoverable {@link DiscoveredPosition} across
 * {@link activeLifecycleTestBases} whose account satisfies
 * `minAccountUsdcBalance` (and other {@link DiscoverActivePositionOpts}).
 *
 * Intended for `beforeAll` probes in simulate suites that must dry-run
 * `buildOpenPositionTx` on a real account with USDC TTO coins.
 *
 * By default scans lifecycle bases with **bounded concurrency** (default **3** in-flight
 * probes) to limit RPC bursts, then returns the **first hit in base list order**.
 * Set `WATERX_E2E_DISCOVERY_PROBE_PARALLEL=0` for fully sequential scanning.
 * Override concurrency with `WATERX_E2E_DISCOVERY_PROBE_CONCURRENCY` (1–8, default 3).
 */
export async function discoverFundedProbe(
  client: WaterXClient,
  opts: DiscoverActivePositionOpts & { minAccountUsdcBalance: bigint },
): Promise<DiscoveredPosition | null> {
  const bases = activeLifecycleTestBases();
  if (bases.length === 0) return null;

  const scanOpts = mergeFundedProbeScanOpts(opts);

  const parallel =
    process.env.WATERX_E2E_DISCOVERY_PROBE_PARALLEL?.trim() !== "0" &&
    process.env.WATERX_E2E_DISCOVERY_PROBE_PARALLEL?.trim() !== "false";

  if (!parallel) {
    for (const base of bases) {
      const hit = await discoverActivePosition(client, base, scanOpts);
      if (hit) return hit;
    }
    return null;
  }

  const conc = resolveDiscoveryProbeConcurrency();
  const hits = await runWithConcurrency(bases, conc, (base) =>
    discoverActivePosition(client, base, scanOpts),
  );
  for (let i = 0; i < bases.length; i++) {
    const hit = hits[i];
    if (hit) return hit;
  }
  return null;
}

/**
 * Funded account for a compound PTB that **opens** on `openOnBase` using `nextPositionId`:
 * scans lifecycle bases **except** `openOnBase`, then rejects any hit whose account still has an
 * open position on `openOnBase` (otherwise `openPosition` + fresh id can abort with `err_invalid_size` (201)).
 */
export async function discoverFundedProbeWithoutPositionOnBase(
  client: WaterXClient,
  openOnBase: BaseAsset,
  opts: DiscoverActivePositionOpts & { minAccountUsdcBalance: bigint },
): Promise<DiscoveredPosition | null> {
  const scanOpts = mergeFundedProbeScanOpts(opts);
  const others = activeLifecycleTestBases().filter((b) => b !== openOnBase);
  for (const scanBase of others) {
    const hit = await discoverActivePosition(client, scanBase, scanOpts);
    if (!hit) continue;
    const openOnTarget = await discoverActivePositionForAccount(
      client,
      openOnBase,
      hit.accountObjectAddress,
      { maxPages: 8, requireCooldownElapsed: false },
    );
    if (openOnTarget == null) return hit;
  }
  return null;
}

function resolveDiscoveryProbeConcurrency(): number {
  const raw = process.env.WATERX_E2E_DISCOVERY_PROBE_CONCURRENCY?.trim();
  if (!raw) return 3;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(8, Math.floor(n));
}

/**
 * Like {@link discoverActivePosition}, but only returns a position owned by `accountObjectAddress`.
 */
export async function discoverActivePositionForAccount(
  client: WaterXClient,
  base: BaseAsset,
  accountObjectAddress: string,
  opts?: DiscoverActivePositionOpts,
): Promise<DiscoveredPosition | null> {
  const maxPages = opts?.maxPages ?? 12;
  const pageSize = opts?.pageSize ?? 40;
  const positionPick = opts?.positionPick ?? "first";
  const want = normAddr(accountObjectAddress);

  const basePriceUsd = Math.max(1, Math.round(lifecycleRow(base).approxPrice));
  let cursor = 0;
  const m = client.getMarketEntry(base);
  const cooldownMs = await getMarketCooldownMs(client, m.marketId);
  const usdcType = client.config.collaterals.USDC.type;
  let best: DiscoveredPosition | null = null;

  for (let page = 0; page < maxPages; page++) {
    const { positions, nextCursor } = await getMarketPositions(
      client,
      base,
      basePriceUsd,
      cursor,
      pageSize,
      1,
    );

    for (const p of positions) {
      if (normAddr(p.accountObjectAddress) !== want) continue;
      const gate = await evaluatePositionAgainstDiscoverOpts(
        client,
        p,
        opts ?? {},
        { maxLevBpsForFilter: null, cooldownMs, usdcType },
        null,
      );
      if (!gate.ok) continue;

      const row: DiscoveredPosition = {
        base,
        positionId: p.positionId,
        position: p,
        accountObjectAddress: p.accountObjectAddress,
        ownerAddress: gate.ownerAddress,
        collateral: resolveCollateralAssetFromType(client, p.collateralType),
      };
      if (positionPick === "first") {
        return row;
      }
      if (best == null || p.size > best.position.size) {
        best = row;
      }
    }

    if (nextCursor === undefined) break;
    cursor = nextCursor;
  }

  return best;
}

/** Skip text for matrix / lifecycle: `discoverActivePosition` + stateful filters found no row. */
export function e2eSkipReasonNoEligibleMarketPosition(base: BaseAsset): string {
  return `No eligible open ${base} position found via market scan`;
}

/** Skip text for scratch stateful ops: no open position for this base in paginated discovery. */
export function e2eSkipReasonNoOpenPositionMarketDiscovery(base: BaseAsset): string {
  return `No open ${base} position via market discovery`;
}

/** Skip when `minUsdcCoinObjects` discovery exhausted `maxUsdcCoinProbeAttempts` without a match. */
export function e2eSkipReasonUsdcCoinProbeExhausted(maxProbes: number): string {
  return `USDC coin-object discovery exhausted after ${maxProbes} candidate probes (no account with enough split coins)`;
}

/**
 * Skip text when {@link discoverActivePosition} returned `null` with USDC coin-object filters:
 * either no eligible row or probe budget exhausted (indistinguishable without API change).
 */
export function e2eSkipReasonNoPositionMatchingUsdcCoinSplit(
  base: BaseAsset,
  maxProbes: number,
): string {
  return `No eligible open ${base} position with required USDC coin split (market scan or ${maxProbes} coin probes exhausted)`;
}

export async function discoverPositionsForAllActiveMarkets(
  client: WaterXClient,
): Promise<Map<BaseAsset, DiscoveredPosition>> {
  const out = new Map<BaseAsset, DiscoveredPosition>();
  for (const base of activeLifecycleTestBases()) {
    const hit = await discoverActivePosition(client, base, DISCOVERY_OPTS_STATEFUL_SIMULATE);
    if (hit) out.set(base, hit);
  }
  return out;
}

/**
 * Find a wallet `owner` that holds a non-zero WLP coin balance for redeem/cancel dry-runs.
 *
 * Candidate order (dedup, cap at {@link WLP_WALLET_OWNER_CANDIDATE_CAP}):
 *   1. `WATERX_E2E_WLP_REDEEM_OWNER` env override.
 *   2. Every recipient from `getRedeemRequests(0, 50)` (not just the first) —
 *      many WLP holders parked their WLP in their wallet before requesting redeem.
 *   3. Every owner of a discovered open position across all lifecycle bases —
 *      people who actively trade also sometimes hold WLP on the wallet side.
 *   4. The funded probe owner (fallback).
 *
 * For each candidate, check `listCoins({ owner, coinType: wlpType })` for a
 * positive-balance coin object. First hit wins.
 */
const WLP_WALLET_OWNER_CANDIDATE_CAP = 30;

/**
 * Find a wallet `owner` that holds a **single** USDC (or configured collateral)
 * coin object with `balance >= minBalance`, across a bounded pool of
 * candidates (env override + redeem queue + open-position owners + funded probe).
 *
 * Returns `{ owner, coinObjectId, balance }` for the first candidate found.
 */
export async function discoverWalletOwnerWithCollateralCoin(
  client: WaterXClient,
  opts: {
    collateral: CollateralAsset;
    minBalance: bigint;
    probeMinAccountUsdc: bigint;
  },
): Promise<{ owner: string; coinObjectId: string; balance: bigint } | null> {
  const collateralCfg = client.config.collaterals[opts.collateral];
  if (!collateralCfg) return null;
  const coinType = collateralCfg.type;

  const candidates: string[] = [];
  const env = process.env.WATERX_E2E_WALLET_USDC_OWNER?.trim();
  if (env) candidates.push(env);

  try {
    const { requests } = await getRedeemRequests(client, 0, 50);
    for (const r of requests) {
      if (r?.recipient) candidates.push(r.recipient);
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
  const wlpType = client.config.wlpType;
  const candidates: string[] = [];
  const env = process.env.WATERX_E2E_WLP_REDEEM_OWNER?.trim();
  if (env) candidates.push(env);

  try {
    const { requests } = await getRedeemRequests(client, 0, 50);
    for (const r of requests) {
      if (r?.recipient) candidates.push(r.recipient);
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

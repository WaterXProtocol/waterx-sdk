// Shared, line-agnostic primitives (network id, scaling, decimals, time).
// Perp-domain enums (permissions / order tags / action codes) live in
// `perp/constants.ts`; prediction has its own `prediction/constants.ts`.

// ======== Network ========
export type Network = "MAINNET" | "TESTNET";

// ======== Scaling ========
/** Basis-point denominator (10_000). Matches BP_SCALE in the Move contracts. */
export const BPS_SCALE = 10_000n;

/** Float scaling factor (1e9). All `Float` values from `bucket_v2_framework` are 1e9-scaled. */
export const FLOAT_SCALE = 1_000_000_000n;

/** Double scaling factor (1e18). Used for high-precision intermediate values (e.g. u256 fields). */
export const DOUBLE_SCALE = 1_000_000_000_000_000_000n;

// ======== Token decimals ========
/** SUI coin decimals (gas + staking rewards). */
export const SUI_DECIMALS = 9;
/** WLP LP-token decimals. */
export const WLP_DECIMALS = 6;
/**
 * Decimals for **collateral-typed** values only: the CREDIT/wxUSD internal
 * balance and the USD-pegged trading collateral (USDC, USDSUI). All current
 * collateral and the CREDIT coin are 6-dec, and the config JSON carries no
 * credit decimal, so this constant is the single source for the CREDIT scale.
 *
 * Do NOT use it for custody **backing assets** — those carry a per-asset
 * `decimal` in config (`NativeCustodyAsset.decimal`), threaded through
 * `probeParkedBackingAssets` → `sumParkedBackingAsCreditRaw`. If a 9-dec
 * backing asset ever lists, a path that assumed flat 6 for it would mis-scale
 * its parked balance by 1000×; only a change to the CREDIT coin itself (or a
 * non-6-dec collateral listing) would require touching this constant.
 */
export const COLLATERAL_DECIMALS = 6;

/**
 * @deprecated Import the individual `SUI_DECIMALS` / `WLP_DECIMALS` /
 * `COLLATERAL_DECIMALS` constants instead. Kept as a back-compat shim so
 * downstream code that still does `import { TOKEN_DECIMALS }` keeps working;
 * removed in a future major.
 */
export const TOKEN_DECIMALS = {
  SUI: SUI_DECIMALS,
  USDC: COLLATERAL_DECIMALS,
  USDSUI: COLLATERAL_DECIMALS,
  WLP: WLP_DECIMALS,
} as const satisfies Record<string, number>;

// ======== Time ========
export const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

// ======== Well-known addresses ========
/**
 * Zero-address placeholder used as the sender in dry-run / simulate calls.
 * Line-agnostic (every read path simulates with it); re-exported from
 * `perp/constants.ts` for back-compat.
 */
export const DRY_RUN_SENDER = "0x0000000000000000000000000000000000000000000000000000000000000000";

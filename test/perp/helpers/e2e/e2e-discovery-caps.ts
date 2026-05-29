/**
 * Discovery caps shared by `discover-on-chain-position` and e2e tests (skip messages).
 * Kept in a tiny module so callers do not depend on cyclic initialization of the full discovery helper.
 */

/** Default / env-resolved cap for `getAccountCoins` probes in USDC coin-object discovery. */
export function resolveDefaultUsdcCoinProbeAttempts(): number {
  const raw = process.env.WATERX_E2E_DISCOVERY_MAX_USDC_COIN_PROBES?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 1 && n <= 500) return n;
  }
  return 90;
}

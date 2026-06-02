/**
 * Public WaterX testnet integration wxa account (persistent-state / preflight seed).
 * Not a secret — safe to commit so CI `pnpm test:e2e` can discover state without `.env.local`.
 *
 * Override: `WATERX_E2E_WXA_ACCOUNT_ID` / `WATERX_INTEGRATION_ACCOUNT_ID` (preferred when set).
 * Disable built-in fallback: `WATERX_E2E_DISABLE_CANONICAL_WXA=1`.
 * Replace canonical id: `WATERX_E2E_CANONICAL_WXA_ACCOUNT_ID=0x...`.
 */
import type { E2eNetwork } from "./e2e-client.ts";

export const E2E_CANONICAL_TESTNET_WXA_ACCOUNT_ID =
  "0x4e7598c3c095fbd274f4b04f6dd3715ab59bff744730f9b56d7312cedba4f054";

export const E2E_CANONICAL_TESTNET_WXA_OWNER =
  "0x26266b1381bcf03ab3acc37c1e87beffb52d49f345248bc3efb9114176990ae4";

function canonicalDisabled(): boolean {
  const f = process.env.WATERX_E2E_DISABLE_CANONICAL_WXA?.trim().toLowerCase();
  return f === "1" || f === "true" || f === "on" || f === "yes";
}

/** Built-in testnet wxa account id(s) when env hints are unset (empty on mainnet). */
export function e2eCanonicalWxaAccountIds(network: E2eNetwork): readonly string[] {
  if (network !== "testnet" || canonicalDisabled()) return [];
  const override = process.env.WATERX_E2E_CANONICAL_WXA_ACCOUNT_ID?.trim();
  if (override) return [override];
  return [E2E_CANONICAL_TESTNET_WXA_ACCOUNT_ID];
}

/** Owner for {@link e2eCanonicalWxaAccountIds} (no private key required in CI). */
export function e2eCanonicalWxaOwner(network: E2eNetwork): string | undefined {
  if (network !== "testnet" || canonicalDisabled()) return undefined;
  const override = process.env.WATERX_E2E_CANONICAL_WXA_OWNER?.trim();
  if (override) return override;
  return E2E_CANONICAL_TESTNET_WXA_OWNER;
}

/** Env wxa ids first, then canonical testnet account. */
export function wxaAccountIdHints(network: E2eNetwork): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id?: string) => {
    const t = id?.trim();
    if (!t) return;
    const k = t.replace(/^0x/i, "").toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  push(process.env.WATERX_E2E_WXA_ACCOUNT_ID);
  push(process.env.WATERX_INTEGRATION_ACCOUNT_ID);
  for (const id of e2eCanonicalWxaAccountIds(network)) {
    push(id);
  }
  return out;
}

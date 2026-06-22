/**
 * GET /predict/bets/me* path builders — public reads require `?address=` (backend #601).
 */
import type { TestContext } from "vitest";

import type { ApiEnvironment } from "./api-env.ts";
import { optionalEnv } from "./e2e-env.ts";

const SUI_ADDRESS_RE = /^0x[a-fA-F0-9]{64}$/;

export function isSuiWalletAddress(value: string | undefined): value is string {
  return typeof value === "string" && SUI_ADDRESS_RE.test(value);
}

/** Decode `suiAddress` (or `sub`) from a WaterX JWT without verifying signature. */
export function suiAddressFromJwt(jwt: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString()) as {
      suiAddress?: string;
      sub?: string;
    };
    const addr = payload.suiAddress ?? payload.sub;
    return isSuiWalletAddress(addr) ? addr : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Wallet for bets/me reads: `E2E_API_ADDRESS` → JWT `suiAddress` → optional override.
 * Matches frontend `?address=` contract (bucket-backend-mono #601).
 */
export function resolveBetsWalletAddress(
  env?: Pick<ApiEnvironment, "jwt"> | null,
  override?: string,
): string | undefined {
  const explicit = override?.trim() || optionalEnv("E2E_API_ADDRESS")?.trim();
  if (isSuiWalletAddress(explicit)) return explicit;
  const jwt = env?.jwt ?? optionalEnv("E2E_API_JWT");
  if (jwt) {
    const fromJwt = suiAddressFromJwt(jwt);
    if (fromJwt) return fromJwt;
  }
  return undefined;
}

export function skipIfNoBetsWallet(
  ctx: TestContext,
  wallet: string | undefined,
): asserts wallet is string {
  if (!wallet) {
    ctx.skip(
      true,
      "No wallet for GET /predict/bets/me* — set E2E_API_ADDRESS or E2E_API_JWT (suiAddress claim) or pass owner from integration ctx",
    );
  }
}

/** Ensure `?address=` is present on any `/predict/bets/me` path. */
export function withBetsAddress(path: string, wallet: string): string {
  if (!path.includes("/predict/bets/me")) return path;
  if (/[?&]address=/.test(path)) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}address=${encodeURIComponent(wallet)}`;
}

export function betsMeListPath(
  wallet: string,
  opts: { filter?: string; limit?: number; cursor?: string; locale?: string } = {},
): string {
  const q = new URLSearchParams();
  q.set("address", wallet);
  if (opts.filter) q.set("filter", opts.filter);
  if (opts.limit !== undefined) q.set("limit", String(opts.limit));
  if (opts.cursor) q.set("cursor", opts.cursor);
  if (opts.locale) q.set("locale", opts.locale);
  return `/predict/bets/me?${q.toString()}`;
}

export function betsMeSummaryPath(wallet: string, locale?: string): string {
  const q = new URLSearchParams({ address: wallet });
  if (locale) q.set("locale", locale);
  return `/predict/bets/me/summary?${q.toString()}`;
}

export function betsMeClaimablePath(wallet: string, locale?: string): string {
  const q = new URLSearchParams({ address: wallet });
  if (locale) q.set("locale", locale);
  return `/predict/bets/me/claimable?${q.toString()}`;
}

export function betsMeDetailPath(betId: string, wallet: string, extraQuery = ""): string {
  const q = new URLSearchParams({ address: wallet });
  if (extraQuery.startsWith("?")) {
    for (const [k, v] of new URLSearchParams(extraQuery.slice(1))) {
      if (k !== "address") q.set(k, v);
    }
  } else if (extraQuery) {
    for (const [k, v] of new URLSearchParams(extraQuery)) {
      if (k !== "address") q.set(k, v);
    }
  }
  return `/predict/bets/me/${encodeURIComponent(betId)}/detail?${q.toString()}`;
}

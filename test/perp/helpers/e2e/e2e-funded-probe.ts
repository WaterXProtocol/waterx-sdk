import type { PerpClient } from "@waterx/sdk";

import { e2eCanonicalWxaAccountIds, e2eCanonicalWxaOwner } from "./canonical-testnet-account.ts";
import {
  discoverActivePositionForAccount,
  discoverFundedProbe,
  type DiscoverActivePositionOpts,
} from "./discover-on-chain-position.ts";
import { PROBE_MIN_ACCOUNT_USDC, resolveE2eNetwork } from "./e2e-client.ts";
import { activeLifecycleTickersForClient } from "./lifecycle-test-markets.ts";

/** USDC gate for canonical integration wxa (lower than public `PROBE_MIN_ACCOUNT_USDC`). */
const CANONICAL_PROBE_MIN_ACCOUNT_USDC = 6_000_000n;

/** Subset of {@link discoverFundedProbe} result needed for `setSender` / `accountId` wiring in e2e. */
export type FundedProbe = {
  accountId: string;
  owner: string;
};

/** Resolve one funded probe owner + TTO account id, or `null` when discovery finds nothing. */
async function loadFundedProbeFromCanonicalAccount(
  client: PerpClient,
  extraDiscoverOpts?: Omit<DiscoverActivePositionOpts, "minAccountUsdcBalance">,
): Promise<FundedProbe | null> {
  const accountId = e2eCanonicalWxaAccountIds(resolveE2eNetwork())[0];
  const owner = e2eCanonicalWxaOwner(resolveE2eNetwork());
  if (!accountId || !owner) return null;

  for (const ticker of activeLifecycleTickersForClient(client)) {
    try {
      const hit = await discoverActivePositionForAccount(client, ticker, accountId, {
        minAccountUsdcBalance: CANONICAL_PROBE_MIN_ACCOUNT_USDC,
        minAccountBalanceForPositionCollateral: CANONICAL_PROBE_MIN_ACCOUNT_USDC,
        requireCooldownElapsed: false,
        maxLeverageUtilizationPercent: 99,
        ...extraDiscoverOpts,
      });
      if (hit) {
        return { accountId: hit.accountObjectAddress, owner: hit.ownerAddress };
      }
    } catch {
      /* try next ticker */
    }
  }
  return null;
}

export async function loadFundedProbe(
  client: PerpClient,
  minAccountUsdcBalance: bigint = PROBE_MIN_ACCOUNT_USDC,
  extraDiscoverOpts?: Omit<DiscoverActivePositionOpts, "minAccountUsdcBalance">,
): Promise<FundedProbe | null> {
  const canonical = await loadFundedProbeFromCanonicalAccount(client, extraDiscoverOpts);
  if (canonical) return canonical;

  const d = await discoverFundedProbe(client, {
    minAccountUsdcBalance,
    ...extraDiscoverOpts,
  });
  if (!d) return null;
  return { accountId: d.accountObjectAddress, owner: d.ownerAddress };
}

export function fundedProbeOpenPathSkipReason(minAccountUsdcBalance: bigint): string {
  return `No discovered open position with account USDC ≥ ${minAccountUsdcBalance} on any lifecycle market — cannot fund open-path simulate.`;
}

export function requireFundedProbe(
  ctx: { skip: (reason?: string) => void },
  probe: FundedProbe | null,
  minAccountUsdcBalance: bigint = PROBE_MIN_ACCOUNT_USDC,
): FundedProbe {
  if (probe) return probe;
  ctx.skip(fundedProbeOpenPathSkipReason(minAccountUsdcBalance));
  return null as never;
}

const SKIP_NO_PROBE_ACCOUNT = "No discovery probe account.";

export function firstAccountIdFromFundedProbe(
  ctx: { skip: (reason?: string) => void },
  probe: FundedProbe | null,
): string | null {
  if (!probe) {
    ctx.skip(SKIP_NO_PROBE_ACCOUNT);
    return null;
  }
  return probe.accountId;
}

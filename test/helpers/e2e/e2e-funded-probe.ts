import type { WaterXClient } from "@waterx/perp-sdk";

import { discoverFundedProbe } from "./discover-on-chain-position.ts";
import { PROBE_MIN_ACCOUNT_USDC } from "./e2e-client.ts";

/** Subset of {@link discoverFundedProbe} result needed for `setSender` / `accountId` wiring in e2e. */
export type FundedProbe = {
  accountId: string;
  owner: string;
};

/** Resolve one funded probe owner + TTO account id, or `null` when discovery finds nothing. */
export async function loadFundedProbe(
  client: WaterXClient,
  minAccountUsdcBalance: bigint = PROBE_MIN_ACCOUNT_USDC,
): Promise<FundedProbe | null> {
  const d = await discoverFundedProbe(client, { minAccountUsdcBalance });
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

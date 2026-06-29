/**
 * Thin e2e helpers for wxa stored-balance discovery (v3 mint / redeem / stake simulate).
 */
import type { PerpClient } from "../../../../src/perp/client.ts";
import {
  discoverPendingRedeemRequest,
  discoverStatefulSimulatePosition,
  discoverWxaAccountWithStoredBalance,
  discoverWxaAccountWithUsdcForWlpMint,
  discoverWxaAccountWithWlpBalance,
  DISCOVERY_OPTS_STATEFUL_SIMULATE,
  findPendingRedeemForAccount,
  type DiscoveredPosition,
  type DiscoveredRedeemRequest,
  type DiscoveredWxaAccount,
} from "./discover-on-chain-position.ts";
import { getWlpMinDepositForCollateral } from "./fetch-read-helpers-for-tests.ts";

export type { DiscoveredPosition, DiscoveredRedeemRequest, DiscoveredWxaAccount };

export {
  discoverPendingRedeemRequest,
  findPendingRedeemForAccount,
  discoverStatefulSimulatePosition,
  discoverWxaAccountWithStoredBalance,
  discoverWxaAccountWithUsdcForWlpMint,
  discoverWxaAccountWithWlpBalance,
  DISCOVERY_OPTS_STATEFUL_SIMULATE,
};

export async function loadWxaAccountForWlpMint(
  client: PerpClient,
): Promise<DiscoveredWxaAccount | null> {
  let minUsdc = 1_000_000n;
  try {
    const poolMin = await getWlpMinDepositForCollateral(client, "USDCUSD");
    if (poolMin > minUsdc) minUsdc = poolMin;
  } catch {
    /* fallback min */
  }
  return discoverWxaAccountWithUsdcForWlpMint(client, minUsdc);
}

export async function loadWxaAccountWithWlp(
  client: PerpClient,
  minWlp = 1n,
): Promise<DiscoveredWxaAccount | null> {
  return discoverWxaAccountWithWlpBalance(client, minWlp);
}

export function wxaDiscoverySkipReason(kind: "usdc-mint" | "wlp-balance" | "redeem-queue"): string {
  if (kind === "usdc-mint") {
    return "No wxa account with enough USDC for WLP mint (deposit policy + WaterXPerp asset gate; set WATERX_E2E_WXA_ACCOUNT_ID / run integration persistent-state)";
  }
  if (kind === "wlp-balance") {
    return "No wxa account with WLP balance (set WATERX_E2E_WXA_ACCOUNT_ID / run integration persistent-state)";
  }
  return "No pending redeem request on chain";
}

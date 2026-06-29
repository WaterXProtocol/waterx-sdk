import type { PerpClient } from "../../../../src/perp/client.ts";

const REWARDER_KEY_RE = /::waterx_staking::RewarderKey<(.+)>$/;

/**
 * Enumerate configured rewarder coin types on a staking pool via dynamic fields
 * (same approach as `scripts/smoke-staking-claim.ts`).
 */
export async function discoverStakingRewarderTypes(
  client: PerpClient,
  stakeAlias = "WLP",
): Promise<string[]> {
  const poolId = client.config.packages.waterx_staking?.pools?.[stakeAlias];
  if (!poolId) return [];

  const list = await client.listDynamicFields(poolId);
  const types: string[] = [];
  for (const entry of list.dynamicFields ?? []) {
    const nameType = (entry as { name?: { type?: string } }).name?.type ?? "";
    const match = REWARDER_KEY_RE.exec(nameType);
    if (match) types.push(match[1]!);
  }
  return types;
}

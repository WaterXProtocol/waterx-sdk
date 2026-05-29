import type { PredictClient } from "~predict/client.ts";
import { PredictClient as PredictClientClass } from "~predict/client.ts";
import { getKeeperAddresses } from "~predict/fetch.ts";

import { discoverFixtures as discoverFixturesFromChain } from "./e2e-discovery.ts";
import { readTestnetClientOverrides } from "./e2e-env.ts";

export type { E2eDiscoveryMeta, E2eFixtures } from "./e2e-discovery.ts";

export interface E2eContext {
  client: PredictClient;
  fixtures: import("./e2e-discovery.ts").E2eFixtures;
}

/** Testnet client using waterx-config defaults; optional `E2E_*` process.env overrides. */
export function createE2eClient(): Promise<PredictClient> {
  return PredictClientClass.testnet({ ...readTestnetClientOverrides(), cache: true });
}

/** Discover orders, positions, markets, accounts, and coins on testnet for dry-run E2E. */
export async function discoverFixtures(client: PredictClient) {
  const fixtures = await discoverFixturesFromChain(client);
  await getKeeperAddresses(client);
  return fixtures;
}

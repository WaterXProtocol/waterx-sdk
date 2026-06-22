import type { PredictClient } from "~predict/client.ts";
import { PredictClient as PredictClientClass } from "~predict/client.ts";
import { getKeeperAddresses } from "~predict/fetch.ts";

import { discoverFixtures as discoverFixturesFromChain } from "./e2e-discovery.ts";
import { readE2eClientOverrides } from "./e2e-env.ts";
import { predictE2eNetworkKey } from "./e2e-network.ts";

export type { E2eDiscoveryMeta, E2eFixtures } from "./e2e-discovery.ts";
export {
  predictE2eNetwork,
  predictE2eNetworkKey,
  resolvePredictE2eNetwork,
} from "./e2e-network.ts";

export interface E2eContext {
  client: PredictClient;
  fixtures: import("./e2e-discovery.ts").E2eFixtures;
}

/** E2E client for the active network (`WATERX_E2E_NETWORK` → testnet default). */
export function createE2eClient(): Promise<PredictClient> {
  return PredictClientClass.create(predictE2eNetworkKey(), {
    ...readE2eClientOverrides(),
    cache: true,
  });
}

/** Discover orders, positions, markets, accounts, and coins for dry-run E2E. */
export async function discoverFixtures(client: PredictClient) {
  const fixtures = await discoverFixturesFromChain(client);
  await getKeeperAddresses(client);
  return fixtures;
}

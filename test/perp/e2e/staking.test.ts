/**
 * E2E: staking deposit checker PTB (discovered wxa WLP balance; skipped when pool missing).
 */
import { Transaction } from "@mysten/sui/transactions";
import { stake } from "@waterx/sdk";
import { beforeAll, describe, it } from "vitest";

import { client, e2eNetwork } from "../helpers/e2e/e2e-client.ts";
import {
  loadWxaAccountWithWlp,
  wxaDiscoverySkipReason,
  type DiscoveredWxaAccount,
} from "../helpers/e2e/e2e-wxa-discovery.ts";
import {
  assertSimulateSuccess,
  simulateWithTransientRetry,
  skipSimulateIfOracleTransient,
} from "../helpers/e2e/simulate-assertions.ts";
import { discoverStakingRewarderTypes } from "../helpers/e2e/staking-rewarders.ts";

const stakingReady = Boolean(client.config.packages.waterx_staking?.pools?.WLP);

describe.skipIf(!stakingReady)(`staking (${e2eNetwork})`, () => {
  let wxa: DiscoveredWxaAccount | null;
  let rewarderTypes: string[] = [];

  beforeAll(async () => {
    wxa = await loadWxaAccountWithWlp(client, 1n);
    rewarderTypes = await discoverStakingRewarderTypes(client, "WLP");
  }, 240_000);

  it("stake() builds deposit + checker destroy plumbing (discovered wxa WLP)", async (ctx) => {
    const row = wxa;
    if (!row) {
      ctx.skip(wxaDiscoverySkipReason("wlp-balance"));
      return;
    }
    const tx = new Transaction();
    tx.setGasBudget(250_000_000);
    stake(client, tx, {
      accountId: row.accountId,
      stakeAlias: "WLP",
      stakeType: client.wlpType(),
      stakeAmount: 1n,
      rewarderTypes,
    });
    tx.setSender(row.ownerAddress);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    assertSimulateSuccess(sim, 1);
  }, 180_000);
});

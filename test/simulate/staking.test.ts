/**
 * E2E: staking deposit checker PTB (skipped when pool alias missing).
 */
import { Transaction } from "@mysten/sui/transactions";
import { stake } from "@waterx/perp-sdk";
import { beforeAll, describe, expect, it } from "vitest";

import { client, e2eNetwork } from "../helpers/e2e/e2e-client.ts";
import type { FundedProbe } from "../helpers/e2e/e2e-funded-probe.ts";
import { loadFundedProbe } from "../helpers/e2e/e2e-funded-probe.ts";

const stakingReady = Boolean(client.config.packages.waterx_staking?.pools?.WLP);

describe.skipIf(!stakingReady)(`staking (${e2eNetwork})`, () => {
  let probe: FundedProbe | null;

  beforeAll(async () => {
    probe = await loadFundedProbe(client);
  }, 180_000);

  it("stake() builds deposit + checker destroy plumbing", async (ctx) => {
    const p = probe;
    if (!p) {
      ctx.skip("No funded probe account");
      return;
    }
    const tx = new Transaction();
    tx.setGasBudget(250_000_000);
    stake(client, tx, {
      accountId: p.accountId,
      stakeAlias: "WLP",
      stakeType: client.wlpType(),
      stakeAmount: 1n,
      rewarderTypes: [],
    });
    tx.setSender(p.owner);
    const sim = await client.simulate(tx);
    expect(sim).toBeDefined();
  }, 180_000);
});

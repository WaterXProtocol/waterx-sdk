/**
 * E2E: WLP mint PTB with discovered wxa USDC balance (integration persistent-state seeds this).
 */
import { buildMintWlpTx } from "@waterx/perp-sdk";
import { beforeAll, describe, expect, it } from "vitest";

import { client, e2eNetwork } from "../helpers/e2e/e2e-client.ts";
import {
  loadWxaAccountForWlpMint,
  wxaDiscoverySkipReason,
  type DiscoveredWxaAccount,
} from "../helpers/e2e/e2e-wxa-discovery.ts";
import {
  simulateWithTransientRetry,
  skipHermesIfFeedUnavailable,
  skipSimulateIfOracleTransient,
} from "../helpers/e2e/simulate-assertions.ts";

describe(`wlp (${e2eNetwork})`, () => {
  let wxa: DiscoveredWxaAccount | null;

  beforeAll(async () => {
    wxa = await loadWxaAccountForWlpMint(client);
  }, 240_000);

  it("buildMintWlpTx composes refresh + mint (discovered wxa USDC)", async (ctx) => {
    const row = wxa;
    if (!row) {
      ctx.skip(wxaDiscoverySkipReason("usdc-mint"));
      return;
    }
    const depositTokenType = client.getPoolTokenType("USDCUSD");
    let tx;
    try {
      tx = await buildMintWlpTx(client, {
        accountId: row.accountId,
        depositAmount: 1_000_000n,
        minLpAmount: 1n,
        depositTicker: "USDCUSD",
        depositTokenType,
        skipOraclePriceRefresh: false,
      });
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      throw e;
    }
    tx.setSender(row.ownerAddress);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    expect(sim).toBeDefined();
  }, 240_000);
});

/**
 * E2E: WLP redeem request + cancel with discovered wxa / queue rows.
 */
import { Transaction } from "@mysten/sui/transactions";
import { describe, it } from "vitest";

import { cancelRedeemWlp, requestRedeemWlp } from "../../../src/user/wlp.ts";
import { client, e2eNetwork } from "../helpers/e2e/e2e-client.ts";
import { appendWlpPoolOracleRefresh } from "../helpers/e2e/e2e-wlp-oracle.ts";
import {
  discoverPendingRedeemRequest,
  loadWxaAccountWithWlp,
  wxaDiscoverySkipReason,
} from "../helpers/e2e/e2e-wxa-discovery.ts";
import {
  assertSimulateSuccessOrSkipOracleAndState,
  simulateWithTransientRetry,
  skipHermesIfFeedUnavailable,
} from "../helpers/e2e/simulate-assertions.ts";

describe(`wlp redeem/cancel (${e2eNetwork})`, () => {
  it("requestRedeemWlp simulates (discovered wxa WLP balance)", async (ctx) => {
    const wxa = await loadWxaAccountWithWlp(client, 1n);
    if (!wxa) {
      ctx.skip(wxaDiscoverySkipReason("wlp-balance"));
      return;
    }
    const usdc = client.getPoolTokenType("USDCUSD");
    const tx = new Transaction();
    tx.setGasBudget(400_000_000);
    try {
      await appendWlpPoolOracleRefresh(tx, client);
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      throw e;
    }
    requestRedeemWlp(client, tx, {
      accountId: wxa.accountId,
      redeemTokenType: usdc,
      lpAmount: 1n,
    });
    tx.setSender(wxa.ownerAddress);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    assertSimulateSuccessOrSkipOracleAndState(ctx, sim, 1, tx, {
      allowStateDependentSkip: true,
    });
  }, 180_000);

  it("cancelRedeemWlp simulates (discovered pending queue row)", async (ctx) => {
    const row = await discoverPendingRedeemRequest(client);
    if (!row) {
      ctx.skip(wxaDiscoverySkipReason("redeem-queue"));
      return;
    }
    const tx = new Transaction();
    cancelRedeemWlp(client, tx, { requestId: row.requestId });
    tx.setSender(row.ownerAddress);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    assertSimulateSuccessOrSkipOracleAndState(ctx, sim, 1, tx);
  }, 180_000);
});

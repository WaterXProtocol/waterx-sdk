/**
 * E2E simulate: cross-chain credit / bridge tx-builders + wxa account reads.
 */
import {
  buildExecuteWithdrawalTx,
  buildRedeemVaaTx,
  buildRequestCreditWithdrawTx,
  getAccountsByOwner,
  listBridgeWithdrawalVaas,
} from "@waterx/perp-sdk";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { client, DUMMY_SENDER, e2eNetwork } from "../helpers/e2e/e2e-client.ts";
import {
  creditPipelineSkipReason,
  custodyWxaSkipReason,
  e2eSimulateGasBudget,
  isCreditPipelineConfigured,
  resolveCustodyWxaRow,
  UNREGISTERED_CUSTODY_ASSET_TYPE,
} from "../helpers/e2e/e2e-custody.ts";
import {
  assertSimulateFailed,
  assertSimulateReached,
  assertSimulateSuccessOrSkipOracleAndState,
  simulateForTestOrSkip,
  simulateWithTransientRetry,
  skipSimulateIfOracleTransient,
} from "../helpers/e2e/simulate-assertions.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";

const creditPipeline = isCreditPipelineConfigured(client);
const EVM_ADDR = "0x1111111111111111111111111111111111111111";
const EVM_TOKEN = "0x2222222222222222222222222222222222222222";

describe.skipIf(!creditPipeline)(`credit bridge (${e2eNetwork})`, () => {
  const assetType = creditPipeline ? client.getNativeAssets()[0]?.type : undefined;

  it("buildRedeemVaaTx composes redeem + consume (invalid VAA may abort on simulate)", async () => {
    const tx = buildRedeemVaaTx(client, { vaaBytes: new Uint8Array([0xde, 0xad]) });
    tx.setSender(DUMMY_SENDER);
    tx.setGasBudget(e2eSimulateGasBudget());
    const sim = await client.simulate(tx);
    assertSimulateReached(sim);
  }, 90_000);

  it("buildRequestCreditWithdrawTx wormhole route PTB shape", async () => {
    const tx = buildRequestCreditWithdrawTx(client, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      amount: 1_000n,
      recipient: PTB_DUMMY_ACCOUNT_ID,
      route: {
        kind: "wormhole",
        evmDestinationChain: 10002,
        evmRecipient: EVM_ADDR,
        evmToken: EVM_TOKEN,
      },
      consolidateToUsd: false,
    });
    expect(tx.getData().commands?.length).toBe(4);
  });

  it("buildRequestCreditWithdrawTx native route PTB shape", async () => {
    if (!assetType) return;
    const tx = buildRequestCreditWithdrawTx(client, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      amount: 500n,
      recipient: PTB_DUMMY_ACCOUNT_ID,
      route: { kind: "native", assetType },
      consolidateToUsd: false,
    });
    expect(tx.getData().commands?.length).toBe(4);
  });

  it("buildExecuteWithdrawalTx wormhole and native keeper paths", () => {
    const wormhole = buildExecuteWithdrawalTx(client, {
      key: 1n,
      route: { kind: "wormhole" },
    });
    expect(wormhole.getData().commands?.length).toBeGreaterThanOrEqual(1);

    if (!assetType) return;
    const native = buildExecuteWithdrawalTx(client, {
      key: 2n,
      route: { kind: "native", assetType },
    });
    expect(native.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("listBridgeWithdrawalVaas uses mocked Wormholescan", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    const rows = await listBridgeWithdrawalVaas(client, { fetchImpl });
    expect(Array.isArray(rows)).toBe(true);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("getAccountsByOwner returns an array for dummy sender", async () => {
    const ids = await getAccountsByOwner(client, DUMMY_SENDER);
    expect(Array.isArray(ids)).toBe(true);
  }, 90_000);

  it("native withdraw zero amount fails simulate without wxa env", async (ctx) => {
    if (!assetType) return;
    const tx = buildRequestCreditWithdrawTx(client, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      amount: 0n,
      recipient: DUMMY_SENDER,
      route: { kind: "native", assetType },
      consolidateToUsd: false,
    });
    tx.setSender(DUMMY_SENDER);
    tx.setGasBudget(e2eSimulateGasBudget());
    const sim = await simulateForTestOrSkip(ctx, () => client.simulate(tx));
    if (sim === undefined) return;
    assertSimulateFailed(sim);
  }, 90_000);
});

describe.skipIf(!creditPipeline)(`credit bridge stateful (${e2eNetwork})`, () => {
  let wxa: { accountId: string; owner: string } | null;
  const assetType = client.getNativeAssets()[0]?.type;

  beforeAll(async () => {
    wxa = await resolveCustodyWxaRow(client);
  }, 180_000);

  it("simulates native withdraw enqueue when wxa has CREDIT balance", async (ctx) => {
    const row = wxa;
    if (!row) {
      ctx.skip(custodyWxaSkipReason());
      return;
    }
    if (!assetType) {
      ctx.skip(creditPipelineSkipReason());
      return;
    }
    if (!client.config.packages.withdrawal_queue?.queue) {
      ctx.skip("withdrawal_queue.queue not in config");
      return;
    }

    const creditType = client.creditType();
    const { getAccountBalance } = await import("@waterx/perp-sdk");
    const bal = await getAccountBalance(client, row.accountId, creditType);
    if (bal < 1n) {
      ctx.skip(`wxa CREDIT balance is zero — fund via integration mint first`);
      return;
    }

    const tx = buildRequestCreditWithdrawTx(client, {
      accountId: row.accountId,
      amount: 1n,
      recipient: row.owner,
      route: { kind: "native", assetType },
    });
    tx.setSender(row.owner);
    tx.setGasBudget(e2eSimulateGasBudget());

    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    assertSimulateSuccessOrSkipOracleAndState(ctx, sim, 1, tx);
  }, 240_000);

  it("simulates buildRedeemVaaTx with minimal VAA bytes", async (ctx) => {
    const row = wxa;
    if (!row) {
      ctx.skip(custodyWxaSkipReason());
      return;
    }
    const tx = buildRedeemVaaTx(client, { vaaBytes: [0x01] });
    tx.setSender(row.owner);
    tx.setGasBudget(e2eSimulateGasBudget());
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    assertSimulateReached(sim);
  }, 240_000);
});

describe.skipIf(!creditPipeline)(`credit bridge negative simulate (${e2eNetwork})`, () => {
  let wxa: { accountId: string; owner: string } | null;
  const assetType = client.getNativeAssets()[0]?.type;

  beforeAll(async () => {
    wxa = await resolveCustodyWxaRow(client);
  }, 180_000);

  it("native withdraw enqueue over wxa CREDIT balance fails simulate", async (ctx) => {
    const row = wxa;
    if (!row) {
      ctx.skip(custodyWxaSkipReason());
      return;
    }
    if (!assetType) {
      ctx.skip(creditPipelineSkipReason());
      return;
    }
    if (!client.config.packages.withdrawal_queue?.queue) {
      ctx.skip("withdrawal_queue.queue not in config");
      return;
    }

    const creditType = client.creditType();
    const { getAccountBalance } = await import("@waterx/perp-sdk");
    const bal = await getAccountBalance(client, row.accountId, creditType);
    if (bal === 0n) {
      ctx.skip("wxa CREDIT balance is zero — cannot probe over-withdraw");
      return;
    }

    const tx = buildRequestCreditWithdrawTx(client, {
      accountId: row.accountId,
      amount: bal + 1n,
      recipient: row.owner,
      route: { kind: "native", assetType },
    });
    tx.setSender(row.owner);
    tx.setGasBudget(e2eSimulateGasBudget());

    const sim = await simulateForTestOrSkip(ctx, () => client.simulate(tx));
    if (sim === undefined) return;
    assertSimulateFailed(sim);
  }, 240_000);

  it("native withdraw with zero amount fails simulate", async (ctx) => {
    const row = wxa;
    if (!row || !assetType) {
      ctx.skip(custodyWxaSkipReason());
      return;
    }
    if (!client.config.packages.withdrawal_queue?.queue) {
      ctx.skip("withdrawal_queue.queue not in config");
      return;
    }

    const tx = buildRequestCreditWithdrawTx(client, {
      accountId: row.accountId,
      amount: 0n,
      recipient: row.owner,
      route: { kind: "native", assetType },
    });
    tx.setSender(row.owner);
    tx.setGasBudget(e2eSimulateGasBudget());

    const sim = await simulateForTestOrSkip(ctx, () => client.simulate(tx));
    if (sim === undefined) return;
    assertSimulateFailed(sim);
  }, 240_000);

  it("native withdraw with unregistered assetType fails simulate", async (ctx) => {
    const row = wxa;
    if (!row) {
      ctx.skip(custodyWxaSkipReason());
      return;
    }
    if (!client.config.packages.withdrawal_queue?.queue) {
      ctx.skip("withdrawal_queue.queue not in config");
      return;
    }

    const creditType = client.creditType();
    const { getAccountBalance } = await import("@waterx/perp-sdk");
    const bal = await getAccountBalance(client, row.accountId, creditType);
    if (bal === 0n) {
      ctx.skip("wxa CREDIT balance is zero — cannot probe unregistered asset route");
      return;
    }

    const tx = buildRequestCreditWithdrawTx(client, {
      accountId: row.accountId,
      amount: 1n,
      recipient: row.owner,
      route: { kind: "native", assetType: UNREGISTERED_CUSTODY_ASSET_TYPE },
    });
    tx.setSender(row.owner);
    tx.setGasBudget(e2eSimulateGasBudget());

    const sim = await simulateForTestOrSkip(ctx, () => client.simulate(tx));
    if (sim === undefined) return;
    assertSimulateFailed(sim);
  }, 240_000);
});

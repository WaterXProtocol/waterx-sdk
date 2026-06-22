/**
 * Vitest wrappers for settlement claimable scan — imports `settlement-claimable-scan.ts`
 * (CLI-safe, no Vitest). Do not import this module from `tsx` scripts.
 */
import { Transaction } from "@mysten/sui/transactions";
import { getPosition } from "~predict/fetch.ts";
import { claim } from "~predict/prediction.ts";
import type { TestContext } from "vitest";
import { expect } from "vitest";

import { betsMeClaimablePath, resolveBetsWalletAddress } from "./api-bets-path.ts";
import { apiGet, assertSuccessEnvelope } from "./api-client.ts";
import { assertBetsClaimableList, type BetsMeListData, type BetWire } from "./api-contract.ts";
import type { ApiEnvironment } from "./api-env.ts";
import { skipIfBetsMissingAddress, skipIfPredictIndexerTablesMissing } from "./api-skip.ts";
import { optionalEnv } from "./e2e-env.ts";
import { skipIntegrationApiBets } from "./integration-api.ts";
import type { IntegrationCtx } from "./integration-setup.ts";
import {
  auditSettlementClaimable,
  betWirePositionId,
  fetchBetsClaimableDirect,
  settlementCrosscheckMaxRows,
} from "./settlement-claimable-scan.ts";
import { expectSimulateSuccessAsAccountOwner } from "./simulate.ts";

export {
  auditSettlementClaimable,
  expectedClaimUsdFromChain,
  formatSettlementScanReport,
  settlementBaseToUsd,
  settlementCrosscheckMaxRows,
  settlementCrosscheckPollIntervalMs,
  settlementCrosscheckPollMs,
  SETTLEMENT_SCALE,
} from "./settlement-claimable-scan.ts";
export type {
  AuditSettlementClaimableParams,
  ChainClaimableCandidate,
  ClaimableRowAudit,
  SettlementScanReport,
} from "./settlement-claimable-scan.ts";

export function hasSettlementCrosscheckEnabled(): boolean {
  const v = optionalEnv("E2E_SETTLEMENT_CROSSCHECK");
  return v === "1" || v === "true";
}

export function skipIntegrationSettlementCrosscheck(
  ctx: TestContext,
  env: ApiEnvironment | null,
  wallet?: string,
): asserts env is ApiEnvironment {
  if (!hasSettlementCrosscheckEnabled()) {
    ctx.skip(true, "E2E_SETTLEMENT_CROSSCHECK not set — skipping settlement claimable scan");
  }
  skipIntegrationApiBets(ctx, env, wallet);
}

export async function fetchBetsClaimable(
  ctx: TestContext,
  env: ApiEnvironment,
  wallet?: string,
): Promise<BetsMeListData> {
  const owner = resolveBetsWalletAddress(env, wallet);
  if (!owner) {
    ctx.skip(true, "No wallet for GET /predict/bets/me/claimable");
    throw new Error("unreachable");
  }
  const path = betsMeClaimablePath(owner);
  const { status, envelope } = await apiGet<BetsMeListData>(env, path);
  skipIfBetsMissingAddress(ctx, status, envelope);
  skipIfPredictIndexerTablesMissing(ctx, status, envelope);
  if (status !== 200) {
    throw new Error(`GET ${path} returned HTTP ${status}`);
  }
  assertSuccessEnvelope(envelope);
  assertBetsClaimableList(envelope.data);
  return envelope.data;
}

export function assertClaimableBetWireShape(bet: BetWire, label: string): void {
  expect(bet.outcome, `${label}.outcome`).toBe("pending");
  expect(bet.payoutUsd, `${label}.payoutUsd`).toBeNull();
  expect(bet.projectedPayoutUsd, `${label}.projectedPayoutUsd`).toBeDefined();
  const projected = bet.projectedPayoutUsd!;
  expect(typeof projected).toBe("number");
  expect(Number.isFinite(projected)).toBe(true);
  expect(
    projected,
    `${label}.projectedPayoutUsd > 0 (losers filtered server-side)`,
  ).toBeGreaterThan(0);
  expect(betWirePositionId(bet), `${label}.positionId`).toBeDefined();
}

export function assertProjectedPayoutMatchesChain(
  apiUsd: number,
  expectedUsd: number,
  label: string,
): void {
  expect(
    Math.abs(apiUsd - expectedUsd),
    `${label}: projectedPayoutUsd ${apiUsd} vs chain expected ${expectedUsd}`,
  ).toBeLessThan(0.000_001);
}

export interface SettlementCrosscheckResult {
  rowsChecked: number;
  apiSumUsd: number;
  chainSumUsd: number;
}

/** Vitest hard-assert wrapper over {@link auditSettlementClaimable}. */
export async function runSettlementClaimableCrosscheck(
  ctx: IntegrationCtx,
  env: ApiEnvironment,
  testCtx: TestContext,
): Promise<SettlementCrosscheckResult> {
  const wallet = resolveBetsWalletAddress(env, ctx.ownerAddress);
  if (!wallet) {
    testCtx.skip(true, "No wallet for settlement scan");
    throw new Error("unreachable");
  }

  const report = await auditSettlementClaimable({
    client: ctx.client,
    env,
    wallet,
    accountId: ctx.accountId,
    pollWhenChainAhead: true,
  });

  if (report.apiRowCount === 0 && report.chainCandidateCount === 0) {
    testCtx.skip(true, "no claimable positions for this wallet");
    throw new Error("unreachable");
  }

  if (report.rowsAudited === 0) {
    testCtx.skip(
      true,
      `API claimable empty but chain has ${report.chainCandidateCount} candidate(s) — indexer lag? re-run with poll or wait for MarketResolved`,
    );
    throw new Error("unreachable");
  }

  for (const [i, bet] of (await fetchBetsClaimableDirect(env, wallet)).bets
    .slice(0, settlementCrosscheckMaxRows())
    .entries()) {
    assertClaimableBetWireShape(bet, `bets[${i}]`);
  }

  for (const row of report.audits) {
    if (!row.ok) {
      throw new Error(row.detail ?? `claimable mismatch positionId=${row.positionId}`);
    }
    assertProjectedPayoutMatchesChain(row.apiProjectedUsd, row.chainExpectedUsd, row.positionId);
  }

  assertProjectedPayoutMatchesChain(
    report.apiSumUsd,
    report.chainSumUsd,
    "Claim All sum(projectedPayoutUsd)",
  );

  return {
    rowsChecked: report.rowsAudited,
    apiSumUsd: report.apiSumUsd,
    chainSumUsd: report.chainSumUsd,
  };
}

/** Optional — requires account owner key for simulate sender. */
export async function simulateClaimForClaimableRows(
  ctx: IntegrationCtx,
  env: ApiEnvironment,
  testCtx: TestContext,
  maxSimulations = 3,
): Promise<void> {
  const wallet = resolveBetsWalletAddress(env, ctx.ownerAddress);
  if (!wallet) {
    testCtx.skip(true, "No wallet for claim simulate");
    return;
  }

  const data = await fetchBetsClaimableDirect(env, wallet);
  if (data.bets.length === 0) {
    testCtx.skip(true, "no claimable rows for claim simulate");
    return;
  }

  const rows = data.bets.slice(0, maxSimulations);
  for (const bet of rows) {
    const positionId = betWirePositionId(bet);
    if (positionId === undefined) continue;
    const position = await getPosition(ctx.client, { positionId });
    if (position.accountId !== ctx.accountId) continue;

    const tx = new Transaction();
    claim(ctx.client, tx, { positionId });
    await expectSimulateSuccessAsAccountOwner(ctx.client, tx, ctx.accountId);
  }
}

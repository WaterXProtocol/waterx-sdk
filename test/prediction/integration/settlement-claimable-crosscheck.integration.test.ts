import type { PredictClient } from "~predict/client.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { resolveBetsWalletAddress, skipIfNoBetsWallet } from "../helpers/api-bets-path.ts";
import { isApiUnreachableError } from "../helpers/api-client.ts";
import { resolveApiEnvironment, type ApiEnvironment } from "../helpers/api-env.ts";
import { skipIfNoApiEnv } from "../helpers/api-skip.ts";
import { createE2eClient } from "../helpers/e2e-context.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { setupIntegration, type IntegrationCtx } from "../helpers/integration-setup.ts";
import {
  hasSettlementCrosscheckEnabled,
  runSettlementClaimableCrosscheck,
  simulateClaimForClaimableRows,
  skipIntegrationSettlementCrosscheck,
} from "../helpers/settlement-claimable-crosscheck.ts";
import { auditSettlementClaimable } from "../helpers/settlement-claimable-scan.ts";

/**
 * Read-only claimable scan — no place/fill. Only needs wallet + API + testnet RPC.
 *
 * ```bash
 * E2E_API_ADDRESS=0x… pnpm test:integration:predict:settlement-crosscheck
 * # or CLI report:
 * E2E_API_ADDRESS=0x… pnpm predict:scan-claimable
 * ```
 */
describe.skipIf(!hasSettlementCrosscheckEnabled())(
  "predict settlement claimable scan (read-only)",
  () => {
    let client: PredictClient;
    let apiEnv: ApiEnvironment | null;

    beforeAll(async () => {
      client = await createE2eClient();
      apiEnv = resolveApiEnvironment();
    }, 120_000);

    it("GET /predict/bets/me/claimable projectedPayoutUsd matches on-chain claim formula", async (testCtx) => {
      skipIntegrationSettlementCrosscheck(testCtx, apiEnv);
      const wallet = resolveBetsWalletAddress(apiEnv!);
      skipIfNoBetsWallet(testCtx, wallet);

      try {
        const report = await auditSettlementClaimable({
          client,
          env: apiEnv!,
          wallet,
          pollWhenChainAhead: true,
        });

        if (report.apiRowCount === 0 && report.chainCandidateCount === 0) {
          testCtx.skip(true, "no claimable positions for this wallet");
          return;
        }
        if (report.rowsAudited === 0) {
          testCtx.skip(
            true,
            `API empty but chain has ${report.chainCandidateCount} candidate(s) — indexer lag; retry with poll`,
          );
          return;
        }

        expect(report.ok, formatFailHint(report)).toBe(true);
        expect(report.rowsAudited).toBeGreaterThan(0);
      } catch (err) {
        if (isApiUnreachableError(err)) {
          testCtx.skip(true, `API unreachable at ${err.baseUrl}`);
          return;
        }
        throw err;
      }
    }, 360_000);
  },
);

function formatFailHint(report: Awaited<ReturnType<typeof auditSettlementClaimable>>): string {
  const bad = report.audits.filter((r) => !r.ok);
  if (bad.length === 0) return "Claim All sum mismatch";
  return bad.map((r) => r.detail ?? r.positionId).join("; ");
}

/** Optional PTB dry-run — needs `SUI_PRIVATE_KEY` matching the wallet owner. */
describe.skipIf(!hasWriteCredentials() || !hasSettlementCrosscheckEnabled())(
  "predict settlement claimable simulate (optional)",
  () => {
    let ctx: IntegrationCtx;
    let apiEnv: ApiEnvironment | null;

    beforeAll(async () => {
      ctx = await setupIntegration();
      apiEnv = resolveApiEnvironment();
    }, 180_000);

    it("claim_position PTB simulates for API claimable rows owned by account", async (testCtx) => {
      skipIfNoApiEnv(testCtx, apiEnv);
      skipIntegrationSettlementCrosscheck(testCtx, apiEnv, ctx.ownerAddress);
      try {
        await simulateClaimForClaimableRows(ctx, apiEnv!, testCtx);
      } catch (err) {
        if (isApiUnreachableError(err)) {
          testCtx.skip(true, `API unreachable at ${err.baseUrl}`);
          return;
        }
        throw err;
      }
    }, 360_000);

    it("integration ctx path matches auditSettlementClaimable", async (testCtx) => {
      skipIntegrationSettlementCrosscheck(testCtx, apiEnv, ctx.ownerAddress);
      try {
        const result = await runSettlementClaimableCrosscheck(ctx, apiEnv!, testCtx);
        expect(result.rowsChecked).toBeGreaterThan(0);
      } catch (err) {
        if (isApiUnreachableError(err)) {
          testCtx.skip(true, `API unreachable at ${err.baseUrl}`);
          return;
        }
        throw err;
      }
    }, 360_000);
  },
);

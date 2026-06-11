#!/usr/bin/env tsx
/**
 * Read-only scan: GET /predict/bets/me/claimable vs on-chain claim formula.
 * No place/fill — safe while backend broker routing is under test.
 *
 * Usage:
 *   E2E_API_ADDRESS=0x… pnpm predict:scan-claimable
 *   E2E_API_ENV=local pnpm predict:scan-claimable
 *   E2E_SETTLEMENT_CROSSCHECK_POLL_MS=120000 pnpm predict:scan-claimable --poll
 *
 * Requires: wallet (`E2E_API_ADDRESS` or JWT), API env, testnet RPC (read-only).
 */
import { loadRepoEnvFiles } from "../../../scripts/load-repo-env.ts";
import { resolveBetsWalletAddress } from "../helpers/api-bets-path.ts";
import { isApiUnreachableError } from "../helpers/api-client.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { createE2eClient } from "../helpers/e2e-context.ts";
import {
  auditSettlementClaimable,
  formatSettlementScanReport,
} from "../helpers/settlement-claimable-scan.ts";

loadRepoEnvFiles();

async function main(): Promise<void> {
  const poll = process.argv.includes("--poll");
  const env = resolveApiEnvironment();
  if (!env) {
    console.error(
      "No API env: set E2E_API_ENV=local|staging and base URL in test/prediction/api/environments/",
    );
    process.exit(1);
  }

  const wallet = resolveBetsWalletAddress(env);
  if (!wallet) {
    console.error("Set E2E_API_ADDRESS=0x… or E2E_API_JWT with suiAddress for claimable scan.");
    process.exit(1);
  }

  const client = await createE2eClient();

  try {
    const report = await auditSettlementClaimable({
      client,
      env,
      wallet,
      pollWhenChainAhead: poll || process.env.E2E_SETTLEMENT_CROSSCHECK_POLL === "1",
    });

    console.log(formatSettlementScanReport(report));

    if (report.rowsAudited === 0 && report.chainCandidateCount === 0) {
      process.exitCode = 0;
      return;
    }
    if (report.rowsAudited === 0 && report.chainCandidateCount > 0) {
      console.error(
        "\nChain has claimable candidates but API list is empty — try --poll or wait for indexer.",
      );
      process.exitCode = 2;
      return;
    }
    if (!report.ok) process.exitCode = 2;
  } catch (err) {
    if (isApiUnreachableError(err)) {
      console.error(`API unreachable at ${err.baseUrl}`);
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

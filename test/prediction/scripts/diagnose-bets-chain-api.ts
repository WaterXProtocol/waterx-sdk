#!/usr/bin/env tsx
/**
 * Print field-level audit: on-chain fixtures vs GET /predict/bets/me.
 *
 * Usage:
 *   pnpm diagnose:bets-api
 *   E2E_API_ENV=staging pnpm diagnose:bets-api
 *
 * Requires: testnet fixtures (seed), optional E2E_API_JWT for authed bets/me.
 */
import { loadRepoEnvFiles } from "../../../scripts/load-repo-env.ts";
import {
  auditBetsMeAgainstChain,
  auditIssueCount,
  formatBetsMeAuditReport,
} from "../helpers/api-chain-field-audit.ts";
import { apiGet, assertSuccessEnvelope } from "../helpers/api-client.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { jwtAuthSkipReason } from "../helpers/api-skip.ts";
import { isBetsMeListData, type BetsMeListData } from "../helpers/api-wire.ts";
import { createE2eClient, discoverFixtures } from "../helpers/e2e-context.ts";
import { optionalEnv } from "../helpers/e2e-env.ts";

loadRepoEnvFiles();

async function main(): Promise<void> {
  const env = resolveApiEnvironment();
  if (!env) {
    console.error(
      "No API env: set E2E_API_ENV=local|staging and base URL in test/prediction/api/environments/",
    );
    process.exit(1);
  }

  const jwt = optionalEnv("E2E_API_JWT");
  if (!jwt) {
    console.warn(
      "E2E_API_JWT not set — bets/me will 401; audit will still print chain-side rows.\n",
    );
  }

  const client = await createE2eClient();
  const fx = await discoverFixtures(client);

  let apiData: BetsMeListData = { bets: [] };
  if (jwt) {
    const { status, envelope } = await apiGet<BetsMeListData>(
      env,
      "/predict/bets/me?filter=all&limit=50",
    );
    if (status !== 200) {
      const authHint = jwtAuthSkipReason(status, envelope, { apiEnvName: env.name });
      console.error(`GET /predict/bets/me → HTTP ${status}`, envelope);
      if (authHint) console.error(`\n${authHint}\n`);
      process.exit(1);
    }
    assertSuccessEnvelope(envelope);
    if (!isBetsMeListData(envelope.data)) {
      console.error("GET /predict/bets/me data missing bets[]", envelope.data);
      process.exit(1);
    }
    apiData = envelope.data;
  }

  const report = await auditBetsMeAgainstChain(client, fx, apiData, {
    jwt,
    apiEnvName: env.name,
    apiBaseUrl: env.baseUrl,
  });

  console.log(formatBetsMeAuditReport(report));
  const issues = auditIssueCount(report);
  console.log(`\nIssue signals (mismatch / missing_api / empty list): ${issues}`);
  if (issues > 0) process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

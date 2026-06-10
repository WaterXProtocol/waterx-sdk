#!/usr/bin/env tsx
/**
 * Print field-level audit: on-chain fixtures vs GET /predict/bets/me.
 *
 * Usage:
 *   pnpm diagnose:bets-api              # default staging (api-waterx.up.railway.app)
 *   E2E_API_ENV=local pnpm diagnose:bets-api
 *
 * Requires: testnet fixtures (seed); wallet via E2E_API_ADDRESS or JWT suiAddress for bets/me.
 */
import { loadRepoEnvFiles } from "../../../scripts/load-repo-env.ts";
import { tryResolveAccountOwner } from "../helpers/account-owner.ts";
import { betsMeListPath, resolveBetsWalletAddress } from "../helpers/api-bets-path.ts";
import {
  auditBetsMeAgainstChain,
  auditIssueCount,
  formatBetsMeAuditReport,
} from "../helpers/api-chain-field-audit.ts";
import { apiGet, assertSuccessEnvelope } from "../helpers/api-client.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { isBetsMeListData, type BetsMeListData } from "../helpers/api-wire.ts";
import { createE2eClient, discoverFixtures } from "../helpers/e2e-context.ts";

loadRepoEnvFiles();

async function main(): Promise<void> {
  const env = resolveApiEnvironment();
  if (!env) {
    console.error(
      "No API env: set E2E_API_ENV=local|staging and base URL in test/prediction/api/environments/",
    );
    process.exit(1);
  }

  const client = await createE2eClient();
  const fx = await discoverFixtures(client);
  const wallet =
    resolveBetsWalletAddress(env) ?? (await tryResolveAccountOwner(client, fx.accountId));

  if (!wallet) {
    console.warn(
      "No wallet for bets/me — set E2E_API_ADDRESS or E2E_API_JWT; audit will print chain-side rows only.\n",
    );
  }

  let apiData: BetsMeListData = { bets: [] };
  if (wallet) {
    const { status, envelope } = await apiGet<BetsMeListData>(
      env,
      betsMeListPath(wallet, { filter: "all", limit: 50 }),
    );
    if (status !== 200) {
      console.error(`GET /predict/bets/me → HTTP ${status}`, envelope);
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
    queryWallet: wallet,
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

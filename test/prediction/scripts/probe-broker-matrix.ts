#!/usr/bin/env tsx
/**
 * Staging broker response matrix — vary place inputs, print API + chain outcomes.
 *
 *   pnpm predict:broker-matrix
 *   E2E_BROKER_MATRIX_SCENARIOS=fillable-normal,tight-701 pnpm predict:broker-matrix
 */
import { loadRepoEnvFiles } from "../../../scripts/load-repo-env.ts";
import { formatCatalogPlaceFailures } from "../helpers/api-catalog-pure.ts";
import type { CatalogPlaceFailure } from "../helpers/api-catalog-pure.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import {
  DEFAULT_BROKER_MATRIX,
  formatBrokerMatrixTable,
  runBrokerMatrix,
} from "../helpers/broker-matrix.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { setupIntegration } from "../helpers/integration-setup.ts";
import { readStagingBetUsd } from "../helpers/staging-amounts.ts";

loadRepoEnvFiles();

async function main(): Promise<void> {
  const apiEnv = resolveApiEnvironment();
  if (!apiEnv) {
    console.error("No API env — set E2E_API_ENV=staging");
    process.exit(1);
  }
  if (!hasWriteCredentials()) {
    console.error("SUI_PRIVATE_KEY not set");
    process.exit(1);
  }

  console.log("═".repeat(72));
  console.log("Broker response matrix (staging)");
  console.log("═".repeat(72));
  console.log("API:       ", apiEnv.name, apiEnv.baseUrl);
  console.log("Stake:     ", `$${readStagingBetUsd()} default (per-scenario overrides)`);
  console.log("Scenarios: ", DEFAULT_BROKER_MATRIX.length, "(filter: E2E_BROKER_MATRIX_SCENARIOS)");
  console.log();

  const ctx = await setupIntegration();
  const placeFailures: CatalogPlaceFailure[] = [];
  const rows = await runBrokerMatrix(ctx, apiEnv, { placeFailures });

  if (rows.length === 0) {
    console.error("No markets / scenarios ran.");
    if (placeFailures.length > 0) {
      console.error(formatCatalogPlaceFailures(placeFailures));
    }
    process.exit(1);
  }

  console.log(formatBrokerMatrixTable(rows));
  console.log();
  console.log("═".repeat(72));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

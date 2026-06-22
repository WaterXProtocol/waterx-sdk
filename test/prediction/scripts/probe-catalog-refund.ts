#!/usr/bin/env tsx
/**
 * Staging refund probe: place with unfillable priceCapBps, wait for cancel, verify wxa balance.
 *
 *   pnpm predict:refund-probe
 *   E2E_STAGING_BET_USD=1.03 pnpm predict:refund-probe
 */
import { loadRepoEnvFiles } from "../../../scripts/load-repo-env.ts";
import type { CatalogPlaceFailure } from "../helpers/api-catalog-pure.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import {
  formatCatalogPlaceFailures,
  logCatalogRefundProbe,
  runCatalogRefundProbe,
} from "../helpers/catalog-refund.ts";
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
  console.log("Catalog refund probe (unfillable priceCap → full wxa refund)");
  console.log("═".repeat(72));
  console.log("API:       ", apiEnv.name, apiEnv.baseUrl);
  console.log("Stake:     ", `$${readStagingBetUsd()} (maxSpend from E2E_STAGING_BET_USD)`);
  console.log();

  const ctx = await setupIntegration();
  console.log("Wallet:    ", ctx.ownerAddress);
  console.log("AccountId: ", ctx.accountId);
  console.log();

  const placeFailures: CatalogPlaceFailure[] = [];
  const outcome = await runCatalogRefundProbe(ctx, apiEnv, { placeFailures });
  if (!outcome) {
    console.error("No catalog market for refund probe.");
    if (placeFailures.length > 0) {
      console.error("Skips:", formatCatalogPlaceFailures(placeFailures));
    }
    process.exit(1);
  }

  console.log("OK — refund verified");
  logCatalogRefundProbe(outcome);
  console.log("═".repeat(72));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

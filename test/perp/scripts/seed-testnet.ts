/**
 * Seed perp testnet state for E2E simulate discovery (keeper-open per-ticker slots + wxa WLP +
 * pending redeem + optional CREDIT). Thin CLI wrapper around `runE2ePersistentPreflight` — the
 * same idempotent on-chain top-up the integration persistent-state test runs. Every stage re-uses
 * existing state when present, so re-running is safe.
 *
 * Signing is unavoidable: e2e tests are read-only `simulate`, but the state they simulate against
 * must first be created with real signed transactions. This script is the perp analogue of
 * `pnpm seed:testnet` (prediction).
 *
 * Requires a funded integration trader key on testnet:
 *   WATERX_INTEGRATION_PRIVATE_KEY=suiprivkey1...   (or .integration-trader.keystore)
 *
 * Usage:
 *   pnpm seed:testnet:perp
 *
 * Env toggles (forwarded to the preflight):
 *   WATERX_E2E_PREFLIGHT_REDEEM=0   skip the pending-redeem enqueue
 *   WATERX_E2E_PREFLIGHT_CREDIT=0   skip the CREDIT top-up
 */
import { loadRepoEnvFiles } from "../../../scripts/load-repo-env.ts";
import { runE2ePersistentPreflight } from "../helpers/e2e/e2e-persistent-preflight.ts";
import {
  createIntegrationWaterXClient,
  resolveIntegrationNetwork,
} from "../helpers/e2e/integration-client.ts";
import { isIntegrationTraderConfigured } from "../helpers/integration/integration-trader-key.ts";

loadRepoEnvFiles();

async function main(): Promise<void> {
  if (!isIntegrationTraderConfigured()) {
    throw new Error(
      "No integration trader key. Set WATERX_INTEGRATION_PRIVATE_KEY (suiprivkey1... from " +
        "`sui keytool export`) or add a .integration-trader.keystore, then re-run.",
    );
  }

  const network = resolveIntegrationNetwork();
  if (network !== "testnet") {
    throw new Error(
      `Refusing to seed on "${network}". This script targets testnet only — ` +
        "unset WATERX_INTEGRATION_NETWORK / E2E_NETWORK or set it to testnet.",
    );
  }

  console.log("[seed:perp] network", network);
  const client = await createIntegrationWaterXClient();

  const report = await runE2ePersistentPreflight(client);

  console.log("\n# Perp seed report:");
  console.log(JSON.stringify(report, null, 2));
  console.log(
    `\n[seed:perp] done — wxa accountId=${report.accountId}. ` +
      "If this is not the canonical e2e account, export " +
      `WATERX_E2E_WXA_ACCOUNT_ID=${report.accountId} for the e2e run.`,
  );
  if (report.warnings.length > 0) {
    console.log(`[seed:perp] ${report.warnings.length} warning(s):`);
    for (const w of report.warnings) console.log(`  - ${w}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

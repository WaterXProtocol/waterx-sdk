#!/usr/bin/env tsx
/**
 * Standalone testnet preflight (keeper slots + wxa WLP + optional CREDIT).
 * Not invoked by `pnpm test:e2e` (CI-safe). Run locally before e2e when you have an integration key.
 *
 *   pnpm test:e2e:preflight
 */
import process from "node:process";

import { WaterXClient } from "../src/client.ts";
import { resolveE2eNetwork, wrapGrpcClientForE2eRetry } from "../test/helpers/e2e/e2e-client.ts";
import { runE2ePersistentPreflight } from "../test/helpers/e2e/e2e-persistent-preflight.ts";
import { isIntegrationTraderConfigured } from "../test/helpers/integration/integration-trader-key.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";

loadRepoEnvFiles();

const network = resolveE2eNetwork();
if (network !== "testnet") {
  console.log(`[e2e preflight] skipped — preflight runs on testnet only (got ${network})`);
  process.exit(0);
}

if (!isIntegrationTraderConfigured()) {
  console.log(
    "[e2e preflight] skipped — set WATERX_INTEGRATION_PRIVATE_KEY or .integration-trader.keystore",
  );
  process.exit(0);
}

const grpcUrl = process.env.WATERX_E2E_GRPC_URL?.trim();
const client = await WaterXClient.create("TESTNET", {
  cache: true,
  ...(grpcUrl ? { grpcUrl } : {}),
});
client.grpcClient = wrapGrpcClientForE2eRetry(client.grpcClient);

const report = await runE2ePersistentPreflight(client);
if (report.warnings.length) {
  console.warn("[e2e preflight] warnings:", report.warnings.join("; "));
}
console.log(
  "[e2e preflight] done",
  JSON.stringify(report, (_, v) => (typeof v === "bigint" ? `${v}n` : v)),
);

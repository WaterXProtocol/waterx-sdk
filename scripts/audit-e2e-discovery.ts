#!/usr/bin/env tsx
/**
 * Local discovery diagnostics: scans lifecycle tickers with `DISCOVERY_OPTS_STATEFUL_SIMULATE`
 * and prints whether an eligible sponsored position probe exists (`eligible` vs `none`).
 *
 * Usage:
 *   pnpm audit:e2e-discovery --testnet
 *   pnpm exec tsx scripts/audit-e2e-discovery.ts --mainnet
 */
import process from "node:process";

import { WaterXClient } from "../src/client.ts";
import type { Network } from "../src/constants.ts";
import {
  discoverActivePosition,
  DISCOVERY_OPTS_STATEFUL_SIMULATE,
} from "../test/helpers/e2e/discover-on-chain-position.ts";
import {
  resolveE2eGrpcUrlOverride,
  wrapGrpcClientForE2eRetry,
} from "../test/helpers/e2e/e2e-client.ts";
import { activeLifecycleTickersForClient } from "../test/helpers/e2e/lifecycle-test-markets.ts";

function parseNetwork(argv: string[]): Network {
  if (argv.includes("--mainnet")) return "MAINNET";
  return "TESTNET";
}

async function main() {
  const argv = process.argv.slice(2);
  const network = parseNetwork(argv);
  const grpcUrl = resolveE2eGrpcUrlOverride();
  const client = await WaterXClient.create(network, {
    cache: true,
    ...(grpcUrl ? { grpcUrl } : {}),
  });
  client.grpcClient = wrapGrpcClientForE2eRetry(client.grpcClient);

  const tickers = activeLifecycleTickersForClient(client);
  console.log(`network=${network} tickers=${tickers.join(",") || "(none)"}`);
  for (const t of tickers) {
    try {
      const hit = await discoverActivePosition(client, t, DISCOVERY_OPTS_STATEFUL_SIMULATE);
      console.log(`${t}\t${hit ? "eligible" : "none"}`);
    } catch (e) {
      console.log(`${t}\terror\t${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

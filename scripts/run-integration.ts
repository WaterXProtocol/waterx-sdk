#!/usr/bin/env tsx
/**
 * Wrapper around `vitest run --project integration-trader` with `--testnet` / `--mainnet`.
 * Sets both `WATERX_E2E_NETWORK` and `WATERX_INTEGRATION_NETWORK` so shared helpers resolve consistently.
 *
 * Forward all other argv to Vitest (paths, `-t`, etc.).
 *
 * Examples:
 *   pnpm test:integration --testnet
 *   pnpm test:integration --mainnet test/integration/user/trader-open-smoke.test.ts
 */
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

import { loadRepoEnvFiles } from "./load-repo-env.ts";

loadRepoEnvFiles();

type Network = "testnet" | "mainnet";

function parseArgs(argv: string[]): { network: Network; forward: string[] } {
  const forward: string[] = [];
  let cliNetwork: Network | undefined;
  for (const arg of argv) {
    if (arg === "--testnet") {
      cliNetwork = "testnet";
    } else if (arg === "--mainnet") {
      cliNetwork = "mainnet";
    } else if (arg !== "--") {
      forward.push(arg);
    }
  }
  const envRaw = process.env.WATERX_INTEGRATION_NETWORK?.trim().toLowerCase();
  const envSecondary = process.env.WATERX_E2E_NETWORK?.trim().toLowerCase();
  const envNetwork: Network | undefined =
    envRaw === "testnet" || envRaw === "mainnet"
      ? envRaw
      : envSecondary === "testnet" || envSecondary === "mainnet"
        ? envSecondary
        : undefined;
  const network: Network = cliNetwork ?? envNetwork ?? "testnet";
  return { network, forward };
}

const { network, forward } = parseArgs(process.argv.slice(2));

const vitestBin = path.resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vitest.cmd" : "vitest",
);

const child = spawn(vitestBin, ["run", "--project", "integration-trader", ...forward], {
  stdio: "inherit",
  env: {
    ...process.env,
    WATERX_E2E_NETWORK: network,
    WATERX_INTEGRATION_NETWORK: network,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

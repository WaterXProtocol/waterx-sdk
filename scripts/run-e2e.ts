#!/usr/bin/env tsx
/**
 * Wrapper around `vitest run --project e2e` with `--testnet` / `--mainnet`.
 * Sets `WATERX_E2E_NETWORK` and strips network flags before forwarding to Vitest.
 *
 * Forward all other argv to Vitest (paths, `-t`, `--coverage`, reporters, etc.).
 *
 * Examples:
 *   pnpm exec tsx scripts/run-e2e.ts --testnet
 *   pnpm exec tsx scripts/run-e2e.ts --mainnet --coverage
 *   pnpm exec tsx scripts/run-e2e.ts --testnet test/perp/e2e/read-views.test.ts
 *   pnpm exec tsx scripts/run-e2e.ts --testnet --predict
 */
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

import { loadRepoEnvFiles } from "./load-repo-env.ts";

loadRepoEnvFiles();

type Network = "testnet" | "mainnet";

function parseArgs(argv: string[]): { network: Network; predict: boolean; forward: string[] } {
  const forward: string[] = [];
  let cliNetwork: Network | undefined;
  let predict = false;
  for (const arg of argv) {
    if (arg === "--testnet") {
      cliNetwork = "testnet";
    } else if (arg === "--mainnet") {
      cliNetwork = "mainnet";
    } else if (arg === "--predict") {
      predict = true;
    } else if (arg !== "--") {
      forward.push(arg);
    }
  }
  const envRaw = process.env.WATERX_E2E_NETWORK?.trim().toLowerCase();
  const envNetwork: Network | undefined =
    envRaw === "testnet" || envRaw === "mainnet" ? envRaw : undefined;
  const network: Network = cliNetwork ?? envNetwork ?? "testnet";
  return { network, predict, forward };
}

const { network, predict, forward } = parseArgs(process.argv.slice(2));

const vitestBin = path.resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vitest.cmd" : "vitest",
);

const projects = predict ? ["e2e", "predict-e2e"] : ["e2e"];
const vitestArgs = ["run", ...projects.flatMap((name) => ["--project", name]), ...forward];

const child = spawn(vitestBin, vitestArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    WATERX_E2E_NETWORK: network,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

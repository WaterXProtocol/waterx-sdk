#!/usr/bin/env tsx
/**
 * Wrapper around `vitest run --project e2e` that accepts network flags
 * (`--testnet` / `--mainnet`) and forwards every other argument to vitest.
 *
 * Network resolution precedence:
 *   1. `--testnet` or `--mainnet` CLI flag
 *   2. `WATERX_E2E_NETWORK` env var
 *   3. **testnet** (default — mainnet config is not fully deployed)
 *
 * Examples:
 *   pnpm test:e2e                                 # testnet (default)
 *   pnpm test:e2e --mainnet                       # mainnet (sparse config until deployed)
 *   pnpm test:e2e --testnet -t "config views"    # testnet + test-name filter
 *   pnpm test:e2e --testnet test/simulate/fetch-errors.test.ts
 *   pnpm test:e2e --coverage                      # forwarded to vitest
 *   WATERX_E2E_MAX_FORKS=3 pnpm test:e2e        # parallel test **files** (2–8; may 429 on public gRPC)
 *   (`--shard i/n` is forwarded too; GitHub CI uses that in `.github/workflows/ci.yml`, not package.json scripts.)
 */
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

type Network = "testnet" | "mainnet";

function parseArgs(argv: string[]): { network: Network; forward: string[] } {
  const forward: string[] = [];
  let cliNetwork: Network | undefined;
  for (const arg of argv) {
    if (arg === "--testnet") {
      cliNetwork = "testnet";
    } else if (arg === "--mainnet") {
      cliNetwork = "mainnet";
    } else {
      forward.push(arg);
    }
  }
  const envRaw = process.env.WATERX_E2E_NETWORK?.trim().toLowerCase();
  const envNetwork: Network | undefined =
    envRaw === "testnet" || envRaw === "mainnet" ? envRaw : undefined;
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

const child = spawn(vitestBin, ["run", "--project", "e2e", ...forward], {
  stdio: "inherit",
  env: { ...process.env, WATERX_E2E_NETWORK: network },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

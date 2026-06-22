#!/usr/bin/env tsx
import { loadPackageEnv } from "../load-env.ts";
import { applyStressProfile, loadStressConfigFile } from "../stress-config.ts";

loadPackageEnv();
const cfg = loadStressConfigFile();
if (cfg.walletsFile && !process.env.E2E_STRESS_WALLETS_FILE) {
  process.env.E2E_STRESS_WALLETS_FILE = cfg.walletsFile;
}

await import("./bootstrap-accounts-core.ts");

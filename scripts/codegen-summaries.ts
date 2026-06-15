import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const CONTRACTS_ROOT = resolve(REPO_ROOT, "waterx-contract");

// `path` overrides the default `<root>/<name>` resolution for packages whose
// source dir name differs from the Move package name (e.g. the credit/bridge
// packages live under `waterx_credit/sui/<subdir>` but are named differently).
const PACKAGES: Array<{ name: string; root: string; path?: string }> = [
  { name: "waterx_perp", root: CONTRACTS_ROOT },
  { name: "waterx_perp_view", root: CONTRACTS_ROOT },
  { name: "waterx_account", root: CONTRACTS_ROOT },
  { name: "waterx_oracle", root: CONTRACTS_ROOT },
  { name: "waterx_staking", root: CONTRACTS_ROOT },
  { name: "pyth_rule", root: CONTRACTS_ROOT, path: "waterx_oracle_rule/pyth_rule" },
  {
    name: "pyth_sponsor_rule",
    root: CONTRACTS_ROOT,
    path: "waterx_oracle_rule/pyth_sponsor_rule",
  },
  {
    name: "constant_rule",
    root: CONTRACTS_ROOT,
    path: "waterx_oracle_rule/constant_rule",
  },
  { name: "bucket_framework", root: CONTRACTS_ROOT },
  { name: "wlp", root: CONTRACTS_ROOT, path: "coins/wlp" },
  { name: "waterx_referral", root: CONTRACTS_ROOT },
  // Cross-chain credit / bridge stack (waterx_credit/sui/*).
  { name: "waterx_credit", root: CONTRACTS_ROOT, path: "waterx_credit/sui/credit" },
  { name: "native_custody", root: CONTRACTS_ROOT, path: "waterx_credit/sui/native_custody" },
  { name: "wormhole_bridge", root: CONTRACTS_ROOT, path: "waterx_credit/sui/wormhole_bridge" },
  { name: "withdrawal_queue", root: CONTRACTS_ROOT, path: "waterx_credit/sui/withdrawal_queue" },
];

for (const pkg of PACKAGES) {
  const cwd = resolve(pkg.root, pkg.path ?? pkg.name);
  if (!existsSync(cwd)) {
    console.error(`Skipping ${pkg.name}: not found at ${cwd}`);
    continue;
  }
  console.log(`-> sui move summary (${pkg.name})`);
  const result = spawnSync("sui", ["move", "summary"], { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`sui move summary failed for ${pkg.name} (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

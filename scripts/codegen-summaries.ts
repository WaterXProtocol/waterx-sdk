import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const CONTRACTS_ROOT = resolve(REPO_ROOT, "waterx-contract");
const V2_CONTRACTS_ROOT = resolve(REPO_ROOT, "v2-move-contracts");

const PACKAGES: Array<{ name: string; root: string }> = [
  { name: "waterx_perp", root: CONTRACTS_ROOT },
  { name: "waterx_perp_view", root: CONTRACTS_ROOT },
  { name: "waterx_account", root: CONTRACTS_ROOT },
  { name: "waterx_oracle", root: CONTRACTS_ROOT },
  { name: "waterx_staking", root: CONTRACTS_ROOT },
  { name: "pyth_rule", root: CONTRACTS_ROOT },
  { name: "pyth_sponsor_rule", root: CONTRACTS_ROOT },
  { name: "bucket_framework", root: CONTRACTS_ROOT },
  { name: "wlp", root: CONTRACTS_ROOT },
  { name: "bucket_referral", root: V2_CONTRACTS_ROOT },
];

for (const pkg of PACKAGES) {
  const cwd = resolve(pkg.root, pkg.name);
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

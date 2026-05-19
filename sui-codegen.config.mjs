import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contracts = resolve(__dirname, "../waterx-contract");
const v2Contracts = resolve(__dirname, "../v2-move-contracts");

const config = {
  output: "./src/generated",
  generateSummaries: false,
  prune: true,
  importExtension: ".ts",
  packages: [
    {
      package: "@waterx/perp",
      path: resolve(contracts, "waterx_perp"),
      generate: {
        types: true,
        functions: {
          private: true,
        },
      },
    },
    {
      package: "@waterx/perp-view",
      path: resolve(contracts, "waterx_perp_view"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@waterx/account",
      path: resolve(contracts, "waterx_account"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@waterx/oracle",
      path: resolve(contracts, "waterx_oracle"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@waterx/staking",
      path: resolve(contracts, "waterx_staking"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@waterx/pyth-rule",
      path: resolve(contracts, "waterx_oracle_rule/pyth_rule"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@waterx/pyth-sponsor-rule",
      path: resolve(contracts, "waterx_oracle_rule/pyth_sponsor_rule"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@bucket/framework",
      path: resolve(contracts, "bucket_framework"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@bucket/referral",
      path: resolve(v2Contracts, "bucket_referral"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@waterx/wlp",
      path: resolve(contracts, "coins/wlp"),
      generate: {
        types: true,
        functions: true,
      },
    },
    // Cross-chain credit / bridge stack. Source dirs are nested under
    // waterx_credit/sui/* and differ from the Move package names.
    {
      package: "@waterx/credit",
      path: resolve(contracts, "waterx_credit/sui/credit"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@waterx/native-custody",
      path: resolve(contracts, "waterx_credit/sui/native_custody"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@waterx/wormhole-bridge",
      path: resolve(contracts, "waterx_credit/sui/wormhole_bridge"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@waterx/withdrawal-queue",
      path: resolve(contracts, "waterx_credit/sui/withdrawal_queue"),
      generate: {
        types: true,
        functions: true,
      },
    },
  ],
};

// Drop packages whose source isn't checked out locally (e.g. bucket_referral,
// which is absent from this workspace). `codegen-summaries.ts` skips them too,
// so `sui-ts-codegen` would otherwise crash on a missing package_summaries dir.
// Pruned entries keep any previously-generated output (codegen prune only
// skips dependency-module emit; it never deletes existing dirs).
config.packages = config.packages.filter((p) => {
  const hasSummaries = existsSync(join(p.path, "package_summaries"));
  if (!hasSummaries) {
    console.warn(`sui-codegen: skipping ${p.package} — no package_summaries at ${p.path}`);
  }
  return hasSummaries;
});

export default config;

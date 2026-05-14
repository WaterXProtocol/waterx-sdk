import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contracts = resolve(__dirname, "../waterx-contract");
const v2Contracts = resolve(__dirname, "../v2-move-contracts");

export default {
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
      path: resolve(contracts, "pyth_rule"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@waterx/pyth-sponsor-rule",
      path: resolve(contracts, "pyth_sponsor_rule"),
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
      path: resolve(contracts, "wlp"),
      generate: {
        types: true,
        functions: true,
      },
    },
  ],
};

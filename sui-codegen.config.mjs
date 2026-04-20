import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  output: "./src/generated",
  generateSummaries: false,
  prune: true,
  importExtension: ".ts",
  packages: [
    {
      package: "@waterx/perp",
      path: resolve(__dirname, "waterx-contracts/waterx_perp"),
      generate: {
        types: true,
        functions: {
          private: true,
        },
      },
    },
    {
      package: "@bucket/framework",
      path: resolve(__dirname, "waterx-contracts/bucket_framework"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@bucket/oracle",
      path: resolve(__dirname, "waterx-contracts/bucket_oracle"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@waterx/reward-distributor",
      path: resolve(__dirname, "waterx-contracts/reward_distributor"),
      generate: {
        types: true,
        functions: true,
      },
    },
    {
      package: "@waterx/pyth-sponsor-rule",
      path: resolve(__dirname, "waterx-contracts/pyth_sponsor_rule"),
      generate: {
        types: true,
        functions: true,
      },
    },
  ],
};

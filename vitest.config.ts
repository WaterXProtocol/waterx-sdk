import path from "path";
import { defineConfig } from "vitest/config";

/** `@waterx/perp-sdk` must resolve per Vitest project (multi-project mode). */
const perpSdkAlias = {
  "@waterx/perp-sdk": path.resolve(__dirname, "./src/index.ts"),
};

const coverageBlock = {
  provider: "v8" as const,
  reportsDirectory: "./coverage",
  reporter: ["text", "json-summary", "html"],
  include: ["src/**/*.ts"],
  exclude: [
    "src/**/*.test.ts",
    "src/generated/**",
    "**/generated/**",
    "dist/**",
    /** Pure TypeScript interfaces — no executable statements after emit. */
    "src/view-types.ts",
  ],
};

export default defineConfig({
  resolve: { alias: perpSdkAlias },
  test: {
    coverage: coverageBlock,
    /**
     * Vitest 3.2: the default reporter colors durations using the *root* Vitest `config`, not each
     * inline `projects[]` entry — nested `slowTestThreshold` was ignored (everything stayed at 300ms).
     * Set it here so typical testnet simulate/RPC times are not yellow. Integration cases over 15s may
     * still highlight; raise this value if that is too noisy for integration runs.
     */
    slowTestThreshold: 15_000,
    projects: [
      {
        resolve: { alias: perpSdkAlias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "test/unit/**/*.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
      {
        resolve: { alias: perpSdkAlias },
        test: {
          name: "e2e",
          include: ["test/simulate/**/*.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          testTimeout: 120_000,
          hookTimeout: 30_000,
          /** Inherits root `slowTestThreshold` (15s). Public testnet gRPC rate-limits; parallel files → RpcError "Too Many Requests". */
          poolOptions: { forks: { singleFork: true } },
          sequence: { concurrent: false },
        },
      },
      {
        resolve: { alias: perpSdkAlias },
        test: {
          name: "integration-trader",
          include: ["test/integration/user/**/*.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          testTimeout: 300_000,
          hookTimeout: 120_000,
          /**
           * Unlike e2e simulate, integration spends most wall time in on-chain cooldown sleeps.
           * Allow default multi-fork scheduling so read-heavy work / separate files can overlap.
           * `execTx` in `test/integration/setup.ts` serializes all `signAndExecute` for one shared
           * wallet so parallel workers do not nonce-race.
           */
        },
      },
    ],
  },
});

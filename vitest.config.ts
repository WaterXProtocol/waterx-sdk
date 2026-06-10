import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Aliases must resolve per Vitest project (multi-project mode):
 * - `@waterx/perp-sdk` → perp barrel (legacy/internal).
 * - `~predict/*` / `~predict-scripts/*` → prediction sources/scripts (used by the
 *   merged prediction test suite). Regex form keeps `~predict-scripts` from being
 *   swallowed by the `~predict` prefix.
 */
const aliases = [
  { find: "@waterx/perp-sdk", replacement: path.resolve(__dirname, "./src/index.ts") },
  {
    find: /^~predict-scripts\//,
    replacement: path.resolve(__dirname, "./test/prediction/scripts") + "/",
  },
  { find: /^~predict-tests\//, replacement: path.resolve(__dirname, "./test/prediction") + "/" },
  { find: /^~predict\//, replacement: path.resolve(__dirname, "./src/prediction") + "/" },
];

/**
 * E2E simulate hits shared gRPC; default is **one worker** (serial files) to avoid
 * `RpcError: Too Many Requests` on public endpoints.
 *
 * Opt in to parallel **test files** with `WATERX_E2E_MAX_FORKS=2` … `8` (e.g. paid RPC / CI with backoff).
 * Still does not run individual `it()` concurrently (`sequence.concurrent: false`).
 *
 * Vitest 4 collapsed `poolOptions.forks` into top-level `maxWorkers` / `isolate`.
 * `singleFork: true` is now `maxWorkers: 1, isolate: false`; the multi-worker case
 * just sets `maxWorkers: n` (isolation defaults to true).
 */
function e2eParallelism(): { maxWorkers: number; isolate?: boolean } {
  const raw = process.env.WATERX_E2E_MAX_FORKS?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 2 && n <= 8) {
      return { maxWorkers: n };
    }
  }
  return { maxWorkers: 1, isolate: false };
}

/**
 * Integration shares one on-chain signer; `execTx` only serializes within a **single** Node worker.
 * Multiple workers ⇒ parallel `signAndExecute` from the same address ⇒ nonce races and rapid SUI
 * gas drain (`Unable to perform gas selection… insufficient SUI`). Default one worker; opt into
 * `WATERX_INTEGRATION_MAX_FORKS=2`…`8` only with a well-funded key and paid RPC.
 */
function integrationTraderParallelism(): { maxWorkers: number; isolate?: boolean } {
  const raw = process.env.WATERX_INTEGRATION_MAX_FORKS?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 2 && n <= 8) {
      return { maxWorkers: n };
    }
  }
  return { maxWorkers: 1, isolate: false };
}

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
  resolve: { alias: aliases },
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
        resolve: { alias: aliases },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "test/perp/unit/**/*.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: "e2e",
          include: ["test/perp/e2e/**/*.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          testTimeout: 120_000,
          hookTimeout: 30_000,
          setupFiles: [
            "./test/perp/helpers/load-repo-env-setup.ts",
            "./test/perp/helpers/e2e/e2e-setup.ts",
          ],
          /** Parallelism: see `e2eParallelism` / env `WATERX_E2E_MAX_FORKS`. */
          ...e2eParallelism(),
          sequence: { concurrent: false },
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: "integration-trader",
          include: ["test/perp/integration/**/*.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          testTimeout: 300_000,
          hookTimeout: 120_000,
          setupFiles: [
            "./test/perp/helpers/load-repo-env-setup.ts",
            "./test/perp/integration/vitest-integration-setup.ts",
          ],
          /** One worker by default — see `integrationTraderParallelism`. */
          ...integrationTraderParallelism(),
          sequence: { concurrent: false },
        },
      },
      // ======== Prediction line ========
      {
        resolve: { alias: aliases },
        test: {
          name: "predict-unit",
          include: ["test/prediction/unit/**/*.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: "predict-e2e",
          include: ["test/prediction/e2e/**/*.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          setupFiles: ["./test/prediction/setup-e2e.ts"],
          testTimeout: 120_000,
          hookTimeout: 30_000,
          // All e2e files share an in-process discovery cache; one worker avoids
          // parallel testnet RPC bursts (429). See prediction-sdk's vitest config.
          // Vitest 4: `pool: "forks"` + `poolOptions.forks.singleFork: true`
          // → `maxWorkers: 1, isolate: false`.
          maxWorkers: 1,
          isolate: false,
          sequence: { concurrent: false },
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: "predict-integration",
          include: ["test/prediction/integration/**/*.test.ts"],
          exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "test/prediction/integration/**/*.keeper.test.ts",
            "test/prediction/integration/admin.test.ts",
            "test/prediction/integration/claim.test.ts",
            "test/prediction/integration/api-crosscheck.test.ts",
            "test/prediction/integration/headless-catalog-bet.integration.test.ts",
            "test/prediction/integration/catalog-refund.integration.test.ts",
            "test/prediction/integration/broker-matrix.integration.test.ts",
          ],
          environment: "node",
          setupFiles: ["./test/prediction/setup-integration.ts"],
          testTimeout: 180_000,
          hookTimeout: 180_000,
          maxWorkers: 1,
          isolate: false,
          sequence: { concurrent: false },
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: "predict-integration-headless",
          include: ["test/prediction/integration/headless-catalog-bet.integration.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          setupFiles: ["./test/prediction/setup-integration.ts"],
          testTimeout: 360_000,
          hookTimeout: 180_000,
          maxWorkers: 1,
          isolate: false,
          sequence: { concurrent: false },
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: "predict-integration-broker-matrix",
          include: ["test/prediction/integration/broker-matrix.integration.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          setupFiles: ["./test/prediction/setup-integration.ts"],
          testTimeout: 600_000,
          hookTimeout: 180_000,
          maxWorkers: 1,
          isolate: false,
          sequence: { concurrent: false },
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: "predict-integration-refund",
          include: ["test/prediction/integration/catalog-refund.integration.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          setupFiles: ["./test/prediction/setup-integration.ts"],
          testTimeout: 360_000,
          hookTimeout: 180_000,
          maxWorkers: 1,
          isolate: false,
          sequence: { concurrent: false },
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: "predict-integration-crosscheck",
          include: ["test/prediction/integration/api-crosscheck.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          setupFiles: ["./test/prediction/setup-integration.ts"],
          testTimeout: 360_000,
          hookTimeout: 180_000,
          maxWorkers: 1,
          isolate: false,
          sequence: { concurrent: false },
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: "predict-integration-keeper",
          include: [
            "test/prediction/integration/**/*.keeper.test.ts",
            "test/prediction/integration/claim.test.ts",
          ],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          setupFiles: ["./test/prediction/setup-integration.ts"],
          testTimeout: 360_000,
          hookTimeout: 180_000,
          maxWorkers: 1,
          isolate: false,
          sequence: { concurrent: false },
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: "predict-integration-admin",
          include: ["test/prediction/integration/admin.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          setupFiles: ["./test/prediction/setup-integration.ts"],
          testTimeout: 240_000,
          hookTimeout: 180_000,
          maxWorkers: 1,
          isolate: false,
          sequence: { concurrent: false },
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: "predict-api",
          include: ["test/prediction/api/**/*.api.test.ts"],
          environment: "node",
          exclude: [
            "**/node_modules/**",
            "**/dist/**",
            ...(process.env.E2E_API_REPORT ? [] : ["test/prediction/api/report.api.test.ts"]),
            ...(process.env.E2E_PREDICT_EVENT_SLUG
              ? []
              : ["test/prediction/api/events.api.test.ts"]),
          ],
          setupFiles: ["./test/prediction/setup-api.ts"],
          testTimeout: 120_000,
          hookTimeout: 30_000,
          maxWorkers: 1,
          isolate: false,
          sequence: { concurrent: false },
        },
      },
    ],
  },
});

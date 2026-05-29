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
 * E2E simulate hits shared gRPC; default is **one fork** (serial files) to avoid
 * `RpcError: Too Many Requests` on public endpoints.
 *
 * Opt in to parallel **test files** with `WATERX_E2E_MAX_FORKS=2` … `8` (e.g. paid RPC / CI with backoff).
 * Still does not run individual `it()` concurrently (`sequence.concurrent: false`).
 */
function e2ePoolOptions():
  | { forks: { singleFork: true } }
  | { forks: { singleFork: false; minForks: number; maxForks: number } } {
  const raw = process.env.WATERX_E2E_MAX_FORKS?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 2 && n <= 8) {
      return { forks: { singleFork: false, minForks: 1, maxForks: n } };
    }
  }
  return { forks: { singleFork: true } };
}

/**
 * Integration shares one on-chain signer; `execTx` only serializes within a **single** Node worker.
 * Multiple forks ⇒ parallel `signAndExecute` from the same address ⇒ nonce races and rapid SUI
 * gas drain (`Unable to perform gas selection… insufficient SUI`). Default one fork; opt into
 * `WATERX_INTEGRATION_MAX_FORKS=2`…`8` only with a well-funded key and paid RPC.
 */
function integrationTraderPoolOptions():
  | { forks: { singleFork: true } }
  | { forks: { singleFork: false; minForks: number; maxForks: number } } {
  const raw = process.env.WATERX_INTEGRATION_MAX_FORKS?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n >= 2 && n <= 8) {
      return { forks: { singleFork: false, minForks: 1, maxForks: n } };
    }
  }
  return { forks: { singleFork: true } };
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
          /** Parallelism: see `e2ePoolOptions` / env `WATERX_E2E_MAX_FORKS`. */
          poolOptions: e2ePoolOptions(),
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
          /** One fork by default — see `integrationTraderPoolOptions`. */
          poolOptions: integrationTraderPoolOptions(),
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
          // All e2e files share an in-process discovery cache; one fork avoids
          // parallel testnet RPC bursts (429). See prediction-sdk's vitest config.
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          sequence: { concurrent: false },
        },
      },
      {
        resolve: { alias: aliases },
        test: {
          name: "predict-integration",
          include: ["test/prediction/integration/**/*.test.ts"],
          environment: "node",
          exclude: ["**/node_modules/**", "**/dist/**"],
          setupFiles: ["./test/prediction/setup-integration.ts"],
          testTimeout: 180_000,
          hookTimeout: 180_000,
          // Integration signs+executes against testnet with one gas coin — single fork.
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          sequence: { concurrent: false },
        },
      },
    ],
  },
});

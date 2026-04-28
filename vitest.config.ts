import path from "path";
import { defineConfig } from "vitest/config";

/** `@waterx/perp-sdk` must resolve per Vitest project (multi-project mode). */
const perpSdkAlias = {
  "@waterx/perp-sdk": path.resolve(__dirname, "./src/index.ts"),
};

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
          setupFiles: ["./test/helpers/e2e/e2e-setup.ts"],
          /** Parallelism: see `e2ePoolOptions` / env `WATERX_E2E_MAX_FORKS`. */
          poolOptions: e2ePoolOptions(),
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
          setupFiles: ["./test/integration/vitest-integration-setup.ts"],
          /** One fork by default — see `integrationTraderPoolOptions`. */
          poolOptions: integrationTraderPoolOptions(),
          sequence: { concurrent: false },
        },
      },
    ],
  },
});

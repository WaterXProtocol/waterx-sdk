import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Standalone entry for predict HTTP API smoke tests.
 * Prefer: `pnpm test:api:local` (uses root vitest `predict-api` project).
 */
const repoRoot = path.resolve(__dirname, "../..");
const aliases = [
  { find: "@waterx/perp-sdk", replacement: path.resolve(repoRoot, "./src/index.ts") },
  {
    find: /^~predict-scripts\//,
    replacement: path.resolve(repoRoot, "./test/prediction/scripts") + "/",
  },
  { find: /^~predict-tests\//, replacement: path.resolve(repoRoot, "./test/prediction") + "/" },
  { find: /^~predict\//, replacement: path.resolve(repoRoot, "./src/prediction") + "/" },
];

export default defineConfig({
  root: repoRoot,
  resolve: { alias: aliases },
  test: {
    name: "predict-api",
    include: ["test/prediction/api/**/*.api.test.ts"],
    setupFiles: [path.resolve(__dirname, "./setup-api.ts")],
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 120_000,
    hookTimeout: 30_000,
    maxWorkers: 1,
    isolate: false,
    sequence: { concurrent: false },
  },
});

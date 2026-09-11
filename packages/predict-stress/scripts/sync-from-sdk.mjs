#!/usr/bin/env node
/**
 * Copy stress harness helpers from waterx-sdk test/prediction into this package.
 * Run from packages/predict-stress: pnpm sync
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, "..");
const SDK_ROOT = join(PKG_ROOT, "../..");

const HELPER_FILES = [
  "account-balance.ts",
  "account-funding.ts",
  "account-owner.ts",
  "api-catalog-pure.ts",
  "api-client.ts",
  "api-endpoints.ts",
  "api-env.ts",
  "catalog-cli.ts",
  "catalog-fill-policy.ts",
  // NOT `e2e-discovery.ts`: the stress harness ships a slim `e2e-context.ts`
  // with no fixture walk (see below), and the discovery helper pulls in a chain
  // of helpers this package does not vendor.
  "e2e-env.ts",
  "env.ts",
  "events-core.ts",
  "events.ts",
  "fill-economics-core.ts",
  "integration-setup.ts",
  "query-prediction-events.ts",
  "simulate.ts",
  "staging-amounts.ts",
  "stress-wallets.ts",
  "tx-result.ts",
];

const OTHER_FILES = [
  // The env-boundary URL rule is shared with the SDK harnesses; vendor it so
  // this package applies the SAME base-vs-legacy-file semantics rather than a
  // drifting copy. Imports of it are rewritten to the vendored path below.
  ["scripts/waterx-config-url.ts", "src/helpers/waterx-config-url.ts"],
  ["test/prediction/contract/event-fields.ts", "src/contract/event-fields.ts"],
  ["test/prediction/fixtures/ptb-params.ts", "src/fixtures/ptb-params.ts"],
  ["test/prediction/scripts/place-stress-multi-wallet.ts", "src/scripts/place-stress-core.ts"],
  [
    "test/prediction/scripts/bootstrap-stress-accounts.ts",
    "src/scripts/bootstrap-accounts-core.ts",
  ],
  [
    "test/prediction/scripts/bootstrap-stress-deposits.ts",
    "src/scripts/bootstrap-deposits-core.ts",
  ],
];

function rewriteSdkImports(content) {
  return (
    content
      .replace(/from "~predict\/([^"]+)\.ts"/g, 'from "@waterx/sdk/prediction/$1"')
      .replace(/from '\~predict\/([^']+)\.ts'/g, "from '@waterx/sdk/prediction/$1'")
      // Codegen lives at `src/generated/`, exported as `@waterx/sdk/generated/*`.
      // There is no `prediction/generated` subpath — the prediction line imports
      // from the single shared root.
      .replace(/from "(?:\.\.\/)+src\/generated\/([^"]+)\.ts"/g, 'from "@waterx/sdk/generated/$1"')
      .replace(/from '(?:\.\.\/)+src\/generated\/([^']+)\.ts'/g, "from '@waterx/sdk/generated/$1'")
      // `DEFAULT_GRPC_URLS` lives on `src/base-client.ts` upstream and is
      // re-exported on the prediction export map for exactly this reason.
      .replace(/from "(?:\.\.\/)+src\/base-client\.ts"/g, 'from "@waterx/sdk/prediction"')
      .replace(/from '(?:\.\.\/)+src\/base-client\.ts'/g, "from '@waterx/sdk/prediction'")
      // The env-boundary URL rule is vendored next to the helpers (OTHER_FILES).
      .replace(/from "(?:\.\.\/)+scripts\/waterx-config-url\.ts"/g, 'from "./waterx-config-url.ts"')
      .replace(/from '(?:\.\.\/)+scripts\/waterx-config-url\.ts'/g, "from './waterx-config-url.ts'")
  );
}

/**
 * `packages/predict-stress` is standalone — it consumes the SDK through the
 * `@waterx/sdk` export map, never through relative paths into `src/`. A helper
 * that picks up such an import upstream would otherwise be copied verbatim and
 * silently reach outside the package. Fail the sync instead of shipping it.
 */
function assertNoSdkSourceEscape(label, content) {
  // `scripts/` counts too: it is just as far outside this package as `src/`,
  // and an unrewritten import of it would be copied verbatim and fail only at
  // RUNTIME — which is how `waterx-config-url.ts` slipped through once.
  const escapes = content.match(/from ["'](?:\.\.\/)+(?:src|scripts)\/[^"']+["']/g);
  if (escapes) {
    throw new Error(
      `${label}: import(s) escape the standalone package: ${escapes.join(", ")}\n` +
        `Add a rewrite rule in rewriteSdkImports() mapping them onto the @waterx/sdk export map.`,
    );
  }
}

function rewritePaths(content) {
  return (
    content
      // Matches the bare string literal, not the enclosing `resolve(...)` call: upstream
      // wraps it in an `optionalEnv("E2E_STRESS_WALLETS_FILE") ?? ...` fallback that
      // prettier may reflow across lines. Requiring the quotes keeps
      // `stress-wallets.example.json` and prose mentions in docstrings untouched.
      .replace(/"test\/prediction\/fixtures\/stress-wallets\.json"/g, '"config/wallets.json"')
      .replace(
        /resolve\(process\.cwd\(\), "test\/prediction\/api\/environments"\)/g,
        'resolve(process.cwd(), "config/environments")',
      )
      .replace(
        /resolve\(process\.cwd\(\), "test\/prediction\/fixtures\/testnet-seeded\.json"\)/g,
        'resolve(process.cwd(), "config/testnet-seeded.json")',
      )
  );
}

function copyHelper(name) {
  const src = join(SDK_ROOT, "test/prediction/helpers", name);
  const dest = join(PKG_ROOT, "src/helpers", name);
  if (!existsSync(src)) {
    console.warn(`skip missing helper: ${name}`);
    return;
  }
  let content = readFileSync(src, "utf8");
  content = rewriteSdkImports(content);
  content = rewritePaths(content);
  assertNoSdkSourceEscape(`helpers/${name}`, content);
  writeFileSync(dest, content);
  console.log(`helpers/${name}`);
}

function copyOther([relSrc, relDest]) {
  const src = join(SDK_ROOT, relSrc);
  const dest = join(PKG_ROOT, relDest);
  if (!existsSync(src)) {
    console.warn(`skip missing: ${relSrc}`);
    return;
  }
  let content = readFileSync(src, "utf8");
  content = rewriteSdkImports(content);
  content = rewritePaths(content);
  content = content.replace(
    /import \{ loadRepoEnvFiles \} from "\.\.\/\.\.\/\.\.\/scripts\/load-repo-env\.ts";/,
    'import { loadPackageEnv } from "../load-env.ts";',
  );
  content = content.replace(/loadRepoEnvFiles\(\)/g, "loadPackageEnv()");
  content = content.replace(/from "\.\.\/helpers\//g, 'from "../helpers/');
  content = content.replace(/from "\.\.\/contract\//g, 'from "../contract/');
  content = content.replace(/from "\.\.\/fixtures\//g, 'from "../fixtures/');
  assertNoSdkSourceEscape(relDest, content);
  writeFileSync(dest, content);
  console.log(relDest);
}

mkdirSync(join(PKG_ROOT, "src/helpers"), { recursive: true });
mkdirSync(join(PKG_ROOT, "src/contract"), { recursive: true });
mkdirSync(join(PKG_ROOT, "src/fixtures"), { recursive: true });
mkdirSync(join(PKG_ROOT, "src/scripts"), { recursive: true });
mkdirSync(join(PKG_ROOT, "config/environments"), { recursive: true });

console.log("Syncing helpers…");
for (const f of HELPER_FILES) copyHelper(f);

console.log("Syncing scripts + extras…");
for (const pair of OTHER_FILES) copyOther(pair);

const stagingSrc = join(SDK_ROOT, "test/prediction/api/environments/staging.json");
if (existsSync(stagingSrc)) {
  cpSync(stagingSrc, join(PKG_ROOT, "config/environments/staging.json"));
  console.log("config/environments/staging.json");
}

const exampleWallets = join(SDK_ROOT, "test/prediction/fixtures/stress-wallets.example.json");
if (existsSync(exampleWallets)) {
  cpSync(exampleWallets, join(PKG_ROOT, "config/wallets.example.json"));
  console.log("config/wallets.example.json");
}

// Slim client — stress harness does not need e2e-discovery / fixture walk.
writeFileSync(
  join(PKG_ROOT, "src/helpers/e2e-context.ts"),
  `/**
 * Minimal testnet client factory for stress harness (no fixture discovery).
 */
import { PredictClient } from "@waterx/sdk/prediction/client";

import { readE2eClientOverrides } from "./e2e-env.ts";

/** Testnet client. \`loadConfig\` has no default and never reads env, so the
 *  \`waterxConfigUrl\` opt comes from \`E2E_CONFIG_URL\` / \`WATERX_CONFIG_URL\`
 *  via \`readE2eClientOverrides()\`; other \`E2E_*\` overrides are optional. */
export function createE2eClient(): Promise<PredictClient> {
  return PredictClient.testnet({ ...readE2eClientOverrides(), cache: true });
}
`,
);

console.log("helpers/e2e-context.ts (slim)");

// Rewriting import specifiers reorders them under the repo's import-sort rules,
// so the raw copies land unformatted and `pnpm lint` fails on generated files.
// Format in place with the root prettier so a fresh sync leaves a clean tree.
const fmt = spawnSync(
  "npx",
  ["--no-install", "prettier", "--write", "--log-level", "warn", "packages/predict-stress/src"],
  { cwd: SDK_ROOT, stdio: "inherit" },
);
if (fmt.status !== 0) {
  throw new Error(`prettier failed on the synced tree (exit ${fmt.status ?? "signal"})`);
}
console.log("prettier --write src");
console.log("Done.");

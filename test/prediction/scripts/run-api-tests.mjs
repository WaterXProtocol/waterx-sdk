#!/usr/bin/env node
/**
 * Run predict HTTP API smoke tests (opt-in, local manual).
 *
 * Usage (from repo root):
 *   node test/prediction/scripts/run-api-tests.mjs --env local
 *   node test/prediction/scripts/run-api-tests.mjs --env staging
 *   node test/prediction/scripts/run-api-tests.mjs --env staging --report
 *   node test/prediction/scripts/run-api-tests.mjs --env staging --report=feed,browse
 *   node test/prediction/scripts/run-api-tests.mjs --env staging --report-only
 *   node test/prediction/scripts/run-api-tests.mjs --env staging --report-only=bets
 */
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  let envName = process.env.E2E_API_ENV ?? "local";
  let report = null;
  let reportOnly = false;
  const vitestExtra = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--env" && argv[i + 1]) {
      envName = argv[++i];
      continue;
    }
    if (arg === "--report" || arg === "--report=all") {
      report = "all";
      continue;
    }
    if (arg.startsWith("--report=")) {
      report = arg.slice("--report=".length) || "all";
      continue;
    }
    if (arg === "--report-only") {
      reportOnly = true;
      report = report ?? "all";
      continue;
    }
    if (arg.startsWith("--report-only=")) {
      reportOnly = true;
      report = arg.slice("--report-only=".length) || "all";
      continue;
    }
    vitestExtra.push(arg);
  }

  return { envName, report, reportOnly, vitestExtra };
}

const { envName, report, reportOnly, vitestExtra } = parseArgs(process.argv.slice(2));

const env = {
  ...process.env,
  E2E_API_ENV: envName,
};
if (report) {
  env.E2E_API_REPORT = report;
}

const vitestArgs = ["exec", "vitest", "run", "--project", "predict-api", "--reporter=verbose"];

if (reportOnly) {
  vitestArgs.push("test/prediction/api/report.api.test.ts");
} else if (vitestExtra.length > 0) {
  vitestArgs.push(...vitestExtra);
}

const result = spawnSync("pnpm", vitestArgs, {
  stdio: "inherit",
  env,
  shell: false,
});

process.exit(result.status ?? 1);

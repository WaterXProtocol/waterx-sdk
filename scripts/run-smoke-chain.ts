#!/usr/bin/env tsx
/**
 * Smoke-chain orchestrator. Runs the smoke scripts in dependency order so
 * each step finds the state the previous one produced. Fail-fast.
 *
 *   pnpm smoke:chain               # full chain, EXECUTE=1 each step
 *   pnpm smoke:chain --dry-run     # simulate-only mode for every step
 *   pnpm smoke:chain --include-claim
 *
 * Steps (in order):
 *   0. smoke-remote           — config repo reachability
 *   1. smoke                  — PTB builder simulate sanity (no on-chain writes)
 *   2. create-wxa-account     — emits WATERX_SMOKE_ACCOUNT_ID for downstream
 *   3. mint-usd-from-mock-usdc — MOCK_USDC → USD CREDIT in wxa
 *   4. deposit-to-wlp         — USD → WLP in wxa
 *   5. smoke-staking          — stake → unstake 1 WLP
 *   6. smoke-happy-path       — deposit + mint WLP + place + cancel
 *   7. smoke-keeper-match     — market buy + keeper match + direct close
 *   8. smoke-custody          — mint/burn CREDIT round-trip
 *
 * If WATERX_SMOKE_ACCOUNT_ID is already set in the env, step 2 is skipped
 * (the existing account is reused). This lets you re-run the chain without
 * creating a new account every time.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

import { loadRepoEnvFiles } from "./load-repo-env.ts";

loadRepoEnvFiles();

type StepArgs = {
  /** If true, this step is the source of WATERX_SMOKE_ACCOUNT_ID for the rest of the chain. */
  capturesAccountId?: boolean;
  /** Extra env to merge into this step (e.g., WATERX_CUSTODY_EXECUTE=1). */
  env?: Record<string, string>;
};

interface Step {
  name: string;
  script: string;
  args?: StepArgs;
}

interface CliFlags {
  dryRun: boolean;
  includeClaim: boolean;
}

function parseFlags(argv: string[]): CliFlags {
  return {
    dryRun: argv.includes("--dry-run"),
    includeClaim: argv.includes("--include-claim"),
  };
}

function buildChain(flags: CliFlags): Step[] {
  const chain: Step[] = [
    { name: "smoke-remote", script: "scripts/smoke-remote.ts" },
    { name: "smoke", script: "scripts/smoke.ts" },
    {
      name: "create-wxa-account",
      script: "scripts/create-wxa-account.ts",
      args: { capturesAccountId: true },
    },
    { name: "mint-usd-from-mock-usdc", script: "scripts/mint-usd-from-mock-usdc.ts" },
    { name: "deposit-to-wlp", script: "scripts/deposit-to-wlp.ts" },
    { name: "smoke-staking", script: "scripts/smoke-staking.ts" },
  ];
  if (flags.includeClaim) {
    chain.push({ name: "smoke-staking-claim", script: "scripts/smoke-staking-claim.ts" });
  }
  chain.push(
    { name: "smoke-happy-path", script: "scripts/smoke-happy-path.ts" },
    { name: "smoke-keeper-match", script: "scripts/smoke-keeper-match.ts" },
    {
      name: "smoke-custody",
      script: "scripts/smoke-custody.ts",
      args: { env: { WATERX_CUSTODY_EXECUTE: "1" } },
    },
  );
  return chain;
}

interface StepResult {
  step: Step;
  exitCode: number;
  durationMs: number;
  capturedAccountId?: string;
}

async function runStep(step: Step, env: NodeJS.ProcessEnv): Promise<StepResult> {
  const scriptAbs = path.resolve(process.cwd(), step.script);
  const tsxBin = path.resolve(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx",
  );
  const startedAt = Date.now();
  console.log(`\n========== [${step.name}] running ${step.script} ==========`);

  return new Promise<StepResult>((resolveStep) => {
    const child = spawn(tsxBin, [scriptAbs], {
      env: { ...env, ...(step.args?.env ?? {}) },
      stdio: ["inherit", "pipe", "inherit"],
    });
    let captured: string | undefined;
    const accountIdRe = /WATERX_SMOKE_ACCOUNT_ID=(0x[0-9a-fA-F]+)/;
    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (step.args?.capturesAccountId && !captured) {
        const m = accountIdRe.exec(text);
        if (m) captured = m[1];
      }
    });
    child.on("error", (e) => {
      console.error("[%s] spawn error:", step.name, e);
      resolveStep({ step, exitCode: 1, durationMs: Date.now() - startedAt });
    });
    child.on("exit", (code) => {
      resolveStep({
        step,
        exitCode: code ?? 1,
        durationMs: Date.now() - startedAt,
        capturedAccountId: captured,
      });
    });
  });
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const chain = buildChain(flags);

  const chainEnv: NodeJS.ProcessEnv = { ...process.env };
  if (flags.dryRun) {
    delete chainEnv.EXECUTE;
    delete chainEnv.WATERX_CUSTODY_EXECUTE;
  } else {
    chainEnv.EXECUTE = "1";
  }

  const reusing = Boolean(chainEnv.WATERX_SMOKE_ACCOUNT_ID?.trim());
  if (reusing) {
    console.log(
      `[smoke-chain] reusing WATERX_SMOKE_ACCOUNT_ID=${chainEnv.WATERX_SMOKE_ACCOUNT_ID} ` +
        `— create-wxa-account step will still run (idempotent) but its capture is ignored.`,
    );
  }

  console.log(
    `[smoke-chain] mode=${flags.dryRun ? "DRY-RUN" : "EXECUTE"} steps=${chain.length} ` +
      `include-claim=${flags.includeClaim}`,
  );

  const results: StepResult[] = [];
  for (const step of chain) {
    const result = await runStep(step, chainEnv);
    results.push(result);

    if (result.exitCode !== 0) {
      console.error(
        `\n[smoke-chain] step "${step.name}" exited with code ${result.exitCode} ` +
          `after ${result.durationMs}ms — stopping chain.`,
      );
      summarize(results);
      process.exit(result.exitCode);
    }
    if (step.args?.capturesAccountId && result.capturedAccountId && !reusing) {
      chainEnv.WATERX_SMOKE_ACCOUNT_ID = result.capturedAccountId;
      console.log(
        `[smoke-chain] captured WATERX_SMOKE_ACCOUNT_ID=${result.capturedAccountId} ` +
          `from ${step.name}; injecting into downstream steps.`,
      );
    }
  }

  summarize(results);
  console.log("\n[smoke-chain] all steps green.");
}

function summarize(results: StepResult[]): void {
  console.log("\n========== smoke-chain summary ==========");
  for (const r of results) {
    const tag = r.exitCode === 0 ? "OK  " : "FAIL";
    console.log(`  [${tag}] ${r.step.name.padEnd(28)} ${r.durationMs}ms`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

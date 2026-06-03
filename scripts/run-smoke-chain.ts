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
 *   3. mint-usd-from-collateral — USDC + USDSUI → USD CREDIT in wxa (every vault asset)
 *   4. smoke-credit-withdraw  — requestCreditWithdraw + enqueue (native route)
 *   5. deposit-to-wlp         — USD → WLP in wxa
 *   6. smoke-staking          — stake → unstake 1 WLP
 *   7. mint-and-stake-wlp     — atomic mint WLP + stake in one PTB
 *   8. smoke-happy-path       — deposit + mint WLP + place + cancel
 *   9. smoke-keeper-match     — market buy + keeper match + direct close
 *  10. smoke-custody          — mint/burn CREDIT round-trip
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
    {
      name: "mint-usd-from-collateral",
      script: "scripts/mint-usd-from-collateral.ts",
      // Mint 25 USD per vault asset (USDC + USDSUI) = 50 USD CREDIT, enough to
      // fund every downstream draw on a fresh account: credit-withdraw (1) +
      // deposit-to-wlp (1) + mint-and-stake-wlp (1) + happy-path (~35) +
      // keeper-match (~5), with margin.
      args: { env: { MINT_AMOUNT: "25000000" } },
    },
    { name: "smoke-credit-withdraw", script: "scripts/smoke-credit-withdraw.ts" },
    { name: "deposit-to-wlp", script: "scripts/deposit-to-wlp.ts" },
    {
      name: "smoke-staking",
      script: "scripts/smoke-staking.ts",
      // 1 USD deposit-to-wlp yields slightly <1 WLP (mint discount), so stake
      // a sub-1 WLP amount that fits a fresh account's balance.
      args: { env: { WATERX_STAKE_AMOUNT: "500000" } },
    },
  ];
  if (flags.includeClaim) {
    chain.push({ name: "smoke-staking-claim", script: "scripts/smoke-staking-claim.ts" });
  }
  chain.push(
    {
      name: "mint-and-stake-wlp",
      script: "scripts/mint-and-stake-wlp.ts",
      // 1 USD atomic mint+stake — fits the CREDIT minted above (script default is 30 USD).
      args: { env: { DEPOSIT_AMOUNT: "1000000", MIN_LP_AMOUNT: "0" } },
    },
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
  skipped?: boolean;
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
        `— account-creating steps are skipped.`,
    );
  }

  console.log(
    `[smoke-chain] mode=${flags.dryRun ? "DRY-RUN" : "EXECUTE"} steps=${chain.length} ` +
      `include-claim=${flags.includeClaim}`,
  );

  const results: StepResult[] = [];
  for (const step of chain) {
    // When an account id is already provided, the account-creating step is a
    // no-op (its captured id is ignored) — skip it instead of broadcasting a
    // redundant create.
    if (reusing && step.args?.capturesAccountId) {
      console.log(`\n========== [${step.name}] skipped (reusing existing account) ==========`);
      results.push({ step, exitCode: 0, durationMs: 0, skipped: true });
      continue;
    }

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
    const tag = r.skipped ? "SKIP" : r.exitCode === 0 ? "OK  " : "FAIL";
    console.log(`  [${tag}] ${r.step.name.padEnd(28)} ${r.durationMs}ms`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

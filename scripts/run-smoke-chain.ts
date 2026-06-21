#!/usr/bin/env tsx
/**
 * Smoke-chain orchestrator. Runs the smoke scripts in dependency order so
 * each step finds the state the previous one produced. Fail-fast.
 *
 *   pnpm smoke:chain               # full chain, EXECUTE=1 each step
 *   pnpm smoke:chain --dry-run     # zero-write: simulate-only, execute-only steps skipped
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
 *   8. smoke-happy-path       — deposit + mint WLP + place + cancel  [execute-only]
 *   9. smoke-keeper-match     — market buy + keeper match + direct close  [execute-only]
 *  10. smoke-custody          — mint/burn CREDIT round-trip
 *
 * If WATERX_SMOKE_ACCOUNT_ID is already set in the env, the account-creating
 * step is skipped (the existing account is reused). This lets you re-run the
 * chain without creating a new account every time.
 *
 * `--dry-run` is guaranteed zero-write: every step gates its broadcast on
 * EXECUTE (deleted in dry mode), `executeEnv` flags are stripped, and
 * `executeOnly` steps (happy-path, keeper-match — no simulate path) are
 * skipped. Steps still need a signer + network to simulate against testnet.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";

import { loadRepoEnvFiles } from "./load-repo-env.ts";

loadRepoEnvFiles();

/**
 * Default wxa account for the smoke chain — owned by the testnet smoke signer
 * (`DEFAULT_SMOKE_SIGNER` below) and funded with standing USD CREDIT + WLP.
 * Used when `WATERX_SMOKE_ACCOUNT_ID` is unset so a dry chain (and CI) reads
 * live balances and passes out of the box, without a per-machine `.env.local`.
 * The signer must own this account — override the env var (or this constant)
 * when running under a different signer.
 */
const DEFAULT_SMOKE_ACCOUNT_ID =
  "0x1afcce49e1687d71532a4d29ac31db0fca339723cf6b483aa98c1983e96dfac9";

/**
 * Default signer ADDRESS (public, no key) that owns `DEFAULT_SMOKE_ACCOUNT_ID`.
 * A dry run is simulate-only — it never signs — so it only needs the sender
 * address, not the keystore. Injected as `SUI_ACTIVE_ADDRESS` only when neither
 * the env var nor a local `~/.sui/sui_config/client.yaml` is present (i.e. in
 * CI), so local dev keeps using its own active address. EXECUTE mode still
 * needs the matching key in the keystore.
 */
const DEFAULT_SMOKE_SIGNER = "0x623846ad4264c9844263a5978f113c054e9fd6a38d395f390d98cc3c353b1f9a";

const CLIENT_YAML = path.resolve(homedir(), ".sui/sui_config/client.yaml");

type StepArgs = {
  /** If true, this step is the source of WATERX_SMOKE_ACCOUNT_ID for the rest of the chain. */
  capturesAccountId?: boolean;
  /** Extra env to merge into this step, always (e.g. amount tuning). */
  env?: Record<string, string>;
  /**
   * Env applied only in EXECUTE mode, stripped under `--dry-run`. Use for
   * per-step "actually broadcast" flags (e.g. WATERX_CUSTODY_EXECUTE) so a dry
   * run never writes on chain.
   */
  executeEnv?: Record<string, string>;
  /**
   * Step has no simulate-only mode (it broadcasts unconditionally and later
   * PTBs depend on earlier executes' on-chain results). Skipped under
   * `--dry-run` so a dry chain stays zero-write.
   */
  executeOnly?: boolean;
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
    {
      name: "smoke-happy-path",
      script: "scripts/smoke-happy-path.ts",
      args: { executeOnly: true },
    },
    {
      name: "smoke-keeper-match",
      script: "scripts/smoke-keeper-match.ts",
      args: { executeOnly: true },
    },
    {
      name: "smoke-custody",
      script: "scripts/smoke-custody.ts",
      // Only broadcast custody writes in EXECUTE mode; dry runs stay simulate-only.
      args: { executeEnv: { WATERX_CUSTODY_EXECUTE: "1" } },
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
  attempts?: number;
}

/**
 * Transient infra failures that are NOT an SDK/account regression — almost
 * always the testnet Hermes beta endpoint (oracle price VAAs) returning
 * 5xx/429, or a flaky fullnode connection. These steps are retried instead of
 * failing the chain. SDK aborts (`MoveAbort`, `EUnauthorized`, BCS errors)
 * deliberately do NOT match — those stay red.
 */
const TRANSIENT_RE =
  /Hermes price fetch failed: (?:429|5\d\d)|Service Temporarily Unavailable|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed|503|502|504|UNAVAILABLE|DEADLINE_EXCEEDED/i;

const MAX_TRANSIENT_RETRIES = 2;
const RETRY_BACKOFF_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runStep(step: Step, env: NodeJS.ProcessEnv, dryRun: boolean): Promise<StepResult> {
  const scriptAbs = path.resolve(process.cwd(), step.script);
  const tsxBin = path.resolve(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx",
  );
  const startedAt = Date.now();
  console.log(`\n========== [${step.name}] running ${step.script} ==========`);

  return new Promise<StepResult & { output: string }>((resolveStep) => {
    const child = spawn(tsxBin, [scriptAbs], {
      env: {
        ...env,
        ...(step.args?.env ?? {}),
        ...(dryRun ? {} : (step.args?.executeEnv ?? {})),
      },
      // Capture stderr too (tee'd below) so we can classify transient infra
      // failures — script errors are thrown to stderr.
      stdio: ["inherit", "pipe", "pipe"],
    });
    let captured: string | undefined;
    let output = "";
    const accountIdRe = /WATERX_SMOKE_ACCOUNT_ID=(0x[0-9a-fA-F]+)/;
    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
      if (step.args?.capturesAccountId && !captured) {
        const m = accountIdRe.exec(text);
        if (m) captured = m[1];
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on("error", (e) => {
      console.error("[%s] spawn error:", step.name, e);
      resolveStep({ step, exitCode: 1, durationMs: Date.now() - startedAt, output: String(e) });
    });
    child.on("exit", (code) => {
      resolveStep({
        step,
        exitCode: code ?? 1,
        durationMs: Date.now() - startedAt,
        capturedAccountId: captured,
        output,
      });
    });
  });
}

/**
 * Run a step, retrying up to `MAX_TRANSIENT_RETRIES` times when it fails with a
 * recognized transient infra error (Hermes 5xx/429, network blips). Genuine SDK
 * failures fail immediately.
 */
async function runStepWithRetry(
  step: Step,
  env: NodeJS.ProcessEnv,
  dryRun: boolean,
): Promise<StepResult> {
  let last: StepResult & { output: string } = {
    step,
    exitCode: 1,
    durationMs: 0,
    output: "",
  } as StepResult & { output: string };
  for (let attempt = 1; attempt <= MAX_TRANSIENT_RETRIES + 1; attempt++) {
    last = (await runStep(step, env, dryRun)) as StepResult & { output: string };
    last.attempts = attempt;
    if (last.exitCode === 0) return last;
    const transient = TRANSIENT_RE.test(last.output);
    if (!transient || attempt > MAX_TRANSIENT_RETRIES) return last;
    console.warn(
      `\n[smoke-chain] step "${step.name}" hit a transient infra error ` +
        `(attempt ${attempt}/${MAX_TRANSIENT_RETRIES + 1}) — retrying in ` +
        `${RETRY_BACKOFF_MS / 1000}s…`,
    );
    await sleep(RETRY_BACKOFF_MS);
  }
  return last;
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

  if (!chainEnv.WATERX_SMOKE_ACCOUNT_ID?.trim()) {
    chainEnv.WATERX_SMOKE_ACCOUNT_ID = DEFAULT_SMOKE_ACCOUNT_ID;
    console.log(
      `[smoke-chain] WATERX_SMOKE_ACCOUNT_ID unset — using committed default ` +
        `${DEFAULT_SMOKE_ACCOUNT_ID} (must be owned by the active signer).`,
    );
  }

  // No signer address and no local sui config (CI dry run) — fall back to the
  // default signer address. Dry runs only simulate, so the public address is
  // enough; no keystore secret is needed. Local dev (client.yaml present) keeps
  // using its own active address.
  if (!chainEnv.SUI_ACTIVE_ADDRESS?.trim() && !existsSync(CLIENT_YAML)) {
    chainEnv.SUI_ACTIVE_ADDRESS = DEFAULT_SMOKE_SIGNER;
    console.log(
      `[smoke-chain] no SUI_ACTIVE_ADDRESS and no client.yaml — using default ` +
        `signer address ${DEFAULT_SMOKE_SIGNER} (simulate-only; EXECUTE needs its key).`,
    );
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
    // Execute-only steps have no simulate path — skip under --dry-run so the
    // dry chain never broadcasts.
    if (flags.dryRun && step.args?.executeOnly) {
      console.log(`\n========== [${step.name}] skipped (execute-only, dry run) ==========`);
      results.push({ step, exitCode: 0, durationMs: 0, skipped: true });
      continue;
    }

    const result = await runStepWithRetry(step, chainEnv, flags.dryRun);
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
    const retries =
      r.attempts && r.attempts > 1
        ? ` (after ${r.attempts - 1} retr${r.attempts - 1 === 1 ? "y" : "ies"})`
        : "";
    console.log(`  [${tag}] ${r.step.name.padEnd(28)} ${r.durationMs}ms${retries}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

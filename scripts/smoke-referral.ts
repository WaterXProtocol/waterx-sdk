/**
 * Referral lifecycle smoke against testnet.
 *
 * Read helpers (always run, side-effect free):
 *   - isValidReferralCode(code)  pure-syntax charset/length check
 *   - referralCodeExists(code)   on-chain ReferralTable lookup
 *   - getRefererFor(address)     referrer bound to the sender, if any
 *
 * Write builders:
 *   - setReferralCode(code)      claim `code` for the sender's address
 *   - useReferralCode(code)      bind the sender as a referee of `code`
 *
 * Both writes are SIMULATED by default — a simulate proves the PTB builds
 * and reaches chain dispatch. They are one-shot and irreversible on-chain
 * (a code claim / referee bind cannot be undone), so real execution is
 * opt-in behind WATERX_REFERRAL_EXECUTE=1. A simulate that aborts with
 * REFERRAL_CODE_BEING_SET / REFERRAL_ALREADY_BOUND / SELF_REFERRAL /
 * REFERRAL_CODE_NOT_EXISTS still counts as a green dispatch.
 *
 * Run:
 *   pnpm exec tsx scripts/smoke-referral.ts
 *
 * Optional env:
 *   WATERX_REFERRAL_CODE       code to claim via setReferralCode, default "smoke"
 *   WATERX_REFERRAL_USE_CODE   referrer code to bind via useReferralCode, default "smoke"
 *   WATERX_REFERRAL_EXECUTE=1  actually sign + execute the write PTBs
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { getRefererFor, isValidReferralCode, referralCodeExists } from "../src/fetch.ts";
import { setReferralCode, useReferralCode } from "../src/index.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";

const KEYSTORE = resolve(homedir(), ".sui/sui_config/sui.keystore");
const CLIENT_YAML = resolve(homedir(), ".sui/sui_config/client.yaml");

function loadActiveKeypair(): { keypair: Ed25519Keypair; address: string } {
  const yaml = readFileSync(CLIENT_YAML, "utf8");
  const m = /active_address:\s*"?(0x[a-f0-9]+)"?/i.exec(yaml);
  if (!m) throw new Error("could not parse active_address from client.yaml");
  const activeAddress = m[1]!.toLowerCase();
  const keystore = JSON.parse(readFileSync(KEYSTORE, "utf8")) as string[];
  for (const encoded of keystore) {
    const raw = fromBase64(encoded);
    if (raw.length !== 33 || raw[0] !== 0x00) continue;
    const kp = Ed25519Keypair.fromSecretKey(raw.slice(1));
    if (kp.toSuiAddress().toLowerCase() === activeAddress) {
      return { keypair: kp, address: kp.toSuiAddress() };
    }
  }
  throw new Error(`no ED25519 key in keystore matches active address ${activeAddress}`);
}

interface SimResult {
  $kind?: string;
  FailedTransaction?: { status?: { error?: { message?: string } } };
}

type SimOutcome = "ok" | "aborted" | "error";

/**
 * Dry-run a write PTB. An on-chain abort is reported but not treated as a
 * script failure — referral writes routinely abort on a re-run (the code is
 * already claimed / the sender is already bound), which still proves the
 * builder produced a dispatchable PTB.
 */
async function sim(
  client: WaterXClient,
  sender: string,
  tx: Transaction,
  label: string,
): Promise<SimOutcome> {
  tx.setSender(sender);
  let r: SimResult;
  try {
    r = (await client.simulate(tx)) as unknown as SimResult;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${label.padEnd(30)} sdk error: ${String(e).slice(0, 200)}`);
    return "error";
  }
  if (r.$kind === "FailedTransaction") {
    const msg = r.FailedTransaction?.status?.error?.message?.slice(0, 220) ?? "(no msg)";
    console.log(`  \x1b[33m●\x1b[0m ${label.padEnd(30)} aborted on-chain: ${msg}`);
    return "aborted";
  }
  console.log(`  \x1b[32m✓\x1b[0m ${label.padEnd(30)} sim ok`);
  return "ok";
}

async function execute(
  client: WaterXClient,
  signer: Ed25519Keypair,
  tx: Transaction,
  label: string,
): Promise<boolean> {
  tx.setSender(signer.toSuiAddress());
  const r = (await client.signAndExecuteTransaction({
    signer,
    transaction: tx,
  })) as {
    Transaction?: { digest?: string; status?: { success?: boolean; error?: string | null } };
  };
  const digest = r.Transaction?.digest ?? "";
  const success = r.Transaction?.status?.success === true;
  console.log(
    `  ${success ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label.padEnd(30)} ${digest || "(no digest)"} ${success ? "" : (r.Transaction?.status?.error ?? "")}`,
  );
  if (digest) {
    await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 }).catch(() => {});
  }
  return success;
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const { keypair, address } = loadActiveKeypair();
  const client = await WaterXClient.create("TESTNET", { cache: true });

  const claimCode = process.env.WATERX_REFERRAL_CODE ?? "smoke";
  const useCode = process.env.WATERX_REFERRAL_USE_CODE ?? "smoke";
  const doExecute = process.env.WATERX_REFERRAL_EXECUTE === "1";

  const referralPkg = client.config.packages.waterx_referral;
  console.log(`Sender:         ${address}`);
  console.log(`referral pkg:   ${referralPkg?.published_at ?? "(missing)"}`);
  console.log(`referral_table: ${referralPkg?.referral_table ?? "(missing)"}`);
  console.log(`mode:           ${doExecute ? "SIM + EXECUTE" : "SIM only"}`);

  // ==========================================================================
  // 1. Read helpers — side-effect free, always run
  // ==========================================================================
  console.log("\n=== Referral reads ===");
  console.log(
    `  isValidReferralCode("${claimCode}")        ${await isValidReferralCode(client, claimCode)}`,
  );
  console.log(
    `  isValidReferralCode("BAD CODE!")     ${await isValidReferralCode(client, "BAD CODE!")}`,
  );
  console.log(
    `  referralCodeExists("${claimCode}")         ${await referralCodeExists(client, claimCode)}`,
  );
  console.log(
    `  getRefererFor(sender)                ${(await getRefererFor(client, address)) ?? "(none)"}`,
  );

  // ==========================================================================
  // 2. setReferralCode — claim `claimCode` for the sender's address
  // ==========================================================================
  console.log(`\n=== setReferralCode("${claimCode}") ===`);
  {
    const tx = new Transaction();
    setReferralCode(client, tx, { code: claimCode });
    const outcome = await sim(client, address, tx, "setReferralCode (sim)");
    if (doExecute && outcome === "ok") {
      await execute(client, keypair, tx, "setReferralCode (execute)");
    }
  }

  // ==========================================================================
  // 3. useReferralCode — bind the sender as a referee of `useCode`
  // ==========================================================================
  console.log(`\n=== useReferralCode("${useCode}") ===`);
  {
    const tx = new Transaction();
    useReferralCode(client, tx, { code: useCode });
    const outcome = await sim(client, address, tx, "useReferralCode (sim)");
    if (doExecute && outcome === "ok") {
      await execute(client, keypair, tx, "useReferralCode (execute)");
    }
  }

  // ==========================================================================
  // 4. Post-state reads — meaningful only after a real execute
  // ==========================================================================
  if (doExecute) {
    console.log("\n=== Post-state reads ===");
    console.log(
      `  referralCodeExists("${claimCode}")         ${await referralCodeExists(client, claimCode)}`,
    );
    console.log(
      `  getRefererFor(sender)                ${(await getRefererFor(client, address)) ?? "(none)"}`,
    );
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

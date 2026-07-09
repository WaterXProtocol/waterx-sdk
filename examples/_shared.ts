/**
 * Shared helpers for every example under `examples/`.
 *
 *   - `buildClient(network?)` — async PerpClient constructor (testnet default);
 *     reads the config URL from `WATERX_CONFIG_URL` (required — the SDK has no default)
 *   - `loadActiveKeypair()` — read the local Sui CLI's active ed25519 keypair
 *   - `sim(client, tx, label, sender?)` — dry-run a PTB via simulateTransaction
 *   - `execute(client, signer, tx, label)` — sign + dispatch on-chain
 *   - `dump(label, value)` — pretty-print a BCS-parsed struct (bigint → string)
 *   - `requireEnv(name)` — throw if missing
 *
 * Examples default to **simulate-only** for write actions. Pass
 * `WATERX_EXECUTE=1` to flip a single example into sign-and-send mode.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { PerpClient } from "../src/perp/client.ts";
import { DRY_RUN_SENDER } from "../src/perp/constants.ts";
import type { Network } from "../src/perp/constants.ts";

const KEYSTORE = resolve(homedir(), ".sui/sui_config/sui.keystore");
const CLIENT_YAML = resolve(homedir(), ".sui/sui_config/client.yaml");

export async function buildClient(network: Network = "TESTNET"): Promise<PerpClient> {
  const waterxConfigUrl = process.env.WATERX_CONFIG_URL;
  if (!waterxConfigUrl) {
    throw new Error(
      "buildClient: set WATERX_CONFIG_URL to a waterx-config JSON URL " +
        "(e.g. https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/testnet.json)",
    );
  }
  return PerpClient.create(network, { cache: true, waterxConfigUrl });
}

export function loadActiveKeypair(): { keypair: Ed25519Keypair; address: string } {
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

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`set ${name} env var first`);
  return v;
}

interface SimResult {
  $kind?: string;
  FailedTransaction?: { status?: { error?: { message?: string } } };
}

/** Dry-run a PTB. Returns `true` if simulate passed, `false` if it aborted. */
export async function sim(
  client: PerpClient,
  tx: Transaction,
  label: string,
  sender: string = DRY_RUN_SENDER,
): Promise<boolean> {
  tx.setSender(sender);
  const r = (await client.simulate(tx)) as unknown as SimResult;
  if (r.$kind === "FailedTransaction") {
    const msg = r.FailedTransaction?.status?.error?.message?.slice(0, 240) ?? "(no msg)";
    console.log(`  \x1b[33m●\x1b[0m ${label.padEnd(28)} sim aborted: ${msg}`);
    return false;
  }
  console.log(`  \x1b[32m✓\x1b[0m ${label.padEnd(28)} sim ok`);
  return true;
}

export async function execute(
  client: PerpClient,
  signer: Ed25519Keypair,
  tx: Transaction,
  label: string,
): Promise<{ digest: string; success: boolean }> {
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
    `  ${success ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label.padEnd(28)} ${digest || "(no digest)"} ${success ? "" : (r.Transaction?.status?.error ?? "")}`,
  );
  if (digest) {
    await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 }).catch(() => {});
  }
  return { digest, success };
}

/** True if `WATERX_EXECUTE=1`. Examples default to simulate-only. */
export function shouldExecute(): boolean {
  return process.env.WATERX_EXECUTE === "1";
}

/** Sim, then optionally execute when `WATERX_EXECUTE=1`. */
export async function simThenMaybeExecute(
  client: PerpClient,
  tx: Transaction,
  label: string,
  signer?: Ed25519Keypair,
): Promise<void> {
  const sender = signer?.toSuiAddress() ?? DRY_RUN_SENDER;
  if (!(await sim(client, tx, label, sender))) return;
  if (shouldExecute() && signer) {
    await execute(client, signer, tx, `${label} (execute)`);
  } else if (shouldExecute() && !signer) {
    console.log("  (WATERX_EXECUTE=1 set but no signer wired into this example)");
  } else {
    console.log("  (set WATERX_EXECUTE=1 to actually sign and send)");
  }
}

/** Pretty-print a BCS-parsed struct (or any object) with bigints stringified. */
export function dump(label: string, value: unknown): void {
  const text = JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  console.log(`  ${label}\n${text.replace(/^/gm, "    ")}`);
}

/** Generic example entry point — wires `main()` with consistent error output. */
export function run(main: () => Promise<void>): void {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

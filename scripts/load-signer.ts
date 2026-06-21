/**
 * Shared signer resolution for the smoke / funding scripts.
 *
 * Address (public) and key (secret) are deliberately split so simulate-only
 * (dry) runs never need the keystore:
 *
 *  - `resolveActiveAddress()` returns just the sender address — from the
 *    `SUI_ACTIVE_ADDRESS` env var (preferred) or `~/.sui/sui_config/client.yaml`.
 *    No private key is read. This is all a `--dry-run` / SIM path needs:
 *    `client.simulate()` does not sign, it only needs `tx.setSender(address)`.
 *  - `loadActiveKeypair()` reads the keystore and returns the full keypair —
 *    REQUIRED only to sign + broadcast (EXECUTE paths). Call it lazily, inside
 *    the `EXECUTE === "1"` branch, so a dry run has zero keystore dependency.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const KEYSTORE = resolve(homedir(), ".sui/sui_config/sui.keystore");
const CLIENT_YAML = resolve(homedir(), ".sui/sui_config/client.yaml");

/**
 * Active sender address (public, no secret). Prefers `SUI_ACTIVE_ADDRESS`,
 * falls back to `active_address` in `~/.sui/sui_config/client.yaml`.
 */
export function resolveActiveAddress(): string {
  const fromEnv = process.env.SUI_ACTIVE_ADDRESS?.trim();
  if (fromEnv) return fromEnv.toLowerCase();
  if (existsSync(CLIENT_YAML)) {
    const yaml = readFileSync(CLIENT_YAML, "utf8");
    const m = /active_address:\s*"?(0x[a-f0-9]+)"?/i.exec(yaml);
    if (m) return m[1]!.toLowerCase();
  }
  throw new Error(
    "no signer address: set SUI_ACTIVE_ADDRESS or provide ~/.sui/sui_config/client.yaml",
  );
}

/**
 * Full keypair from the local keystore — REQUIRED to sign + execute. Throws if
 * the keystore is missing or holds no ED25519 key matching the active address.
 * Only call this on EXECUTE paths; dry runs use `resolveActiveAddress()`.
 */
export function loadActiveKeypair(): { keypair: Ed25519Keypair; address: string } {
  const address = resolveActiveAddress();
  const keystore = JSON.parse(readFileSync(KEYSTORE, "utf8")) as string[];
  for (const encoded of keystore) {
    const raw = fromBase64(encoded);
    if (raw.length !== 33 || raw[0] !== 0x00) continue;
    const kp = Ed25519Keypair.fromSecretKey(raw.slice(1));
    if (kp.toSuiAddress().toLowerCase() === address) {
      return { keypair: kp, address: kp.toSuiAddress() };
    }
  }
  throw new Error(`no ED25519 key in keystore matches active address ${address}`);
}

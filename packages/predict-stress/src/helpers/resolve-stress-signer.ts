/**
 * Resolve stress wallet signer from JSON privateKey or local Sui CLI keystore.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Ed25519Keypair as Ed25519KeypairClass } from "@mysten/sui/keypairs/ed25519";

import { loadSignerFromSecret } from "./env.ts";
import type { StressWalletEntry } from "./stress-wallets.ts";

const KEYSTORE = resolve(homedir(), ".sui/sui_config/sui.keystore");

let keystoreCache: Map<string, Ed25519Keypair> | undefined;

function loadKeystoreKeypairs(): Map<string, Ed25519Keypair> {
  if (keystoreCache) return keystoreCache;
  if (!existsSync(KEYSTORE)) {
    keystoreCache = new Map();
    return keystoreCache;
  }
  const keystore = JSON.parse(readFileSync(KEYSTORE, "utf8")) as string[];
  const byAddress = new Map<string, Ed25519Keypair>();
  for (const encoded of keystore) {
    const raw = fromBase64(encoded);
    if (raw.length !== 33 || raw[0] !== 0x00) continue;
    const kp = Ed25519KeypairClass.fromSecretKey(raw.slice(1));
    byAddress.set(kp.toSuiAddress().toLowerCase(), kp);
  }
  keystoreCache = byAddress;
  return byAddress;
}

export interface StressWalletRow extends StressWalletEntry {
  owner?: string;
}

/** Prefer `privateKey` in JSON; fall back to Sui keystore matched by `owner`. */
export function resolveStressSigner(row: StressWalletRow): Ed25519Keypair {
  const pk = row.privateKey?.trim();
  if (pk) {
    const signer = loadSignerFromSecret(pk);
    const owner = row.owner?.trim().toLowerCase();
    if (owner && signer.toSuiAddress().toLowerCase() !== owner) {
      throw new Error(
        `${row.label ?? "wallet"}: privateKey address does not match owner ${row.owner}`,
      );
    }
    return signer;
  }

  const owner = row.owner?.trim();
  if (!owner?.startsWith("0x")) {
    throw new Error(`${row.label ?? "wallet"}: set privateKey or owner in wallets.json`);
  }
  const signer = loadKeystoreKeypairs().get(owner.toLowerCase());
  if (!signer) {
    throw new Error(
      `${row.label ?? owner}: no privateKey and no keystore key — add privateKey to wallets.json`,
    );
  }
  return signer;
}

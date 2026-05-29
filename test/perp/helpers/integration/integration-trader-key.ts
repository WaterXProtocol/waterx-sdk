/**
 * Integration trader key loading (shared by integration Vitest + e2e preflight).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "../../..");

export const INTEGRATION_TRADER_KEYSTORE_PATH = path.join(repoRoot, ".integration-trader.keystore");

function keypairFromSuiKeystoreEntry(encoded: string): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(fromBase64(encoded).slice(1));
}

export function isIntegrationTraderConfigured(): boolean {
  if (process.env.WATERX_INTEGRATION_PRIVATE_KEY?.trim()) return true;
  return existsSync(INTEGRATION_TRADER_KEYSTORE_PATH);
}

export function loadIntegrationTraderKeypair(): Ed25519Keypair {
  const fromEnv = process.env.WATERX_INTEGRATION_PRIVATE_KEY?.trim();
  if (fromEnv) {
    return Ed25519Keypair.fromSecretKey(fromEnv);
  }

  if (!existsSync(INTEGRATION_TRADER_KEYSTORE_PATH)) {
    throw new Error(
      "Integration trader key not configured. Add WATERX_INTEGRATION_PRIVATE_KEY to .env " +
        "(Bech32 suiprivkey...) or create .integration-trader.keystore at the repo root.",
    );
  }

  const keys = JSON.parse(readFileSync(INTEGRATION_TRADER_KEYSTORE_PATH, "utf8")) as string[];
  const wantAddr = process.env.WATERX_INTEGRATION_ADDRESS?.trim().toLowerCase();

  for (const entry of keys) {
    let kp: Ed25519Keypair;
    try {
      kp = keypairFromSuiKeystoreEntry(entry);
    } catch (err) {
      console.warn(
        `[integration] Skipping keystore entry — failed to decode: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }
    if (!wantAddr || kp.getPublicKey().toSuiAddress().toLowerCase() === wantAddr) {
      return kp;
    }
  }

  throw new Error(
    "No usable Ed25519 key in .integration-trader.keystore " +
      "(or none matching WATERX_INTEGRATION_ADDRESS).",
  );
}

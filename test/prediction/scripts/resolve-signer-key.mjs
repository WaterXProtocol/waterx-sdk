/**
 * Resolve owner private key for prediction scripts (staging JWT, local mint, seed).
 * Matches test/prediction/helpers/env.ts + setup-integration.ts precedence.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as dotenvConfig, parse as dotenvParse } from "dotenv";

export function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

/**
 * Same precedence as `scripts/load-repo-env.ts`: shell export wins; then `.env`; then
 * `.env.local` overrides `.env` for keys that were not exported in the shell.
 */
export function loadRepoDotenv(repoRoot) {
  const envBeforeFiles = { ...process.env };
  dotenvConfig({ path: resolve(repoRoot, ".env"), quiet: true });
  const localPath = resolve(repoRoot, ".env.local");
  if (existsSync(localPath)) {
    const parsedLocal = dotenvParse(readFileSync(localPath, "utf8"));
    for (const [key, value] of Object.entries(parsedLocal)) {
      if (!Object.hasOwn(envBeforeFiles, key)) {
        process.env[key] = value;
      }
    }
  }
}

/**
 * @param {string} repoRoot
 * @returns {string | undefined}
 */
export function resolveSignerPrivateKey(repoRoot) {
  loadRepoDotenv(repoRoot);
  return (
    process.env.SUI_PRIVATE_KEY?.trim() ||
    process.env.WATERX_INTEGRATION_PRIVATE_KEY?.trim() ||
    undefined
  );
}

export async function loadSignerKeypair(repoRoot) {
  const key = resolveSignerPrivateKey(repoRoot);
  if (!key) {
    throw new Error(
      "No owner private key — set SUI_PRIVATE_KEY (or WATERX_INTEGRATION_PRIVATE_KEY) in repo-root .env or .env.local",
    );
  }
  const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
  const { decodeSuiPrivateKey } = await import("@mysten/sui/cryptography");
  const { secretKey } = decodeSuiPrivateKey(key);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

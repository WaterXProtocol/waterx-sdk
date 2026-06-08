#!/usr/bin/env node
/**
 * Mint a local WaterX API JWT (dev only) matching apps/waterx/.env JWT_SECRET.
 *
 * Usage (from repo root):
 *   pnpm mint:api-jwt
 *   node test/prediction/scripts/mint-api-jwt.mjs --address 0xYourWallet
 *   WATERX_ENV=../bucket-backend-mono-1/apps/waterx/.env pnpm mint:api-jwt
 */
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSignerPrivateKey } from "./resolve-signer-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const DEFAULT_WATERX_ENV = resolve(REPO_ROOT, "../bucket-backend-mono-1/apps/waterx/.env");
const SDK_ENV = resolve(REPO_ROOT, ".env");

const DEFAULT_DEV_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

function parseEnvFile(path) {
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

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function upsertEnv(path, updates) {
  const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
  const keys = new Set(Object.keys(updates));
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (t && !t.startsWith("#") && t.includes("=")) {
      const key = t.slice(0, t.indexOf("=")).trim();
      if (keys.has(key)) {
        out.push(`${key}=${updates[key]}`);
        keys.delete(key);
        continue;
      }
    }
    out.push(line);
  }
  if (keys.size > 0) {
    if (out.length > 0 && out[out.length - 1] !== "") out.push("");
    out.push("# --- API smoke (mint-api-jwt.mjs) ---");
    for (const key of keys) {
      out.push(`${key}=${updates[key]}`);
    }
  }
  writeFileSync(path, out.join("\n").replace(/\n*$/, "\n"));
}

function parseAddressArg() {
  const i = process.argv.indexOf("--address");
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

async function deriveAddressFromSdkEnv() {
  const key = resolveSignerPrivateKey(REPO_ROOT);
  if (!key) return undefined;
  try {
    const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
    const { decodeSuiPrivateKey } = await import("@mysten/sui/cryptography");
    const { secretKey } = decodeSuiPrivateKey(key.trim());
    return Ed25519Keypair.fromSecretKey(secretKey).getPublicKey().toSuiAddress();
  } catch {
    return undefined;
  }
}

const waterxEnvPath = process.env.WATERX_ENV ?? DEFAULT_WATERX_ENV;
const waterxEnv = parseEnvFile(waterxEnvPath);
const jwtSecret = process.env.JWT_SECRET ?? waterxEnv.JWT_SECRET ?? "change-me-in-production";
const expiresInSec = Number.parseInt(
  process.env.JWT_EXPIRES_IN ?? waterxEnv.JWT_EXPIRES_IN ?? "86400",
  10,
);

const suiAddress =
  parseAddressArg() ?? (await deriveAddressFromSdkEnv()) ?? DEFAULT_DEV_ADDRESS;

const now = Math.floor(Date.now() / 1000);
const token = signJwt(
  {
    sub: suiAddress,
    suiAddress,
    xId: null,
    xUsername: null,
    iat: now,
    exp: now + expiresInSec,
    jti: randomBytes(8).toString("hex"),
  },
  jwtSecret,
);

upsertEnv(SDK_ENV, {
  E2E_API_ENV: "local",
  E2E_API_BASE_URL: "http://localhost:3003",
  E2E_API_JWT: token,
  E2E_DEV_SUI_ADDRESS: suiAddress,
});

console.log("Minted local API JWT (dev only)");
console.log(`  waterx .env:  ${waterxEnvPath}`);
console.log(
  `  JWT_SECRET:   ${jwtSecret === "change-me-in-production" ? "change-me-in-production (default)" : "(from waterx .env)"}`,
);
console.log(`  suiAddress:   ${suiAddress}`);
console.log(`  wrote:        ${SDK_ENV}`);
console.log("");
console.log("Run: pnpm test:api:local");

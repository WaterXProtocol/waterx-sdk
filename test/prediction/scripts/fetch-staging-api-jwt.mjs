#!/usr/bin/env node
/**
 * Obtain a staging WaterX API JWT via /auth/nonce + wallet sign + /auth/login|register.
 * Writes E2E_API_JWT into repo-root .env (needs SUI_PRIVATE_KEY or WATERX_INTEGRATION_PRIVATE_KEY in .env / .env.local).
 *
 * Usage: pnpm mint:api-jwt:staging
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadSignerKeypair } from "./resolve-signer-key.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const SDK_ENV = resolve(REPO_ROOT, ".env");
const STAGING_ENV_FILE = resolve(REPO_ROOT, "test/prediction/api/environments/staging.json");

function _parseEnvFile(path) {
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
    out.push("# --- API smoke (fetch-staging-api-jwt.mjs) ---");
    for (const key of keys) {
      out.push(`${key}=${updates[key]}`);
    }
  }
  writeFileSync(path, out.join("\n").replace(/\n*$/, "\n"));
}

function readStagingBaseUrl() {
  const override = process.env.E2E_STAGING_API_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  const raw = JSON.parse(readFileSync(STAGING_ENV_FILE, "utf8"));
  if (!raw.baseUrl?.trim()) {
    throw new Error("staging.json baseUrl is empty — set E2E_STAGING_API_BASE_URL");
  }
  return raw.baseUrl.replace(/\/$/, "");
}

async function postJson(baseUrl, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function authRound(baseUrl, keypair, action) {
  const suiAddress = keypair.getPublicKey().toSuiAddress();
  const nonceRes = await postJson(baseUrl, "/auth/nonce", { suiAddress });
  if (nonceRes.status !== 200 && nonceRes.status !== 201) {
    throw new Error(`/auth/nonce failed (${nonceRes.status}): ${JSON.stringify(nonceRes.json)}`);
  }
  const envelope = nonceRes.json;
  const data = envelope?.success === true ? envelope.data : envelope;
  const message = data?.message;
  if (!message) {
    throw new Error(`Unexpected /auth/nonce response: ${JSON.stringify(nonceRes.json)}`);
  }
  const bytes = new TextEncoder().encode(message);
  const { signature } = await keypair.signPersonalMessage(bytes);
  const payload = { suiAddress, message, signature };
  const authRes = await postJson(baseUrl, `/auth/${action}`, payload);
  return { suiAddress, authRes };
}

function extractAccessToken(authRes) {
  const body = authRes.json;
  const data = body?.success === true ? body.data : body;
  const token = data?.accessToken;
  if (authRes.status !== 200 && authRes.status !== 201) {
    throw new Error(`/auth failed (${authRes.status}): ${JSON.stringify(body)}`);
  }
  if (!token) {
    throw new Error(`No accessToken in response: ${JSON.stringify(body)}`);
  }
  return token;
}

const baseUrl = readStagingBaseUrl();
const keypair = await loadSignerKeypair(REPO_ROOT);

console.log(`Staging API: ${baseUrl}`);
console.log(`Wallet:      ${keypair.getPublicKey().toSuiAddress()}`);

const check = await postJson(baseUrl, "/auth/check", {
  suiAddress: keypair.getPublicKey().toSuiAddress(),
});
const checkData = check.json?.success === true ? check.json.data : check.json;
const exists = checkData?.exists === true;

let token;
if (exists) {
  console.log("User exists — logging in...");
  const { authRes } = await authRound(baseUrl, keypair, "login");
  token = extractAccessToken(authRes);
} else {
  console.log("User not found — registering (wallet-only)...");
  const { authRes } = await authRound(baseUrl, keypair, "register");
  token = extractAccessToken(authRes);
}

upsertEnv(SDK_ENV, {
  E2E_API_ENV: "staging",
  E2E_API_JWT: token,
});

console.log("");
console.log("Wrote staging E2E_API_JWT to .env");
console.log("Run: pnpm test:api:staging");

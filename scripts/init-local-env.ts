#!/usr/bin/env tsx
/**
 * Create `.env.local` from `.env.example` once (never overwrite).
 * On Unix, tightens permissions to owner-read/write (`0o600`).
 *
 * Usage: `pnpm env:init`
 */
import { chmodSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const examplePath = path.join(repoRoot, ".env.example");
const localPath = path.join(repoRoot, ".env.local");

if (!existsSync(examplePath)) {
  console.error(`Missing ${path.relative(repoRoot, examplePath)} — cannot bootstrap local env.`);
  process.exit(1);
}

if (existsSync(localPath)) {
  console.info(
    `${path.relative(repoRoot, localPath)} already exists — leaving unchanged (no overwrite).`,
  );
  process.exit(0);
}

copyFileSync(examplePath, localPath);

try {
  chmodSync(localPath, 0o600);
} catch {
  /* chmod unsupported or irrelevant (e.g. Windows). */
}

console.info(
  `Created ${path.relative(repoRoot, localPath)} from .env.example.\n` +
    `Edit it with your secrets (gitignored). Prefer .env.local over .env for private keys.`,
);

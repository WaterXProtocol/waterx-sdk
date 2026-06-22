#!/usr/bin/env node
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wallets = join(root, "config/wallets.json");
const example = join(root, "config/wallets.example.json");
const env = join(root, ".env");
const envExample = join(root, ".env.example");

if (!existsSync(wallets) && existsSync(example)) {
  copyFileSync(example, wallets);
  console.log("Created config/wallets.json — fill privateKey + accountId");
}
if (!existsSync(env) && existsSync(envExample)) {
  copyFileSync(envExample, env);
  console.log("Created .env — add chain overrides if needed");
}
console.log("Ready. Next: edit config/wallets.json, then pnpm accounts && pnpm deposits");

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { optionalEnv } from "./e2e-env.ts";

export interface ApiEnvironmentFile {
  name: string;
  baseUrl: string;
}

export interface ApiEnvironment {
  name: string;
  baseUrl: string;
  jwt?: string;
}

/** API smoke / crosscheck / diagnose default — matches frontend staging Railway. */
const DEFAULT_ENV_NAME = "staging";

function repoEnvironmentsDir(): string {
  return resolve(process.cwd(), "config/environments");
}

function readEnvironmentFile(envName: string, environmentsDir: string): ApiEnvironmentFile | null {
  const path = resolve(environmentsDir, `${envName}.json`);
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, "utf8")) as ApiEnvironmentFile;
  if (!raw.name || typeof raw.baseUrl !== "string") {
    throw new Error(`Invalid API environment file: ${path}`);
  }
  return raw;
}

export interface ResolveApiEnvironmentOptions {
  envName?: string;
  baseUrlOverride?: string;
  jwtOverride?: string;
  environmentsDir?: string;
}

/**
 * Postman-style API target: JSON environment file + process.env overrides.
 * Returns null when no usable baseUrl (CI default; staging placeholder).
 */
export function resolveApiEnvironment(
  options: ResolveApiEnvironmentOptions = {},
): ApiEnvironment | null {
  const envName = options.envName ?? optionalEnv("E2E_API_ENV") ?? DEFAULT_ENV_NAME;
  const dir = options.environmentsDir ?? repoEnvironmentsDir();
  const file = readEnvironmentFile(envName, dir);
  if (!file) return null;

  // JSON env file wins over `.env` E2E_API_BASE_URL so `pnpm test:api:staging` is not
  // accidentally pointed at localhost when .env still has local overrides.
  const baseUrl = (
    options.baseUrlOverride ??
    (file.baseUrl.trim() ? file.baseUrl : undefined) ??
    optionalEnv("E2E_API_BASE_URL") ??
    ""
  ).trim();
  if (!baseUrl) return null;

  const jwt = options.jwtOverride ?? optionalEnv("E2E_API_JWT");

  return {
    name: file.name,
    baseUrl: baseUrl.replace(/\/$/, ""),
    ...(jwt ? { jwt } : {}),
  };
}

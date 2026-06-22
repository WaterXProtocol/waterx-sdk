/**
 * Unified stress config: JSON profile + optional .env overrides.
 * Env vars still win when already set in the shell.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_ROOT } from "./load-env.ts";

export type StressProfileName =
  | "dry-run"
  | "smoke"
  | "smoke-fill"
  | "ramp"
  | "timing-max"
  | "hammer-smoke"
  | "hammer"
  | "custom";

export interface StressConfigFile {
  api?: {
    env?: string;
    baseUrl?: string;
    jwt?: string;
  };
  walletsFile?: string;
  stakes?: {
    startUsd?: number;
    stepUsd?: number;
  };
  run?: {
    segments?: string[];
    brokerWaitMs?: number;
    cooldownMs?: number;
    feedLimit?: number;
  };
  profiles?: Partial<
    Record<
      StressProfileName,
      {
        phases?: number[];
        rounds?: number;
        parallel?: number;
        placeOnly?: boolean;
        hammer?: boolean;
        dryRun?: boolean;
        cooldownMs?: number;
      }
    >
  >;
}

const DEFAULT_CONFIG: StressConfigFile = {
  api: { env: "staging" },
  walletsFile: "config/wallets.json",
  stakes: { startUsd: 1.01, stepUsd: 0.01 },
  run: {
    segments: ["crypto", "sport"],
    brokerWaitMs: 45_000,
    cooldownMs: 30_000,
    feedLimit: 200,
  },
  profiles: {
    "dry-run": { dryRun: true, phases: [1] },
    smoke: { phases: [1], placeOnly: true, cooldownMs: 0 },
    "smoke-fill": { phases: [1], cooldownMs: 0 },
    ramp: { phases: [1, 2, 4, 8] },
    "timing-max": { phases: [8], cooldownMs: 0 },
    "hammer-smoke": { hammer: true, rounds: 1, placeOnly: true, cooldownMs: 0 },
    hammer: { hammer: true, rounds: 10, placeOnly: true, cooldownMs: 0 },
  },
};

function configPath(): string {
  return join(PACKAGE_ROOT, "config/stress.config.json");
}

export function loadStressConfigFile(): StressConfigFile {
  const path = configPath();
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const raw = JSON.parse(readFileSync(path, "utf8")) as StressConfigFile;
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    api: { ...DEFAULT_CONFIG.api, ...raw.api },
    stakes: { ...DEFAULT_CONFIG.stakes, ...raw.stakes },
    run: { ...DEFAULT_CONFIG.run, ...raw.run },
    profiles: { ...DEFAULT_CONFIG.profiles, ...raw.profiles },
  };
}

function setEnvIfUnset(key: string, value: string | undefined): void {
  if (value == null || value === "") return;
  if (!Object.hasOwn(process.env, key)) {
    process.env[key] = value;
  }
}

/** Apply `config/stress.config.json` + profile into process.env for existing helpers. */
export function applyStressProfile(profileName: StressProfileName): void {
  const cfg = loadStressConfigFile();
  const profile = cfg.profiles?.[profileName];

  setEnvIfUnset("E2E_API_ENV", cfg.api?.env);
  setEnvIfUnset("E2E_API_BASE_URL", cfg.api?.baseUrl);
  setEnvIfUnset("E2E_API_JWT", cfg.api?.jwt);
  setEnvIfUnset("E2E_STRESS_WALLETS_FILE", cfg.walletsFile);
  setEnvIfUnset("E2E_STRESS_BET_START_USD", cfg.stakes?.startUsd?.toString());
  setEnvIfUnset("E2E_STRESS_BET_STEP_USD", cfg.stakes?.stepUsd?.toString());
  setEnvIfUnset("E2E_STRESS_SEGMENTS", cfg.run?.segments?.join(","));
  setEnvIfUnset("E2E_STRESS_BROKER_WAIT_MS", cfg.run?.brokerWaitMs?.toString());
  setEnvIfUnset("E2E_STRESS_FEED_LIMIT", cfg.run?.feedLimit?.toString());

  if (!profile) return;

  if (profile.dryRun) setEnvIfUnset("E2E_STRESS_DRY_RUN", "1");
  if (profile.placeOnly) setEnvIfUnset("E2E_STRESS_PLACE_ONLY", "1");
  if (profile.hammer) setEnvIfUnset("E2E_STRESS_HAMMER", "1");
  if (profile.phases?.length) {
    setEnvIfUnset("E2E_STRESS_PHASES", profile.phases.join(","));
  }
  if (profile.rounds != null) {
    setEnvIfUnset("E2E_STRESS_ROUNDS", String(profile.rounds));
  }
  if (profile.parallel != null) {
    setEnvIfUnset("E2E_STRESS_PARALLEL", String(profile.parallel));
  }
  const cooldown = profile.cooldownMs ?? cfg.run?.cooldownMs;
  if (cooldown != null) {
    setEnvIfUnset("E2E_STRESS_COOLDOWN_MS", String(cooldown));
  }
}

export function parseProfileArg(argv: string[]): StressProfileName {
  const idx = argv.indexOf("--profile");
  if (idx === -1 || !argv[idx + 1]) return "custom";
  return argv[idx + 1] as StressProfileName;
}

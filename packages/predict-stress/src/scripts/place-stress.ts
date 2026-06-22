#!/usr/bin/env tsx
/**
 * Entry wrapper: load config profile, then run stress harness core.
 */
import { loadPackageEnv } from "../load-env.ts";
import { applyStressProfile, parseProfileArg } from "../stress-config.ts";

loadPackageEnv();
const profile = parseProfileArg(process.argv);
if (profile !== "custom") {
  applyStressProfile(profile);
}

await import("./place-stress-core.ts");

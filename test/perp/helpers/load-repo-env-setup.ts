/**
 * Vitest **setupFiles** entry: load `.env` / `.env.local` before any project code reads `process.env`.
 */
import { loadRepoEnvFiles } from "../../../scripts/load-repo-env.ts";

loadRepoEnvFiles();

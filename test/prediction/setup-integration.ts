import { loadRepoEnvFiles } from "../../scripts/load-repo-env.ts";

/** Optional repo-root env (`.env` then `.env.local` — local overrides; shell export wins). */
loadRepoEnvFiles();

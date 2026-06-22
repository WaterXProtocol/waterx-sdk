import { loadRepoEnvFiles } from "../../scripts/load-repo-env.ts";

/** Optional repo-root env for API smoke tests (`E2E_API_ENV`, `E2E_API_JWT`). Not used in CI. */
loadRepoEnvFiles();

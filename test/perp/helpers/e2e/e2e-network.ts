/**
 * Pure e2e network resolver — no client/config side effects.
 *
 * Split out of `e2e-client.ts` so pure helpers (discovery, preflight flags)
 * can resolve the target network WITHOUT importing the eager `clientInit`
 * IIFE, which builds a `PerpClient` (and calls `loadConfig`) at module load.
 * Importing this module never touches the network or requires a config URL,
 * so it is safe to pull into unit-project test chains.
 *
 * Network precedence:
 *   1. `--testnet` / `--mainnet` in `process.argv` (from `scripts/run-e2e.ts`)
 *   2. `WATERX_E2E_NETWORK`
 *   3. **testnet** (default; use `--mainnet` / env when canonical mainnet.json is ready)
 */
export type E2eNetwork = "testnet" | "mainnet";

export function resolveE2eNetwork(): E2eNetwork {
  const argv = process.argv ?? [];
  if (argv.includes("--testnet")) return "testnet";
  if (argv.includes("--mainnet")) return "mainnet";
  const raw = process.env.WATERX_E2E_NETWORK?.trim().toLowerCase();
  if (raw === "testnet" || raw === "mainnet") return raw;
  return "testnet";
}

import type { PerpClient } from "../client.ts";

/**
 * Perp `fetch/` simulate plumbing.
 *
 * The generic simulate/decode core (build one-shot PTB → `client.simulate(tx)`
 * with the zero-address sender → decode BCS) lives in the account base
 * (`account/fetch/simulate.ts`) so it isn't duplicated per line; re-exported
 * here unchanged. Only `withLp` (perp's WLP-type default) is perp-specific.
 * Internal to `fetch/` — not part of the public surface.
 */

export {
  type SimulationCommandResult,
  type SimulationResult,
  extractAt,
  simulateAndExtract,
  simulateRaw,
  toBytes,
} from "../../account/fetch/simulate.ts";

export function withLp(client: PerpClient, lpType?: string): string {
  return lpType ?? client.wlpType();
}

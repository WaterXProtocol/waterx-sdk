/**
 * Oracle access config — the caller-supplied credential / endpoint / fetch
 * policy slices the oracle rules read off the host (`client.pyth`,
 * `client.waterx`). NOTHING here comes from the canonical `waterx-config`
 * document: on-chain rule wiring lives at `config.oracle_rules.*` (see
 * `src/config.ts`), and every source's external infra lives with its rule
 * (`LAZER_INFRA` in `rules/pyth-lazer-rule.ts`, `WATERX_INFRA` in
 * `rules/waterx-rule.ts`). Shared infra — nothing here imports `perp/` or
 * `prediction/`.
 */

import type { FetchPolicy } from "./update-fetch.ts";

// ============================================================================
// Pyth access — caller-supplied credential + fetch policy (NO infra here)
// ============================================================================

/**
 * The caller-tunable subset of `fetchWithPolicy`'s policy exposed on the
 * `pythFetch` create option and `client.pyth.fetch` — the retry/timeout budget
 * for the off-chain Lazer (`PythLazerRule`) update fetch and the Lazer read
 * executor (`readLazerPrices`). Deliberately narrower than the internal
 * `FetchPolicy` (no `retryDelayMs` / `apiKey` / `fetchImpl`). Falls back to
 * `fetchWithPolicy`'s defaults (15s timeout, 2 retries) when unset.
 */
export type PythFetchPolicy = { timeoutMs?: number; retries?: number };

/**
 * `client.pyth` — ONLY the caller-supplied Pyth credential + fetch policy,
 * read by `PythLazerRule`. It carries NO endpoints and NO on-chain object
 * ids: every oracle source owns its own infra, co-located with its rule (the
 * Lazer constants inside `rules/pyth-lazer-rule.ts`). A non-Pyth source
 * never reads this slice.
 * Nothing here is sourced from the canonical `waterx-config` JSON — a Bearer
 * secret has no place in a public CDN document.
 */
export interface PythAccessConfig {
  /**
   * Pyth access token (`Authorization: Bearer …`). Required by
   * `PythLazerRule`'s signed-update fetch — Lazer is auth-first, so there is
   * no keyless default; absent when a lazer-routed build runs →
   * `LazerApiKeyMissing` is thrown by `refreshOraclePrices`'s credential
   * pre-check (before any fetch) or by the rule's own fetch. Supplied via
   * the `pythApiKey` create option (the SDK never reads `process.env` or the
   * config JSON). The same key authenticates the Pyth Pro read/history
   * surfaces (`readLazerPrices`, `fetchPythProHistory`).
   */
  api_key?: string;
  /**
   * Retry/timeout policy for the Lazer (`PythLazerRule`) off-chain update
   * fetch — see `fetchWithPolicy` (`./update-fetch.ts`) for the full policy
   * (backoff, which statuses retry, Bearer attachment). Supplied via the
   * `pythFetch` create option. Optional: defaults to `fetchWithPolicy`'s
   * built-in defaults (15s timeout, 2 retries) when unset.
   */
  fetch?: PythFetchPolicy;
}

// ============================================================================
// WaterX quote-center access — caller-supplied overrides (NO infra here)
// ============================================================================

/**
 * `client.waterx` — ONLY the caller-supplied quote-center overrides for
 * `WaterxRule`, mirroring {@link PythAccessConfig}: no resolved infra lives on
 * the client. When a field is unset the rule resolves it against its OWN
 * per-network table (`WATERX_INFRA` in `rules/waterx-rule.ts`) — no other
 * source's endpoint or policy is ever consulted.
 *
 * The endpoint override exists because this is the one oracle source a BROWSER
 * fetches itself: the rule pulls the signed envelope from the page, so it is
 * subject to the quote-center deployment's CORS allowlist. A front end whose
 * origin is not on that list — or one that must route egress through its own
 * backend — points `endpoint` at a same-origin proxy (or supplies
 * `fetch.fetchImpl`) instead of being locked to the default host.
 */
export interface WaterxAccessConfig {
  /**
   * Quote-center base URL override (`waterxEndpoint` create option) — THE
   * canonical description of that option; the create-option docs link here.
   *
   * An absolute URL. A base PATH is preserved — the rule appends via
   * `joinEndpointPath`, so `https://app.example/api/quote-center` resolves to
   * `…/api/quote-center/<route>` and a proxy route is not rewritten away. A
   * trailing slash is trimmed.
   *
   * A same-origin proxy must forward EVERY route the rule reads, spelled out
   * here because a proxy author has to copy them:
   *
   * - `GET /v1/sign/bbo/consensus` — the per-symbol leaf route it prefers.
   * - `GET /v1/quotes/leaves` — the same shape on a quote-center predating the
   *   rename; tried second.
   * - `GET /v1/quotes/update` — the batch envelope, tried last.
   *
   * Forwarding only some of them is not a soft failure: once every rung 404s
   * the rule throws and NO tx can be built. `?symbols=` must be preserved.
   */
  endpoint?: string;
  /**
   * Retry/timeout policy (and `fetchImpl`) for the quote-center fetch — see
   * `fetchWithPolicy` (`./update-fetch.ts`). Supplied via the `waterxFetch`
   * create option. Falls back to `fetchWithPolicy`'s built-in defaults (15s
   * timeout, 2 retries) when unset — never to another source's policy.
   */
  fetch?: FetchPolicy;
}

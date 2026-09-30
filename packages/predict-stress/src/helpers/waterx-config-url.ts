/**
 * `WATERX_CONFIG_URL` → a concrete `waterx-config` document URL.
 *
 * THE env-boundary rule, shared by every harness (scripts, e2e/integration
 * helpers, examples): **`WATERX_CONFIG_URL` is a CDN ROOT, without a file
 * name**, and the harness composes `${root}/${network}.json` for the network
 * it already runs against. One exported value drives both networks, and a
 * mainnet run can never load a testnet document.
 *
 * The SDK itself still knows nothing about env: `loadConfig` takes a COMPLETE
 * URL via the `waterxConfigUrl` opt. The composition and its validation are
 * the SDK's public `waterxConfigUrlFromRoot`; this module adds only the env
 * reading, which is why it lives outside `src/`.
 *
 * Rejected loudly, never rewritten: a value ending in `.json` (the old
 * full-document form), a non-https value, a GitHub host, and any retired alias
 * variable ({@link RETIRED_CONFIG_URL_ALIASES}) being set.
 *
 * Reference roots: production `https://main-v2.waterx-config.pages.dev`,
 * staging `https://staging-v2.waterx-config.pages.dev`.
 */

import { waterxConfigUrlFromRoot } from "@waterx/sdk/config";

export type ConfigUrlNetwork = "testnet" | "mainnet" | "TESTNET" | "MAINNET";

/**
 * Env names that used to carry the config URL. Setting one now throws, so a
 * deployment that relies on the old name cannot silently lose its override.
 */
export const RETIRED_CONFIG_URL_ALIASES = Object.freeze([
  "E2E_CONFIG_URL",
  "PREDICT_CONFIG_URL",
] as const);

/** Throw when any retired alias of `WATERX_CONFIG_URL` is set in `env`. */
export function assertNoRetiredConfigUrlAliases(
  env: Record<string, string | undefined> = process.env,
): void {
  const set = RETIRED_CONFIG_URL_ALIASES.filter((name) => env[name]?.trim());
  if (set.length > 0) {
    throw new Error(
      `${set.join(", ")} ${set.length === 1 ? "is" : "are"} retired. Unset ` +
        `${set.length === 1 ? "it" : "them"} and set WATERX_CONFIG_URL to the config CDN ROOT ` +
        `instead (e.g. https://staging-v2.waterx-config.pages.dev); /<network>.json is appended.`,
    );
  }
}

/**
 * Resolve `raw` (a `WATERX_CONFIG_URL`-shaped value) to the document URL for
 * `network`. Returns `undefined` for an unset/blank value, so a caller can
 * pass it straight through to `waterxConfigUrl` and let client creation throw
 * its own "no config URL" error. Throws for an invalid root (see
 * `waterxConfigUrlFromRoot`).
 */
export function resolveWaterxConfigUrl(
  raw: string | undefined,
  network: ConfigUrlNetwork,
): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  try {
    return waterxConfigUrlFromRoot(value, network);
  } catch (err) {
    throw new Error(`WATERX_CONFIG_URL: ${(err as Error).message}`, { cause: err });
  }
}

/**
 * The document URL for `network` from `env.WATERX_CONFIG_URL`, after checking
 * that no retired alias is set. `undefined` when the variable is unset.
 */
export function waterxConfigUrlFromEnv(
  network: ConfigUrlNetwork,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  assertNoRetiredConfigUrlAliases(env);
  return resolveWaterxConfigUrl(env.WATERX_CONFIG_URL, network);
}

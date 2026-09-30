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
 * full-document form), a non-https value, a GitHub host, an unset value, and
 * any retired alias variable (`E2E_CONFIG_URL`, `PREDICT_CONFIG_URL`) being set.
 *
 * Reference roots: production `https://main-v2.waterx-config.pages.dev`,
 * staging `https://staging-v2.waterx-config.pages.dev`.
 */

import { waterxConfigUrlFromRoot, type WaterxConfigNetwork } from "@waterx/sdk/config";

const EXAMPLE_ROOT = "https://staging-v2.waterx-config.pages.dev";

/**
 * Env names that used to carry the config URL. Setting one now throws, so a
 * deployment that relies on the old name cannot silently lose its override.
 */
const RETIRED_CONFIG_URL_ALIASES = ["E2E_CONFIG_URL", "PREDICT_CONFIG_URL"] as const;

/**
 * The document URL for `network` from `env.WATERX_CONFIG_URL`. Throws, naming
 * the variable, when a retired alias is set, when the value is unset/blank
 * (`loadConfig` has no default, and its own error names the code option rather
 * than the env var), or when the root is invalid (see `waterxConfigUrlFromRoot`).
 */
export function waterxConfigUrlFromEnv(
  network: WaterxConfigNetwork,
  env: Record<string, string | undefined> = process.env,
): string {
  const retired = RETIRED_CONFIG_URL_ALIASES.filter((name) => env[name]?.trim());
  if (retired.length > 0) {
    throw new Error(
      `${retired.join(", ")} ${retired.length === 1 ? "is" : "are"} retired. Unset ` +
        `${retired.length === 1 ? "it" : "them"} and set WATERX_CONFIG_URL to the config CDN ROOT ` +
        `instead (e.g. ${EXAMPLE_ROOT}); /<network>.json is appended.`,
    );
  }
  const value = env.WATERX_CONFIG_URL?.trim();
  if (!value) {
    throw new Error(
      `WATERX_CONFIG_URL is unset. Set it to a waterx-config CDN ROOT (e.g. ${EXAMPLE_ROOT}); ` +
        `/<network>.json is appended.`,
    );
  }
  try {
    return waterxConfigUrlFromRoot(value, network);
  } catch (err) {
    throw new Error(`WATERX_CONFIG_URL: ${(err as Error).message}`, { cause: err });
  }
}

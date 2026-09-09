/**
 * `WATERX_CONFIG_URL` → a concrete `waterx-config` document URL.
 *
 * THE env-boundary convention, shared by every harness (scripts, e2e/integration
 * helpers, examples): **`WATERX_CONFIG_URL` is a CDN base root, without a file
 * name**, and the consumer composes `${base}/${network}.json`. Keeping the
 * network out of the env var is what lets one exported value drive both
 * networks — `run-e2e.ts --mainnet` no longer has to rewrite the string, and a
 * mainnet script can never silently load a testnet document because the value
 * happened to end in `testnet.json`.
 *
 * The SDK itself is unaffected and still knows nothing about env: `loadConfig`
 * takes a COMPLETE URL via the `waterxConfigUrl` opt. Composing it is this
 * boundary's job, which is exactly why this module lives outside `src/`.
 *
 * TRANSITIONAL COMPATIBILITY: a value ending in `.json` is read as a complete
 * legacy file URL and used as-is (still swapping `testnet.json` ↔
 * `mainnet.json` when the requested network disagrees, as it always has),
 * emitting a one-time deprecation warning. That keeps an already-exported
 * `.env.local`, or a repo variable set in the old shape, working while the
 * bases roll out. Remove the compat arm once no environment sets a file URL.
 *
 * Reference bases: production `https://config.waterx.app`, v2 staging
 * `https://staging-v2.waterx-config.pages.dev`. Never
 * `raw.githubusercontent.com` — it rate-limits (429) and the config repo
 * forbids it.
 */

export type ConfigUrlNetwork = "testnet" | "mainnet" | "TESTNET" | "MAINNET";

/** True when `raw` is a legacy complete-file URL rather than a base root. */
function isLegacyConfigFileUrl(raw: string): boolean {
  // Compare against the PATH only: a base carrying `?ref=…` must not be
  // mistaken for a file, and a file URL with a query must still be recognized.
  const path = raw.split(/[?#]/, 1)[0] ?? raw;
  return /\.json$/i.test(path);
}

let warnedLegacyFileUrl = false;

/** One-time deprecation notice for a file-shaped `WATERX_CONFIG_URL`. */
function warnLegacyFileUrlOnce(raw: string): void {
  if (warnedLegacyFileUrl) return;
  warnedLegacyFileUrl = true;
  console.warn(
    `[waterx] WATERX_CONFIG_URL is a complete file URL (${raw}). It is now expected to be a ` +
      `CDN BASE root — e.g. https://config.waterx.app — and the harness appends ` +
      `/<network>.json. The file form still works for now and will stop being read.`,
  );
}

/**
 * Resolve `raw` (a `WATERX_CONFIG_URL`-shaped value) to the document URL for
 * `network`. Returns `undefined` for an unset/blank value, so a caller can
 * pass it straight through to `waterxConfigUrl` and let client creation throw
 * its own "no config URL" error.
 */
export function resolveWaterxConfigUrl(
  raw: string | undefined,
  network: ConfigUrlNetwork,
): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  const net = network.toLowerCase() as "testnet" | "mainnet";

  if (isLegacyConfigFileUrl(value)) {
    warnLegacyFileUrlOnce(value);
    // Preserve the long-standing swap so a legacy value still follows the
    // caller's network rather than the one baked into the string.
    const other = net === "mainnet" ? "testnet" : "mainnet";
    return value.replace(new RegExp(`/${other}\\.json$`, "i"), `/${net}.json`);
  }

  return `${value.replace(/\/+$/, "")}/${net}.json`;
}

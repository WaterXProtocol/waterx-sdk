/**
 * `waterx-config` CDN ROOT → the document URL for one network.
 *
 * The fleet-wide `WATERX_CONFIG_URL` standard: the value is a CDN ROOT
 * (`https://<host>`, no file name) and the consumer composes
 * `${root}/${network}.json`. Reference roots: production
 * `https://main-v2.waterx-config.pages.dev`, staging
 * `https://staging-v2.waterx-config.pages.dev`.
 *
 * This is a pure helper for code that holds such a root, typically read from
 * `WATERX_CONFIG_URL`. The SDK itself still reads no env: `loadConfig` and
 * `create()` take a COMPLETE document URL via `waterxConfigUrl`, e.g.
 * `waterxConfigUrl: waterxConfigUrlFromRoot(process.env.WATERX_CONFIG_URL!, "TESTNET")`.
 */

import type { Network } from "./constants.ts";

/** The network argument: the SDK's `Network`, or its lowercase document name. */
export type WaterxConfigNetwork = Network | "mainnet" | "testnet";

const EXAMPLE_ROOT = "https://staging-v2.waterx-config.pages.dev";

function fail(detail: string): never {
  throw new Error(`waterxConfigUrlFromRoot: ${detail}`);
}

function isGithubHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "github.com" ||
    h.endsWith(".github.com") ||
    h === "githubusercontent.com" ||
    h.endsWith(".githubusercontent.com")
  );
}

/**
 * Compose the `waterx-config` document URL `${root}/${network}.json`.
 *
 * `root` is trimmed and its trailing slashes are stripped. It is REJECTED,
 * with an error that names the fix, when it is:
 * - not a URL, or not `https:`;
 * - a GitHub host (`github.com`, `*.githubusercontent.com`), which rate-limits
 *   and is not a supported config origin;
 * - a path ending in `.json`: that is the retired full-document form, and it
 *   is never rewritten;
 * - carrying a query string or fragment, which the composed path would break.
 *
 * @example waterxConfigUrlFromRoot("https://staging-v2.waterx-config.pages.dev/", "TESTNET")
 *   // → "https://staging-v2.waterx-config.pages.dev/testnet.json"
 */
export function waterxConfigUrlFromRoot(root: string, network: WaterxConfigNetwork): string {
  const net = String(network).toLowerCase();
  if (net !== "mainnet" && net !== "testnet") {
    fail(`unknown network ${JSON.stringify(network)} (expected MAINNET or TESTNET)`);
  }
  const value = String(root ?? "").trim();
  if (!value) fail(`empty config root. Set it to a CDN root such as ${EXAMPLE_ROOT}`);

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    fail(`${JSON.stringify(value)} is not a URL. Set it to a CDN root such as ${EXAMPLE_ROOT}`);
  }
  if (url.protocol !== "https:") {
    fail(`${value} must use https (got ${url.protocol}). Use a CDN root such as ${EXAMPLE_ROOT}`);
  }
  if (isGithubHost(url.hostname)) {
    fail(
      `${value} is a GitHub host, which is not a supported config origin (it rate-limits). ` +
        `Use a CDN root such as ${EXAMPLE_ROOT}`,
    );
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (/\.json$/i.test(path)) {
    fail(
      `${value} is a full document URL (the old format). Set the CDN ROOT instead, without ` +
        `the file name (e.g. ${url.origin}); /${net}.json is appended for you`,
    );
  }
  if (url.search || url.hash) {
    fail(
      `${value} carries a query string or fragment. Set a bare CDN root such as ${EXAMPLE_ROOT}`,
    );
  }
  return `${url.origin}${path}/${net}.json`;
}

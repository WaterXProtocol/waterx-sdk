/**
 * Build a `WaterXClient` for the smoke scripts, honoring two env vars so CI /
 * local dev can pin the canonical `waterx-config` JSON to a specific commit
 * (or branch, tag, or fork) without editing each script:
 *
 *   WATERX_CONFIG_URL   full URL override; wins over WATERX_CONFIG_REF.
 *   WATERX_CONFIG_REF   git ref on WaterXProtocol/waterx-config (commit SHA,
 *                       branch, or tag). Default: `main`.
 *
 * Logs the resolved source on first call so CI logs make the active config
 * obvious. Use this everywhere instead of `WaterXClient.create("TESTNET", …)`
 * inside `scripts/`.
 */
import { WaterXClient, type CreateClientOptions } from "../src/client.ts";
import { defaultConfigUrl } from "../src/config.ts";
import type { Network } from "../src/constants.ts";

let logged = false;

export async function makeSmokeClient(
  network: Network = "TESTNET",
  opts: CreateClientOptions = {},
): Promise<WaterXClient> {
  const envUrl = process.env.WATERX_CONFIG_URL?.trim() || undefined;
  const envRef = process.env.WATERX_CONFIG_REF?.trim() || undefined;

  const merged: CreateClientOptions = {
    cache: true,
    ...opts,
    configUrl: opts.configUrl ?? envUrl,
    configRef: opts.configRef ?? envRef,
  };

  if (!logged) {
    const effective = merged.configUrl ?? defaultConfigUrl(network, merged.configRef);
    const refLabel = merged.configUrl
      ? "(WATERX_CONFIG_URL)"
      : merged.configRef
        ? `(ref=${merged.configRef})`
        : "(default main)";
    console.log(`[smoke] waterx-config source: ${effective} ${refLabel}`);
    logged = true;
  }

  return WaterXClient.create(network, merged);
}

/**
 * The `PerpClient` every testnet script builds: cached, with its config URL
 * composed from the `WATERX_CONFIG_URL` root (see `./waterx-config-url.ts`).
 */
import { PerpClient } from "../src/perp/client.ts";
import { waterxConfigUrlFromEnv } from "./waterx-config-url.ts";

export function createTestnetScriptClient(): Promise<PerpClient> {
  return PerpClient.create("TESTNET", {
    cache: true,
    waterxConfigUrl: waterxConfigUrlFromEnv("TESTNET"),
  });
}

/**
 * Integration (sign + execute) WaterX client — same config source as simulate e2e, optional gRPC override.
 *
 * Network: {@link resolveIntegrationNetwork} → `WaterXClient.create(TESTNET | MAINNET)`.
 */
import { WaterXClient } from "../../../../src/client.ts";
import type { Network } from "../../../../src/constants.ts";
import {
  resolveE2eGrpcUrlOverride,
  resolveE2eNetwork,
  wrapGrpcClientForE2eRetry,
  type E2eNetwork,
} from "./e2e-client.ts";

export function resolveIntegrationNetwork(): E2eNetwork {
  const n = process.env.WATERX_INTEGRATION_NETWORK?.trim().toLowerCase();
  if (n === "testnet" || n === "mainnet") return n;
  return resolveE2eNetwork();
}

export function integrationNetworkToClientKey(network: E2eNetwork): Network {
  return network === "mainnet" ? "MAINNET" : "TESTNET";
}

export async function createIntegrationWaterXClient(): Promise<WaterXClient> {
  const grpcUrl = resolveE2eGrpcUrlOverride();
  const c = await WaterXClient.create(integrationNetworkToClientKey(resolveIntegrationNetwork()), {
    cache: true,
    ...(grpcUrl ? { grpcUrl } : {}),
  });
  c.grpcClient = wrapGrpcClientForE2eRetry(c.grpcClient);
  return c;
}

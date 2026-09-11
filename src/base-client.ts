/**
 * Shared transport base for the two product-line clients (`PerpClient`,
 * `PredictClient`).
 *
 * Holds the half that is identical across both lines: the gRPC client
 * construction (network + URL resolution), the read-only gRPC convenience
 * wrappers, `simulate` / `signAndExecuteTransaction`, and the `packageIds()`
 * lookup. The config-schema half (per-line typed lookups like `getMarket` /
 * `marketRegistry`) legitimately differs and lives on each subclass.
 *
 * Both lines read the SAME parsed `waterx-config` document — one consolidated
 * document carries every package. `Cfg` defaults to {@link WaterXConfig}, what
 * the LOADER establishes; each line narrows it to the document its own
 * construction additionally asserts (`PerpLineConfig` / `PredictionLineConfig`),
 * so `client.config` exposes exactly the packages that client guarantees.
 */

import type { SuiClientTypes } from "@mysten/sui/client";
import type { Signer } from "@mysten/sui/cryptography";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import type { Transaction } from "@mysten/sui/transactions";

import type { WaterXConfig } from "./config.ts";
import type { Network } from "./constants.ts";

/** Default Sui gRPC base URLs by network (public Mysten fullnodes). */
export const DEFAULT_GRPC_URLS: Record<Network, string> = {
  MAINNET: "https://fullnode.mainnet.sui.io:443",
  TESTNET: "https://fullnode.testnet.sui.io:443",
};

export abstract class BaseLineClient<Cfg extends WaterXConfig = WaterXConfig> {
  /** gRPC client — all RPC including `simulateTransaction`. */
  grpcClient: SuiGrpcClient;
  /** Network identifier in upper case (`MAINNET` / `TESTNET`). */
  network: Network;
  /** The parsed canonical `waterx-config` document (see `src/config.ts`). */
  config: Cfg;

  protected constructor(network: Network, config: Cfg, opts: { grpcUrl?: string } = {}) {
    this.network = network;
    this.config = config;
    this.grpcClient = new SuiGrpcClient({
      baseUrl: opts.grpcUrl ?? DEFAULT_GRPC_URLS[network],
      network: network.toLowerCase() as "mainnet" | "testnet",
    });
  }

  // ========================================================
  // gRPC convenience wrappers
  // ========================================================

  getObject(objectId: string) {
    return this.grpcClient.getObject({ objectId });
  }

  getObjects(objectIds: string[]) {
    return this.grpcClient.getObjects({ objectIds });
  }

  listOwnedObjects(owner: string) {
    return this.grpcClient.listOwnedObjects({ owner });
  }

  listCoins(params: { owner: string; coinType?: string }) {
    return this.grpcClient.listCoins(params);
  }

  getBalance(params: { owner: string; coinType?: string }) {
    return this.grpcClient.getBalance(params);
  }

  listDynamicFields(parentId: string): ReturnType<SuiGrpcClient["listDynamicFields"]> {
    return this.grpcClient.listDynamicFields({ parentId });
  }

  getDynamicField(parentId: string, name: { type: string; bcs: Uint8Array }) {
    return this.grpcClient.getDynamicField({ parentId, name });
  }

  waitForTransaction(digest: string) {
    return this.grpcClient.waitForTransaction({ digest });
  }

  /**
   * Simulate a transaction (no signing). Subclasses may override to add
   * transport policy (e.g. the prediction line wraps this with rate-limit
   * retry against the public testnet RPC).
   */
  async simulate(tx: Transaction) {
    return this.grpcClient.simulateTransaction({
      transaction: tx,
      include: { commandResults: true },
    });
  }

  async signAndExecuteTransaction<
    Include extends SuiClientTypes.TransactionInclude = object,
  >(params: {
    signer: { toSuiAddress: () => string } & Signer;
    transaction: Transaction | Uint8Array;
    additionalSignatures?: string[];
    include?: Include & SuiClientTypes.TransactionInclude;
  }) {
    return this.grpcClient.signAndExecuteTransaction(params);
  }

  // ========================================================
  // Shared config lookup
  // ========================================================

  /** All package IDs (`published_at`) keyed by package name. */
  packageIds(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(this.config.packages).map(([name, pkg]) => [name, pkg.published_at]),
    );
  }
}

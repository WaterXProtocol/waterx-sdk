/**
 * Unified WaterX SDK client.
 *
 * Wraps the two product-line clients (`WaterXClient` for perp, `PredictClient`
 * for prediction) behind a single object with namespaced modules, so the
 * colliding builder names (`placeOrder`, `createAccount`, `deposit`, …) can be
 * called unambiguously:
 *
 *   const client = await Client.create({ network: "TESTNET" });
 *   client.perp.openPosition(tx, params);     // -> perp builder
 *   client.predict.placeOrder(tx, params);    // -> prediction builder
 *
 * The modules are thin: each method forwards to the existing free-function
 * builder with the line's client pre-bound as the first argument. Builders are
 * build-only (they return / mutate a `Transaction`); signing & execution stay
 * with the caller (`client.perpClient` / `client.predictClient`, or a wallet),
 * so frontend wallet flows and multi-step Pyth injection keep working.
 */

import { WaterXClient, type CreateClientOptions as PerpCreateOptions } from "./client.ts";
import type { Network } from "./constants.ts";
// Perp builder/view modules (every export takes the client as its first arg).
import * as perpFetch from "./fetch.ts";
// Prediction builder/view modules (every export takes the client as its first arg).
import * as predAccount from "./prediction/account.ts";
import * as predAdmin from "./prediction/admin.ts";
import {
  PredictClient,
  type CreateClientOptions as PredictCreateOptions,
} from "./prediction/client.ts";
import * as predFetch from "./prediction/fetch.ts";
import * as predOps from "./prediction/prediction.ts";
import * as perpTx from "./tx-builders.ts";
import * as perpUser from "./user/index.ts";

/**
 * Map a namespace of `(client, ...args) => R` free functions to the same
 * surface with the client pre-bound: `(...args) => R`. Non-function exports
 * (and functions whose first arg is not the client) pass through unchanged.
 */
type ClientBound<NS, C> = {
  [K in keyof NS]: NS[K] extends (client: C, ...args: infer A) => infer R
    ? (...args: A) => R
    : NS[K];
};

function bindClient<C, NS extends object>(client: C, ns: NS): ClientBound<NS, C> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(ns)) {
    const value = (ns as Record<string, unknown>)[key];
    out[key] =
      typeof value === "function"
        ? (...args: unknown[]) => (value as (...a: unknown[]) => unknown)(client, ...args)
        : value;
  }
  return out as ClientBound<NS, C>;
}

// Frozen, reused for both the runtime binding and the public module types.
const perpOps = { ...perpUser, ...perpTx, ...perpFetch };
const predictOps = { ...predAccount, ...predAdmin, ...predOps, ...predFetch };

/** Perp namespace exposed as `client.perp` — builder/view methods, client pre-bound. */
export type PerpModule = ClientBound<typeof perpOps, WaterXClient>;
/** Prediction namespace exposed as `client.predict` — builder/view methods, client pre-bound. */
export type PredictModule = ClientBound<typeof predictOps, PredictClient>;

/** Per-line network/config override. Falls back to the shared top-level options. */
type PerpLineOptions = Partial<PerpCreateOptions> & { network?: Network };
type PredictLineOptions = Partial<PredictCreateOptions> & { network?: Network };

export interface ClientCreateOptions {
  /** Default network for both lines (per-line `network` overrides). Default: `"TESTNET"`. */
  network?: Network;
  /** Default gRPC URL for both lines. */
  grpcUrl?: string;
  /** Default `waterx-config` JSON URL for both lines. */
  configUrl?: string;
  /** Memoize the fetched config JSON. */
  cache?: boolean;
  /** Perp-line overrides (network, grpcUrl, configUrl, cache, …). */
  perp?: PerpLineOptions;
  /** Prediction-line overrides (network, grpcUrl, configUrl, cache, settlement, …). */
  predict?: PredictLineOptions;
}

export class Client {
  /** Underlying perp client — use for signing/executing perp transactions. */
  readonly perpClient: WaterXClient;
  /** Underlying prediction client — use for signing/executing prediction transactions. */
  readonly predictClient: PredictClient;
  /** Perp builders & views (`client.perp.openPosition(tx, params)`). */
  readonly perp: PerpModule;
  /** Prediction builders & views (`client.predict.placeOrder(tx, params)`). */
  readonly predict: PredictModule;

  private constructor(perpClient: WaterXClient, predictClient: PredictClient) {
    this.perpClient = perpClient;
    this.predictClient = predictClient;
    this.perp = bindClient(perpClient, perpOps);
    this.predict = bindClient(predictClient, predictOps);
  }

  /** Combine two pre-built line clients (advanced — full control over each). */
  static fromClients(perpClient: WaterXClient, predictClient: PredictClient): Client {
    return new Client(perpClient, predictClient);
  }

  /**
   * Async factory — loads each line's deployment config (from the canonical
   * `waterx-config` JSON) and returns a ready client. Each line can target a
   * different network via `opts.perp.network` / `opts.predict.network`.
   */
  static async create(opts: ClientCreateOptions = {}): Promise<Client> {
    const baseNetwork: Network = opts.network ?? "TESTNET";
    const { network: perpNetwork, ...perpRest } = opts.perp ?? {};
    const { network: predictNetwork, ...predictRest } = opts.predict ?? {};

    const perpClient = await WaterXClient.create(perpNetwork ?? baseNetwork, {
      grpcUrl: opts.grpcUrl,
      configUrl: opts.configUrl,
      cache: opts.cache,
      ...perpRest,
    });
    const predictClient = await PredictClient.create(predictNetwork ?? baseNetwork, {
      grpcUrl: opts.grpcUrl,
      configUrl: opts.configUrl,
      cache: opts.cache,
      ...predictRest,
    });
    return new Client(perpClient, predictClient);
  }
}

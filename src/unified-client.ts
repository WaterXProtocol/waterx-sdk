/**
 * Umbrella WaterX SDK client — the main entry point.
 *
 * Exposes three namespaces over the two product-line sub-clients:
 *
 *   const client = await WaterXClient.create({ network: "TESTNET" });
 *   client.account.createAccount(tx, { alias });   // -> shared waterx_account + funding
 *   client.perp.placeOrderRequest(tx, params);     // -> perp builder
 *   client.predict.placeOrder(tx, params);         // -> prediction builder
 *
 * `client.perp` **is** the `PerpClient` instance with the perp builder/view
 * methods grafted on, and `client.predict` **is** the `PredictClient` instance
 * likewise — so signing & execution live on the same object
 * (`client.perp.signAndExecuteTransaction(...)`) right next to the builders.
 * There are no separate `.perpClient` / `.predictClient` accessors.
 *
 * `client.account` is a thin namespace (no own client) bound to the perp
 * sub-client: the perp config carries the shared `waterx_account` registry plus
 * the bridge / native_custody / withdrawal_queue / credit_registry that the
 * credit & custody builders read. `waterx_account` is one shared on-chain object,
 * so an account created here serves both lines — except when the two lines target
 * different networks (`opts.perp.network !== opts.predict.network`), where
 * `client.account` follows the perp line; split-network callers should reach the
 * predict line's generic account builders via the `prediction` namespace directly.
 *
 * Each namespace method forwards to the existing free-function builder with the
 * line's client pre-bound as the first argument; builders are build-only (they
 * return / mutate a `Transaction`), so frontend wallet flows and multi-step Pyth
 * injection keep working.
 */

import { Transaction } from "@mysten/sui/transactions";

// Unified account namespace: generic waterx_account framework + funding (credit + custody).
import * as accountOps from "./account/index.ts";
import * as perpReferral from "./account/referral.ts";
import type { Network } from "./constants.ts";
import type { PythGeneration } from "./oracle/config.ts";
import { PerpClient, type CreateClientOptions as PerpCreateOptions } from "./perp/client.ts";
// Perp builder/view modules (every export takes the client as its first arg).
import * as perpFetch from "./perp/fetch.ts";
import * as perpTx from "./perp/tx-builders.ts";
// Perp-only user builders — account/credit/custody are excluded here; they live
// under `client.account`. trading / order / wlp / staking / referral only.
import * as perpOrder from "./perp/user/order.ts";
import * as perpStaking from "./perp/user/staking.ts";
import * as perpTrading from "./perp/user/trading.ts";
import * as perpWlp from "./perp/user/wlp.ts";
// Prediction-specific account ops (need the prediction package; NOT generic account).
import {
  allowPredictionProtocolAsset,
  disallowPredictionProtocolAsset,
  setDelegatePredictionPermission,
  whitelistPredictionProtocol,
} from "./prediction/account.ts";
import * as predAdmin from "./prediction/admin.ts";
import {
  PredictClient,
  type CreateClientOptions as PredictCreateOptions,
} from "./prediction/client.ts";
import * as predFetch from "./prediction/fetch.ts";
import * as predGift from "./prediction/gift.ts";
import * as predOps from "./prediction/prediction.ts";
import {
  buildBatchClaimTx as buildPredictBatchClaimTx,
  buildPlaceOrderTx as buildPredictPlaceOrderTx,
  type BuildBatchClaimTxParams,
  type BuildPlaceOrderTxParams,
} from "./prediction/tx-builders.ts";

/**
 * Exports from the spread builder/view modules that are NOT client-first — their
 * first argument is not the line client, so they must not become bound facade
 * methods (binding would pass the client where a value is expected). This is the
 * single source of truth shared by the runtime (skip) and the type (`Omit`).
 * Keep in sync by auditing `export function` first-params across the spread modules.
 */
const NON_CLIENT_FIRST = [
  "extractReturnBytes",
  // gift.ts — pure crypto / URL helpers (first arg is not PredictClient)
  "base64UrlNoPadEncode",
  "base64UrlNoPadDecode",
  "generateGiftSeed",
  "encodeGiftUrl",
  "parseGiftUrl",
  "deriveGiftKeypair",
  "buildGiftClaimMessage",
  "signGiftClaim",
] as const;
type NonClientFirstKey = (typeof NON_CLIENT_FIRST)[number];
const NON_CLIENT_FIRST_SET: ReadonlySet<string> = new Set(NON_CLIENT_FIRST);

/**
 * Map a namespace of `(client, ...args) => R` free functions to the same surface
 * with the client pre-bound: `(...args) => R`. Non-client-first helpers (see
 * `NON_CLIENT_FIRST`) are dropped, so the static type and the runtime agree.
 */
type ClientBound<NS, C> = {
  [K in keyof Omit<NS, NonClientFirstKey>]: NS[K] extends (client: C, ...args: infer A) => infer R
    ? (...args: A) => R
    : NS[K];
};

function bindClient<C, NS extends object>(client: C, ns: NS): ClientBound<NS, C> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(ns)) {
    if (NON_CLIENT_FIRST_SET.has(key)) continue; // not client-first → not a facade method
    const value = (ns as Record<string, unknown>)[key];
    out[key] =
      typeof value === "function"
        ? (...args: unknown[]) => (value as (...a: unknown[]) => unknown)(client, ...args)
        : value;
  }
  return out as ClientBound<NS, C>;
}

// Prediction-specific account ops kept on `client.predict` (generic account ops
// moved to `client.account`).
const predAccountSpecific = {
  setDelegatePredictionPermission,
  whitelistPredictionProtocol,
  allowPredictionProtocolAsset,
  disallowPredictionProtocolAsset,
};

// Frozen, reused for both the runtime binding and the public module types.
const perpOps = {
  ...perpTrading,
  ...perpOrder,
  ...perpWlp,
  ...perpStaking,
  ...perpReferral,
  ...perpTx,
  ...perpFetch,
};
const predictOps = { ...predAccountSpecific, ...predAdmin, ...predOps, ...predFetch, ...predGift };

/** Account namespace exposed as `client.account` — generic wxa + credit + custody, perp-backed. */
export type AccountModule = ClientBound<typeof accountOps, PerpClient>;
/** Perp namespace exposed as `client.perp` — builder/view methods, client pre-bound. */
export type PerpModule = ClientBound<typeof perpOps, PerpClient>;
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
  /** Default `waterx-config` JSON URL for both lines (fetched as-is). Required
   *  unless supplied per-line via `perp` / `predict`. */
  waterxConfigUrl?: string;
  /** Memoize the fetched config JSON. */
  cache?: boolean;
  /**
   * Selects which `PriceUpdateRule` the perp line's `refreshOraclePrices` uses
  /**
   * Selects which Pyth Core contract generation feeds the perp line's
   * `client.perp.pyth` when the config JSON has no explicit `pyth` override:
   * `'core'` (default) or `'pro'` (post-2026-08-18 Pro-compatible contracts +
   * Hermes-compatible endpoint; pair with `pyth.api_key`). Perp-line only.
   * See `PythGeneration` / `PYTH_PRO_DEFAULTS`.
   */
  pythGeneration?: PythGeneration;
  /** Perp-line overrides (network, grpcUrl, waterxConfigUrl, cache, …). */
  perp?: PerpLineOptions;
  /** Prediction-line overrides (network, grpcUrl, waterxConfigUrl, cache, settlement, …). */
  predict?: PredictLineOptions;
}

export class WaterXClient {
  /** Shared account namespace (`client.account.createAccount(tx, params)`) — perp-backed. */
  readonly account: AccountModule;
  /**
   * Perp sub-client **with** the perp builders/views grafted on
   * (`client.perp.placeOrderRequest(...)`, `client.perp.signAndExecuteTransaction(...)`).
   */
  readonly perp: PerpClient & PerpModule;
  /**
   * Prediction sub-client **with** the prediction builders/views grafted on
   * (`client.predict.placeOrder(...)`, `client.predict.signAndExecuteTransaction(...)`).
   */
  readonly predict: PredictClient & PredictModule;

  /**
   * Async prediction builder: optional consolidate + `placeOrder`.
   * Uses the perp client for the sweep and the predict client for the bet leg.
   */
  buildPredictPlaceOrderTx(params: BuildPlaceOrderTxParams): Promise<Transaction> {
    return buildPredictPlaceOrderTx(this.perp, this.predict, params);
  }

  /**
   * Async prediction builder: optional consolidate + `batchClaim`.
   */
  buildPredictBatchClaimTx(params: BuildBatchClaimTxParams): Promise<Transaction> {
    return buildPredictBatchClaimTx(this.perp, this.predict, params);
  }

  private constructor(perpClient: PerpClient, predictClient: PredictClient) {
    // Graft the bound builders onto the sub-client instances. No builder name
    // collides with the client's own (transport/config) methods — enforced by the
    // "graft guard" unit test (disjoint from the prototype chain), not just a
    // comment. The instances stay `instanceof PerpClient` / `PredictClient`, so
    // signing/config methods work.
    this.perp = Object.assign(perpClient, bindClient(perpClient, perpOps)) as PerpClient &
      PerpModule;
    this.predict = Object.assign(
      predictClient,
      bindClient(predictClient, predictOps),
    ) as PredictClient & PredictModule;
    this.account = bindClient(perpClient, accountOps);
  }

  /**
   * Combine two pre-built line clients (advanced — full control over each).
   * Note: this grafts the bound builder methods onto the provided client
   * instances in place.
   */
  static fromClients(perpClient: PerpClient, predictClient: PredictClient): WaterXClient {
    return new WaterXClient(perpClient, predictClient);
  }

  /**
   * Async factory — loads each line's deployment config (from the canonical
   * `waterx-config` JSON) and returns a ready client. Each line can target a
   * different network via `opts.perp.network` / `opts.predict.network`.
   */
  static async create(opts: ClientCreateOptions = {}): Promise<WaterXClient> {
    const baseNetwork: Network = opts.network ?? "TESTNET";
    const { network: perpNetwork, ...perpRest } = opts.perp ?? {};
    const { network: predictNetwork, ...predictRest } = opts.predict ?? {};

    const resolvedPerpNetwork = perpNetwork ?? baseNetwork;
    const resolvedPredictNetwork = predictNetwork ?? baseNetwork;
    if (resolvedPerpNetwork !== resolvedPredictNetwork) {
      // `client.account` always follows the perp line (see the class header).
      // On a split-network setup a caller reaching for `client.account.*` would
      // silently build against the perp deployment — warn so it isn't a surprise.
      console.warn(
        `[WaterXClient] split-network: perp=${resolvedPerpNetwork} predict=${resolvedPredictNetwork}. ` +
          `client.account follows the perp line (${resolvedPerpNetwork}); reach the predict line's ` +
          `generic account builders via the prediction namespace directly.`,
      );
    }

    const perpClient = await PerpClient.create(resolvedPerpNetwork, {
      grpcUrl: opts.grpcUrl,
      waterxConfigUrl: opts.waterxConfigUrl,
      cache: opts.cache,
      pythGeneration: opts.pythGeneration,
      ...perpRest,
    });
    const predictClient = await PredictClient.create(resolvedPredictNetwork, {
      grpcUrl: opts.grpcUrl,
      waterxConfigUrl: opts.waterxConfigUrl,
      cache: opts.cache,
      ...predictRest,
    });
    return new WaterXClient(perpClient, predictClient);
  }
}

/**
 * `AccountClientLike` — the narrow capability slice the account/funding builders
 * read, instead of the concrete `PerpClient`.
 *
 * The account framework + funding (credit / custody / bridge / consolidate) is
 * the contract's **base** layer: both product lines depend down onto it. Typing
 * these builders to `PerpClient` inverted that — so they take this structural
 * interface instead. `PerpClient` satisfies it without an `implements` clause
 * (it `extends BaseLineClient<WaterXConfig>` and carries the config-view slice +
 * the `wormhole` infra block); a future funding-capable client can too.
 *
 * The config schema it reads lives in `account/config.ts` (the base layer), so
 * this file imports **nothing** from `perp/` — `account/` no longer depends on the
 * perp line even at the type level. `PerpClient`'s `WaterXConfig` is assignable to
 * the narrower `AccountConfig` (`WaterXPackages extends AccountPackages`).
 */

import type { BaseLineClient } from "../base-client.ts";
import type {
  AccountConfig,
  NativeCustodyAsset,
  WaterxCreditPackage,
  WormholeBridgePackage,
  WormholeInfraConfig,
} from "./config.ts";

export interface AccountClientLike extends BaseLineClient<AccountConfig> {
  /** External Wormhole infra (network default, overridable via config). */
  readonly wormhole: WormholeInfraConfig;

  /** Fully-qualified CREDIT coin Move type; throws if `waterx_credit.credit_type` is unset. */
  creditType(): string;
  /** `waterx_credit` package entry; throws if absent. */
  getCredit(): WaterxCreditPackage;
  /** `wormhole_bridge` package entry; throws if absent. */
  getBridge(): WormholeBridgePackage;
  /** Sui Wormhole `State` object id (per-deployment, falls back to `wormhole` infra). */
  wormholeStateId(): string;
  /** All native-custody backing-asset rows; throws if no custody vault. */
  getNativeAssets(): readonly NativeCustodyAsset[];
  /** A native-custody asset row by its fully-qualified Move type; throws if unknown. */
  getNativeAsset(moveType: string): NativeCustodyAsset;
}

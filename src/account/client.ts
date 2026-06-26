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
 * Note: this still type-imports the config *schema* from `perp/config.ts` (the
 * same pattern `OracleHost` uses). Hoisting that schema into `account/config.ts`
 * is the remaining step, tracked with the codegen unification; it is type-only
 * and acyclic (`perp/config.ts` imports nothing from `account/`).
 */

import type { BaseLineClient } from "../base-client.ts";
import type {
  NativeCustodyAsset,
  WaterXConfig,
  WaterxCreditPackage,
  WormholeBridgePackage,
  WormholeInfraConfig,
} from "../perp/config.ts";

export interface AccountClientLike extends BaseLineClient<WaterXConfig> {
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

/**
 * `AccountClientLike` — the narrow capability slice the account/funding builders
 * read, instead of the concrete `PerpClient`.
 *
 * The account framework + funding (credit / custody / bridge / consolidate) is
 * the contract's **base** layer: both product lines depend down onto it. Typing
 * these builders to `PerpClient` inverted that — so they take this structural
 * interface instead. `PerpClient` satisfies it without an `implements` clause
 * (it `extends BaseLineClient` and carries the two derived lookups + the
 * `wormhole` infra block); a future funding-capable client can too.
 *
 * Both lines share ONE config shape (the parsed `waterx-config` document, see
 * `src/config.ts`), so the generic wxa builders are typed to the base client
 * itself — this file imports **nothing** from `perp/`.
 */

import type { BaseLineClient } from "../base-client.ts";
import type { NativeCustodyAsset } from "../config.ts";
import type { WormholeInfraConfig } from "./config.ts";

/**
 * The slice the **generic wxa builders** (create account / delegates / alias /
 * deposit-request / referral) read — the shared config + transport. Both
 * `PerpClient` and `PredictClient` are one, so these builders serve both lines.
 * The funding-capable {@link AccountClientLike} is a superset.
 */
export type WxaClientLike = BaseLineClient;

export interface AccountClientLike extends BaseLineClient {
  /** External Wormhole infra for the network (`WORMHOLE_DEFAULTS`). */
  readonly wormhole: WormholeInfraConfig;

  /** Fully-qualified CREDIT coin Move type (`objects.credit.credit_type`). */
  creditType(): string;
  /** A native-custody backing-asset row by its fully-qualified Move type; throws if unknown. */
  getNativeAsset(moveType: string): NativeCustodyAsset;
}

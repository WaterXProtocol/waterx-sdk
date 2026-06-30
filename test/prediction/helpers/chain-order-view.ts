/**
 * `getChainOrderView` is now a thin alias of `getOrder`. It used to keep its own
 * hand-written `OrderView` BCS struct so test/seed code could decode on-chain
 * fields (e.g. `receiver_account_id`) before they were mirrored into the SDK
 * schema. The SDK now decodes with the codegen schema directly (no hand-written
 * mirror), so that workaround is gone — this just delegates. Kept because seed /
 * e2e / discovery tooling imports it; new code should call `getOrder`.
 */
import type { PredictClient } from "~predict/client.ts";
import { getOrder, type ViewBaseParams } from "~predict/fetch.ts";
import type { OrderView } from "~predict/types.ts";

export async function getChainOrderView(
  client: PredictClient,
  params: ViewBaseParams & { orderId: bigint | number | string },
): Promise<OrderView> {
  return getOrder(client, params);
}

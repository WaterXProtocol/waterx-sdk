/**
 * Test-only `view::order` simulate decode when on-chain `OrderView` includes fields
 * not yet in the published SDK BCS schema (e.g. `receiver_account_id`). E2E discovery
 * and seed scripts import this instead of `getOrder` so PRs can land test fixes without
 * touching `src/prediction/bcs.ts`.
 */
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { mapOrderView, OrderKindBcs, SelectionBcs } from "~predict/bcs.ts";
import type { PredictClient } from "~predict/client.ts";
import { extractReturnBytes, type ViewBaseParams } from "~predict/fetch.ts";
import type { OrderView } from "~predict/types.ts";
import {
  resolveMarketRegistry,
  resolvePackageId,
  resolveSettlementCoinType,
  toBigInt,
} from "~predict/utils.ts";

const ChainOrderViewBcs = bcs.struct("OrderView", {
  order_id: bcs.u64(),
  kind: OrderKindBcs,
  account_id: bcs.Address,
  receiver_account_id: bcs.Address,
  market_id: bcs.vector(bcs.u8()),
  selection: SelectionBcs,
  position_id: bcs.option(bcs.u64()),
  max_spend: bcs.u64(),
  min_shares: bcs.u64(),
  price_cap: bcs.u64(),
  min_proceeds: bcs.u64(),
  expiry_ts: bcs.u64(),
  self_cancel_after_ts: bcs.u64(),
  created_ts: bcs.u64(),
  by_admin: bcs.bool(),
});

export async function getChainOrderView(
  client: PredictClient,
  params: ViewBaseParams & { orderId: bigint | number | string },
): Promise<OrderView> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::order`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.u64(toBigInt(params.orderId)),
    ],
  });
  const result = await client.simulate(tx);
  return mapOrderView(ChainOrderViewBcs.parse(extractReturnBytes(result)));
}

import { PredictClient } from "../../../src/prediction/client.ts";
import {
  getAccountOrderIds,
  getMarketById,
  getOrderCursor,
} from "../../../src/prediction/fetch.ts";
import { getChainOrderView } from "../helpers/chain-order-view.ts";

const accountId = "0x602bce5950460623ab406feed9e668196c2177c5dc97a781853a6589b2c3f471";

async function main(): Promise<void> {
  const client = await PredictClient.create("TESTNET");
  const cursor = await getOrderCursor(client);
  console.log("cursor", {
    count: cursor.count.toString(),
    front: cursor.front?.toString(),
    back: cursor.back?.toString(),
  });

  const hex = "707265642d6532652d6f70656e2d7631";
  const marketId = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const m = await getMarketById(client, { marketId });
  console.log("marketKey", m.marketKey.toString());

  try {
    const ids = await getAccountOrderIds(client, { accountId, marketKey: m.marketKey });
    console.log("account order ids", ids.map(String));
  } catch (e) {
    console.log("getAccountOrderIds err", e);
  }

  const probe = [1067n, cursor.back, cursor.front].filter((id): id is bigint => id != null);
  for (const id of probe) {
    try {
      const o = await getChainOrderView(client, { orderId: id });
      console.log("order", id.toString(), o.kind, o.accountId);
    } catch (e) {
      console.log("order", id.toString(), "ERR", String(e).slice(0, 200));
    }
  }
}

main().catch(console.error);

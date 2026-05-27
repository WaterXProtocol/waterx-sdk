/**
 * `transferToAccount({ accountId, coin, coinType })` — push a coin
 * directly into a wxa account's framework balance. Cheaper than
 * `requestDeposit` when you don't need policy hooks; use for subaccount
 * funding or admin-side credits.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_AMOUNT=1000000 \
 *     pnpm exec tsx examples/actions/action-transfer-to-account.ts
 */
import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { transferToAccount } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair, address } = loadActiveKeypair();
  const amount = BigInt(process.env.WATERX_AMOUNT ?? "1000000");
  const usdcType = client.creditType();

  const coins = (await client.grpcClient.listCoins({ owner: address, coinType: usdcType })) as {
    objects?: { objectId?: string; balance?: string }[];
  };
  const top = (coins.objects ?? [])
    .map((c) => ({ id: c.objectId!, bal: BigInt(c.balance ?? "0") }))
    .sort((a, b) => (b.bal > a.bal ? 1 : -1))[0];
  if (!top || top.bal < amount) throw new Error(`no ${usdcType} coin with ≥${amount} balance`);

  const tx = new Transaction();
  const [chunk] = tx.splitCoins(tx.object(top.id), [tx.pure.u64(amount)]);
  transferToAccount(client, tx, {
    accountId: requireEnv("WATERX_ACCOUNT_ID"),
    coin: chunk as unknown as TransactionArgument,
    coinType: usdcType,
  });

  await simThenMaybeExecute(client, tx, "transferToAccount", keypair);
});

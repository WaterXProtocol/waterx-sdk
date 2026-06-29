/**
 * Deposit USDC into a wxa account (`requestDeposit` + `consumeDepositDirect`).
 *
 * The full deposit flow is two move calls in one PTB:
 *   1. `requestDeposit(coin)`  → returns a typed `DepositRequest`
 *   2. `direct_rule::consume_deposit_direct(req)`  → finalizes
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_AMOUNT=50000000 \
 *     pnpm exec tsx examples/actions/action-request-deposit.ts
 */
import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { consumeDepositDirect } from "../../src/generated/waterx_account/direct_rule.ts";
import { requestDeposit } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair, address } = loadActiveKeypair();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const amount = BigInt(process.env.WATERX_AMOUNT ?? "50000000");
  const usdcType = client.creditType();

  // Find a USDC coin to deposit from.
  const coins = (await client.grpcClient.listCoins({ owner: address, coinType: usdcType })) as {
    objects?: { objectId?: string; balance?: string }[];
  };
  const candidates = (coins.objects ?? [])
    .map((c) => ({ id: c.objectId!, bal: BigInt(c.balance ?? "0") }))
    .sort((a, b) => (b.bal > a.bal ? 1 : -1));
  if (candidates.length === 0 || candidates[0]!.bal < amount) {
    throw new Error(`no ${usdcType} coin with ≥${amount} balance on ${address}`);
  }

  const tx = new Transaction();
  const [chunk] = tx.splitCoins(tx.object(candidates[0]!.id), [tx.pure.u64(amount)]);
  const req = requestDeposit(client, tx, {
    accountId,
    coin: chunk as unknown as TransactionArgument,
    coinType: usdcType,
  });
  consumeDepositDirect({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      req: req as unknown as TransactionArgument,
    },
    typeArguments: [usdcType],
  })(tx);

  await simThenMaybeExecute(client, tx, "requestDeposit", keypair);
});

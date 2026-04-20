import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

/** Info about a coin owned by a UserAccount, needed to build receivingRef. */
export interface CoinForReceiving {
  objectId: string;
  version: string | bigint;
  digest: string;
}

/** Builds a `vector<Receiving<Coin<T>>>` argument for Move functions. */
export function buildReceivingVector(
  tx: Transaction,
  coins: CoinForReceiving[],
  coinType: string,
): TransactionArgument {
  const receivingRefs = coins.map((c) =>
    tx.receivingRef({
      objectId: c.objectId,
      version: String(c.version),
      digest: c.digest,
    }),
  );
  return tx.makeMoveVec({
    type: `0x2::transfer::Receiving<0x2::coin::Coin<${coinType}>>`,
    elements: receivingRefs,
  });
}

import { Transaction } from "@mysten/sui/transactions";

import type { PredictClient } from "../../../../src/prediction/client.ts";
import type { PredictModule } from "../../../../src/unified-client.ts";
import type { DualPathTxCase } from "../../../helpers/unified-dual-path.ts";

export type PredictDualPathCase = DualPathTxCase<PredictClient, PredictModule>;

export function caseMutate(
  name: string,
  legacy: (c: PredictClient, tx: Transaction) => void,
  facade: (p: PredictModule, tx: Transaction) => void,
): PredictDualPathCase {
  return {
    name,
    buildLegacy: (c) => {
      const tx = new Transaction();
      legacy(c, tx);
      return tx;
    },
    buildFacade: (p) => {
      const tx = new Transaction();
      facade(p, tx);
      return tx;
    },
  };
}

export function caseFactory(
  name: string,
  legacy: (c: PredictClient) => Transaction,
  facade: (p: PredictModule) => Transaction,
): PredictDualPathCase {
  return { name, buildLegacy: legacy, buildFacade: facade };
}

export function caseArrayFactory(
  name: string,
  legacy: (c: PredictClient) => Transaction[],
  facade: (p: PredictModule) => Transaction[],
): PredictDualPathCase {
  return { name, kind: "array", buildLegacy: legacy, buildFacade: facade };
}

import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "~predict/client.ts";
import { getMarketByKey, getOrder, getPosition, getRegistry } from "~predict/fetch.ts";
import { fillOrder, placeOrder } from "~predict/prediction.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { minimalPlaceOrderParams } from "../fixtures/ptb-params.ts";
import { createE2eClient } from "../helpers/e2e-context.ts";
import { expectSimulateFailure } from "../helpers/simulate.ts";

const U64_MAX = (1n << 64n) - 1n;
const NON_EXISTENT_ORDER_ID = U64_MAX;
/** Valid Sui address shape but not the deployed market registry shared object. */
const WRONG_REGISTRY_ID = "0x0000000000000000000000000000000000000000000000000000000000000001";

function decodeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** RPC may reject before simulate or return FailedTransaction depending on the failure mode. */
async function expectChainReject(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toSatisfy((err: unknown) => {
    const msg = decodeErrorMessage(err);
    return /Simulate transaction failed|checking transaction input|move object is expected|move package is passed/i.test(
      msg,
    );
  });
}

describe("E2E negative (testnet)", () => {
  let client: PredictClient;

  beforeAll(async () => {
    client = await createE2eClient();
  }, 60_000);

  describe("fetch views reject invalid on-chain queries", () => {
    it("getOrder fails for non-existent order id", async () => {
      await expectChainReject(getOrder(client, { orderId: NON_EXISTENT_ORDER_ID }));
    });

    it("getPosition fails for non-existent position id", async () => {
      await expectChainReject(getPosition(client, { positionId: NON_EXISTENT_ORDER_ID }));
    });

    it("getRegistry fails with wrong marketRegistry object", async () => {
      await expectChainReject(getRegistry(client, { marketRegistry: WRONG_REGISTRY_ID }));
    });

    it("getMarketByKey fails for non-existent market key", async () => {
      await expectChainReject(getMarketByKey(client, { marketKey: U64_MAX }));
    });
  });

  describe("PTB simulate aborts on invalid chain state", () => {
    it("fillOrder dry-run fails for non-existent order", async () => {
      const tx = new Transaction();
      fillOrder(client, tx, {
        orderId: NON_EXISTENT_ORDER_ID,
        filledShares: 1n,
        filledCost: 1n,
      });
      await expectSimulateFailure(client, tx);
    });
  });

  describe("SDK rejects invalid args before RPC (sanity on e2e path)", () => {
    it("placeOrder throws on invalid selection before simulate", () => {
      const tx = new Transaction();
      expect(() =>
        placeOrder(client, tx, {
          ...minimalPlaceOrderParams(client),
          selection: "yes" as "YES",
        }),
      ).toThrow(/Invalid Selection/);
    });
  });
});

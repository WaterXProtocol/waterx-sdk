import { Transaction } from "@mysten/sui/transactions";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PerpClient } from "../../../src/perp/client.ts";
import {
  appendConsolidateAddressCredit,
  appendConsolidateForSpend,
  appendConsolidateToUsd,
  buildConsolidateToUsdTx,
} from "../../../src/perp/tx-builders.ts";
import { probeAddressCreditBalance } from "../../../src/utils/consolidate-balance.ts";
import { listMoveCalls } from "../../prediction/helpers/ptb.ts";
import { coinRef, mockConsolidateBalances } from "../helpers/consolidate-mocks.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";
import {
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_COIN_CC,
  PTB_DUMMY_DEPOSIT_COIN,
} from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

function moveFunctions(tx: Transaction): string[] {
  return listMoveCalls(tx).map((c) => c.function);
}

describe("consolidate tx append helpers", () => {
  let client: ReturnType<typeof createUnitTestClient>;

  beforeEach(() => {
    client = createUnitTestClient();
    vi.restoreAllMocks();
  });

  describe("appendConsolidateToUsd", () => {
    it("returns 0 and emits no deposit legs when nothing is parked", async () => {
      mockConsolidateBalances(client);
      const tx = new Transaction();
      await expect(appendConsolidateToUsd(client, tx, PTB_DUMMY_ACCOUNT_ID)).resolves.toBe(0);
      expect(moveFunctions(tx)).toEqual([]);
    });

    it("adds funds + PSM legs for parked backing funds only", async () => {
      mockConsolidateBalances(client, { backingFunds: "500000" });
      const tx = new Transaction();
      await expect(appendConsolidateToUsd(client, tx, PTB_DUMMY_ACCOUNT_ID)).resolves.toBe(1);
      const fns = moveFunctions(tx);
      expect(fns).toContain("request_deposit_from_funds");
      expect(fns).toContain("mint_from_request");
      expect(fns).toContain("consume_deposit_direct");
      expect(fns.filter((f) => f === "request_deposit_from_receivings")).toHaveLength(0);
    });

    it("adds receivings + PSM legs when backing coins have valid refs", async () => {
      mockConsolidateBalances(client, {
        backingCoins: [coinRef(PTB_DUMMY_DEPOSIT_COIN, "300000")],
      });
      const tx = new Transaction();
      await expect(appendConsolidateToUsd(client, tx, PTB_DUMMY_ACCOUNT_ID)).resolves.toBe(1);
      expect(moveFunctions(tx)).toContain("request_deposit_from_receivings");
    });

    it("skips receivings leg when coin refs lack version/digest", async () => {
      mockConsolidateBalances(client, {
        backingCoins: [{ objectId: "0xbad", balance: "300000" }],
      });
      const tx = new Transaction();
      await expect(appendConsolidateToUsd(client, tx, PTB_DUMMY_ACCOUNT_ID)).resolves.toBe(0);
      expect(moveFunctions(tx)).toEqual([]);
    });

    it("no-ops when native_custody is not configured", async () => {
      const config = structuredClone(MOCK_TESTNET_CONFIG);
      delete config.packages.native_custody;
      const bare = new PerpClient("TESTNET", config, {
        grpcUrl: "https://fullnode.test.invalid:443",
      });
      const tx = new Transaction();
      await expect(appendConsolidateToUsd(bare, tx, PTB_DUMMY_ACCOUNT_ID)).resolves.toBe(0);
    });
  });

  describe("appendConsolidateAddressCredit", () => {
    it("returns 0 when address CREDIT probe is empty", async () => {
      mockConsolidateBalances(client);
      const tx = new Transaction();
      await expect(appendConsolidateAddressCredit(client, tx, PTB_DUMMY_ACCOUNT_ID)).resolves.toBe(
        0,
      );
      expect(moveFunctions(tx)).toEqual([]);
    });

    it("adds funds → consume_deposit_direct for address CREDIT accumulator", async () => {
      mockConsolidateBalances(client, { creditFunds: "250000" });
      const tx = new Transaction();
      await expect(appendConsolidateAddressCredit(client, tx, PTB_DUMMY_ACCOUNT_ID)).resolves.toBe(
        1,
      );
      const fns = moveFunctions(tx);
      expect(fns).toContain("request_deposit_from_funds");
      expect(fns).toContain("consume_deposit_direct");
      expect(fns).not.toContain("mint_from_request");
    });

    it("adds receivings → consume_deposit_direct for owned Coin<CREDIT>", async () => {
      mockConsolidateBalances(client, {
        creditCoins: [coinRef(PTB_DUMMY_DEPOSIT_COIN, "150000")],
      });
      const tx = new Transaction();
      await expect(appendConsolidateAddressCredit(client, tx, PTB_DUMMY_ACCOUNT_ID)).resolves.toBe(
        1,
      );
      expect(moveFunctions(tx)).toContain("request_deposit_from_receivings");
    });

    it("adds two legs when both funds and owned coins are present", async () => {
      mockConsolidateBalances(client, {
        creditFunds: "100000",
        creditCoins: [coinRef(PTB_DUMMY_DEPOSIT_COIN, "200000")],
      });
      const tx = new Transaction();
      await expect(appendConsolidateAddressCredit(client, tx, PTB_DUMMY_ACCOUNT_ID)).resolves.toBe(
        2,
      );
    });

    it("no-ops when waterx_credit is not configured", async () => {
      const config = structuredClone(MOCK_TESTNET_CONFIG);
      delete config.packages.waterx_credit;
      const bare = new PerpClient("TESTNET", config, {
        grpcUrl: "https://fullnode.test.invalid:443",
      });
      const tx = new Transaction();
      await expect(appendConsolidateAddressCredit(bare, tx, PTB_DUMMY_ACCOUNT_ID)).resolves.toBe(0);
    });
  });

  describe("appendConsolidateForSpend", () => {
    it("combines backing PSM legs and address CREDIT legs", async () => {
      mockConsolidateBalances(client, {
        backingFunds: "400000",
        creditFunds: "100000",
      });
      const tx = new Transaction();
      await expect(appendConsolidateForSpend(client, tx, PTB_DUMMY_ACCOUNT_ID)).resolves.toBe(2);
      const fns = moveFunctions(tx);
      expect(fns).toContain("mint_from_request");
      expect(fns.filter((f) => f === "consume_deposit_direct").length).toBeGreaterThanOrEqual(2);
    });

    it("covers reviewer regression: internal spend needs address CREDIT sweep only", async () => {
      mockConsolidateBalances(client, { creditFunds: "500000" });
      const tx = new Transaction();
      const legs = await appendConsolidateForSpend(client, tx, PTB_DUMMY_ACCOUNT_ID);
      expect(legs).toBe(1);
      expect(moveFunctions(tx)).toContain("request_deposit_from_funds");
      expect(moveFunctions(tx)).not.toContain("mint_from_request");
    });
  });

  describe("buildConsolidateToUsdTx", () => {
    it("still sweeps backing only (not address CREDIT)", async () => {
      mockConsolidateBalances(client, {
        backingFunds: "100000",
        creditFunds: "999999",
      });
      const tx = await buildConsolidateToUsdTx(client, PTB_DUMMY_ACCOUNT_ID);
      expect(moveFunctions(tx)).toContain("mint_from_request");
      expect(moveFunctions(tx).filter((f) => f === "consume_deposit_direct")).toHaveLength(1);
    });
  });

  describe("probe ↔ append leg parity", () => {
    it("address CREDIT leg count matches non-zero probe buckets", async () => {
      mockConsolidateBalances(client, {
        creditFunds: "1",
        creditCoins: [coinRef(PTB_DUMMY_DEPOSIT_COIN, "2")],
      });
      const probe = await probeAddressCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
      const tx = new Transaction();
      const legs = await appendConsolidateAddressCredit(client, tx, PTB_DUMMY_ACCOUNT_ID);
      expect(probe.fundsRaw).toBeGreaterThan(0n);
      expect(probe.coinsRaw).toBeGreaterThan(0n);
      expect(legs).toBe(2);
    });
  });
});

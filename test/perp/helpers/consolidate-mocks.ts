import { vi } from "vitest";

import type { PerpClient } from "../../../src/client.ts";
import { MOCK_CREDIT_TYPE, MOCK_CUSTODY_ASSET_TYPE } from "./fixtures/mock-testnet-config.ts";

export interface CoinRefMock {
  objectId: string;
  balance: string;
  version?: string;
  digest?: string;
}

export interface ConsolidateBalanceScenario {
  creditFunds?: string;
  creditCoins?: CoinRefMock[];
  backingFunds?: string;
  backingCoins?: CoinRefMock[];
}

const ZERO_BAL = {
  balance: { addressBalance: "0", coinBalance: "0", balance: "0" },
} as const;

const VALID_COIN_REF = {
  version: "2",
  digest: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
} as const;

/** Default valid receiving refs for listCoins mocks. */
export function coinRef(objectId: string, balance: string): CoinRefMock {
  return { objectId, balance, ...VALID_COIN_REF };
}

/** Mock gRPC balance probes used by consolidate read + append helpers. */
export function mockConsolidateBalances(
  client: PerpClient,
  scenario: ConsolidateBalanceScenario = {},
): void {
  vi.spyOn(client, "getBalance").mockImplementation(async ({ coinType }) => {
    if (coinType === MOCK_CREDIT_TYPE) {
      const funds = scenario.creditFunds ?? "0";
      return {
        balance: { addressBalance: funds, coinBalance: "0", balance: funds },
      } as never;
    }
    if (coinType === MOCK_CUSTODY_ASSET_TYPE) {
      const funds = scenario.backingFunds ?? "0";
      return {
        balance: { addressBalance: funds, coinBalance: "0", balance: funds },
      } as never;
    }
    return ZERO_BAL as never;
  });

  vi.spyOn(client, "listCoins").mockImplementation(async ({ coinType }) => {
    if (coinType === MOCK_CREDIT_TYPE) {
      return { objects: scenario.creditCoins ?? [] } as never;
    }
    if (coinType === MOCK_CUSTODY_ASSET_TYPE) {
      return { objects: scenario.backingCoins ?? [] } as never;
    }
    return { objects: [] } as never;
  });
}

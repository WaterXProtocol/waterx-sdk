/**
 * Read-only queries for a fixed testnet owner (simulateTransaction), aligned with integration wallet docs.
 */
import { getAccountsByOwner } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import {
  INTEGRATION_REFERENCE_USER_ACCOUNT_ID,
  INTEGRATION_REFERENCE_WALLET_ADDRESS,
} from "../helpers/integration-reference-wallet.ts";
import { client } from "../helpers/testnet.ts";
import { listAllAccountPositions } from "../integration/helpers/list-account-positions.ts";

describe("Integration reference wallet (simulate)", () => {
  it("queries UserAccounts for the fixed owner address", async () => {
    const accounts = await getAccountsByOwner(client, INTEGRATION_REFERENCE_WALLET_ADDRESS);
    expect(Array.isArray(accounts)).toBe(true);
    const pinned = INTEGRATION_REFERENCE_USER_ACCOUNT_ID.toLowerCase();
    expect(accounts.some((r) => r.accountId.toLowerCase() === pinned)).toBe(true);
    for (const row of accounts) {
      expect(row.accountId).toMatch(/^0x[0-9a-fA-F]{64}$/);
      expect(row.ownerAddress.toLowerCase()).toBe(
        INTEGRATION_REFERENCE_WALLET_ADDRESS.toLowerCase(),
      );
    }
  }, 60_000);

  it("lists perp positions across markets for the pinned reference UserAccount (when present)", async (ctx) => {
    const accounts = await getAccountsByOwner(client, INTEGRATION_REFERENCE_WALLET_ADDRESS);
    if (!accounts.length) {
      ctx.skip(
        `No WaterX UserAccount on testnet for ${INTEGRATION_REFERENCE_WALLET_ADDRESS}; run integration or pnpm create-testnet-account.`,
      );
      return;
    }
    const pinnedLower = INTEGRATION_REFERENCE_USER_ACCOUNT_ID.toLowerCase();
    if (!accounts.some((r) => r.accountId.toLowerCase() === pinnedLower)) {
      ctx.skip(
        "INTEGRATION_REFERENCE_USER_ACCOUNT_ID is not listed on-chain for the reference owner.",
      );
      return;
    }
    const rows = await listAllAccountPositions(client, INTEGRATION_REFERENCE_USER_ACCOUNT_ID, 128);
    expect(Array.isArray(rows)).toBe(true);
    for (const r of rows) {
      expect([
        "BTC",
        "ETH",
        "SOL",
        "SUI",
        "DEEP",
        "WAL",
        "AAPLX",
        "GOOGLX",
        "METAX",
        "NVDAX",
        "QQQX",
        "SPYX",
        "TSLAX",
      ]).toContain(r.base);
      expect(r.info.size).toBeGreaterThan(0n);
    }
  }, 120_000);
});

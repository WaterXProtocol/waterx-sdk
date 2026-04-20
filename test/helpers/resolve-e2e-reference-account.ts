import type { WaterXClient } from "../../src/client.ts";
import { getAccountsByOwner } from "../../src/fetch.ts";
import {
  INTEGRATION_REFERENCE_USER_ACCOUNT_ID,
  INTEGRATION_REFERENCE_WALLET_ADDRESS,
} from "./integration-reference-wallet.ts";

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
}

export type AccountRow = { accountId: string };

/**
 * Pick the UserAccount id for simulate / integration when `accounts` is already loaded.
 *
 * Precedence for the **reference** owner only: `WATERX_INTEGRATION_ACCOUNT_ID` →
 * {@link INTEGRATION_REFERENCE_USER_ACCOUNT_ID} → `accounts[0]`.
 *
 * For any other owner: `accounts[0]` (env pin is not applied — avoids cross-wallet mistakes).
 */
export function pickE2eAccountIdForOwner(owner: string, accounts: AccountRow[]): string {
  if (!accounts.length) {
    throw new Error(
      `No WaterX UserAccount for owner ${owner}. Create one on testnet or set WATERX_INTEGRATION_ACCOUNT_ID.`,
    );
  }

  const isRef = normAddr(owner) === normAddr(INTEGRATION_REFERENCE_WALLET_ADDRESS);
  const envId = process.env.WATERX_INTEGRATION_ACCOUNT_ID?.trim();

  if (isRef && envId) {
    const m = accounts.find((a) => normAddr(a.accountId) === normAddr(envId));
    if (!m) {
      throw new Error(
        `WATERX_INTEGRATION_ACCOUNT_ID=${envId} is not listed for reference owner ${owner}.`,
      );
    }
    return m.accountId;
  }

  if (isRef) {
    const pinned = INTEGRATION_REFERENCE_USER_ACCOUNT_ID.trim();
    if (pinned) {
      const m = accounts.find((a) => normAddr(a.accountId) === normAddr(pinned));
      if (!m) {
        throw new Error(
          `INTEGRATION_REFERENCE_USER_ACCOUNT_ID (${pinned}) is not listed for ${owner}. ` +
            `Update test/helpers/integration-reference-wallet.ts or set WATERX_INTEGRATION_ACCOUNT_ID.`,
        );
      }
      return m.accountId;
    }
  }

  return accounts[0]!.accountId;
}

/** Same as {@link pickE2eAccountIdForOwner} after fetching `getAccountsByOwner(client, owner)`. */
export async function resolveE2eAccountForOwner(
  client: WaterXClient,
  owner: string,
): Promise<string> {
  const accounts = await getAccountsByOwner(client, owner);
  return pickE2eAccountIdForOwner(owner, accounts);
}

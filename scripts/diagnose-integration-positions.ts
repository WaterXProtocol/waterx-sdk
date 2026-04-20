/**
 * One-shot check for e2e/bootstrap debugging:
 * 1) Integration signer address vs INTEGRATION_REFERENCE_WALLET_ADDRESS
 * 2) E2e reference UserAccount (`resolveE2eAccountForOwner` — pinned id + env override)
 * 3) Open BTC positions for that account (scans position_id 0 .. min(nextPositionId, cap)-1)
 *
 * Usage: pnpm diagnose:positions
 *   pnpm diagnose:positions -- --account-id 0x...   # scan this UserAccount (skip owner→accounts[0])
 *   pnpm diagnose:positions -- --no-update-local-fixed-positions
 * Or set WATERX_INTEGRATION_ACCOUNT_ID (same as integration tests).
 * Requires same env/keystore as `pnpm test:integration` / `pnpm e2e:bootstrap-positions`.
 */
import { getAccountsByOwner } from "../src/fetch.ts";
import {
  persistE2eFixedPositionsLocal,
  shouldAutoPersistLocalFixedPositions,
} from "../test/helpers/e2e-fixed-positions-persist.ts";
import { INTEGRATION_REFERENCE_WALLET_ADDRESS } from "../test/helpers/integration-reference-wallet.ts";
import { resolveE2eAccountForOwner } from "../test/helpers/resolve-e2e-reference-account.ts";
import { listAccountPositionsInMarket } from "../test/integration/helpers/list-account-positions.ts";
import { client, loadIntegrationTraderKeypair } from "../test/integration/setup.ts";

const REF = INTEGRATION_REFERENCE_WALLET_ADDRESS;
/** Raise if testnet BTC market has huge next_position_id and you need deeper scan. */
const MAX_SCAN = Number(process.env.DIAGNOSE_POSITION_SCAN_MAX ?? "8192");

function parseExplicitAccountId(argv: string[]): { id: string; source: string } | null {
  const idx = argv.findIndex((a) => a === "--account-id");
  if (idx >= 0 && argv[idx + 1]?.trim()) {
    return { id: argv[idx + 1]!.trim(), source: "--account-id" };
  }
  const envId = process.env.WATERX_INTEGRATION_ACCOUNT_ID?.trim();
  if (envId) return { id: envId, source: "WATERX_INTEGRATION_ACCOUNT_ID" };
  return null;
}

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
}

async function main() {
  const argv = process.argv.slice(2);
  const noUpdateLocalFixed = argv.includes("--no-update-local-fixed-positions");

  const kp = loadIntegrationTraderKeypair();
  const signer = kp.getPublicKey().toSuiAddress();
  const refMatch =
    signer.replace(/^0x/i, "").toLowerCase() === REF.replace(/^0x/i, "").toLowerCase();

  console.log("Integration signer (from WATERX_* / .integration-trader.keystore):", signer);
  console.log(
    "INTEGRATION_REFERENCE_WALLET_ADDRESS (e2e simulate uses this owner):           ",
    REF,
  );
  console.log(
    "Signer matches reference wallet:",
    refMatch ? "yes" : "NO — bootstrap may have opened on a different account than e2e reads",
  );
  console.log("");

  const explicit = parseExplicitAccountId(argv);
  let accountId: string;

  if (explicit) {
    accountId = explicit.id;
    if (!/^0x[0-9a-fA-F]{64}$/.test(accountId)) {
      console.error("Invalid UserAccount id from %s (want 0x + 64 hex).", explicit.source);
      process.exit(1);
    }
    console.log("UserAccount object id (%s): %s", explicit.source, accountId);
    const refAccounts = await getAccountsByOwner(client, REF);
    const listed = refAccounts.some((a) => normAddr(a.accountId) === normAddr(accountId));
    if (!listed) {
      console.warn(
        "Note: this accountId is not listed for INTEGRATION_REFERENCE_WALLET_ADDRESS. " +
          "E2e uses `resolveE2eAccountForOwner` (env pin → committed UserAccount id → first row).",
      );
    }
  } else {
    try {
      accountId = await resolveE2eAccountForOwner(client, REF);
      console.log(
        "E2e reference UserAccount (INTEGRATION_REFERENCE_USER_ACCOUNT_ID / env / chain):",
        accountId,
      );
    } catch (e) {
      console.log(e instanceof Error ? e.message : String(e));
      console.log(
        "Tip: `pnpm diagnose:positions -- --account-id 0x...` or WATERX_INTEGRATION_ACCOUNT_ID.",
      );
      return;
    }
  }

  console.log(
    "Open Suiscan (testnet): https://suiscan.xyz/testnet/object/" + accountId.replace(/^0x/, ""),
  );
  console.log("");

  const btcRows = await listAccountPositionsInMarket(client, accountId, "BTC", MAX_SCAN);
  console.log(
    "Open BTC positions (scan cap=%s, set DIAGNOSE_POSITION_SCAN_MAX to raise): %s",
    String(MAX_SCAN),
    String(btcRows.length),
  );
  for (const r of btcRows) {
    console.log(
      "  position_id=%s size=%s account_object_address=%s",
      String(r.positionId),
      String(r.info.size),
      r.info.accountObjectAddress,
    );
  }
  if (btcRows.length === 0) {
    console.log(
      "\nIf you expected a BTC position: run `pnpm e2e:bootstrap-positions` (signer=REF) or `--force`.",
    );
    console.log(
      "Note: `resolveE2eOpenPosition` uses pinned ids (committed / env / .e2e-fixed-positions.local.json) then a short recent scan; full scan is used when refreshing the local file.",
    );
  }

  if (!noUpdateLocalFixed && shouldAutoPersistLocalFixedPositions()) {
    try {
      await persistE2eFixedPositionsLocal({
        client,
        accountId,
      });
    } catch (e) {
      console.warn("[e2e-fixed-local] persist failed:", e instanceof Error ? e.message : String(e));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

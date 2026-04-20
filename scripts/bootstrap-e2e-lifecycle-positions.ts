/**
 * Open one small perp per **e2e persistent** market (`e2e-persistent-state.ts`) on the integration
 * UserAccount so `pnpm test:e2e` state-dependent cases can find a recent position. The integration
 * project normally fills slots via `trader-e2e-persistent-state.test.ts`; use this script for a cold
 * wallet without running integration.
 *
 * Requires the same key / env as `pnpm test:integration` (see `test/integration/setup.ts`).
 * Signer address must match {@link INTEGRATION_REFERENCE_WALLET_ADDRESS} unless you pass
 * `--allow-non-reference-wallet`.
 *
 * Usage:
 *   pnpm e2e:bootstrap-positions
 *   pnpm e2e:bootstrap-positions -- --dry-run
 *   pnpm e2e:bootstrap-positions -- --force       # open even if this market already has an open position
 *   pnpm e2e:bootstrap-positions -- --no-update-local-fixed-positions
 *   pnpm e2e:bootstrap-positions -- --full-local-scan   # slow: walk up to E2E_LOCAL_FIXED_SCAN_MAX (8192) per market
 */
import type { BaseAsset } from "../src/constants.ts";
import { getAccountBalance } from "../src/fetch.ts";
import {
  persistE2eFixedPositionsLocal,
  shouldAutoPersistLocalFixedPositions,
} from "../test/helpers/e2e-fixed-positions-persist.ts";
import {
  E2E_PERSISTENT_POSITION_SCAN_DEPTH,
  ensureE2ePersistentPerpSlots,
} from "../test/helpers/e2e-persistent-perp-slots.ts";
import {
  activeE2ePersistentPerpBases,
  e2ePersistentMinAccountUsdcRough,
} from "../test/helpers/e2e-persistent-state.ts";
import { INTEGRATION_REFERENCE_WALLET_ADDRESS } from "../test/helpers/integration-reference-wallet.ts";
import {
  buildDepositUsdcFromWalletTx,
  ensureUserAccountForIntegration,
} from "../test/integration/helpers/account-bootstrap.ts";
import {
  listAccountPositionsInMarket,
  minOpenPositionId,
} from "../test/integration/helpers/list-account-positions.ts";
import {
  assertSuccess,
  client,
  execBuiltTxWithCooldownRetries,
  execTx,
  loadIntegrationTraderKeypair,
} from "../test/integration/setup.ts";

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
}

function parseArgs(argv: string[]) {
  return {
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
    allowNonReference: argv.includes("--allow-non-reference-wallet"),
    noUpdateLocalFixed: argv.includes("--no-update-local-fixed-positions"),
    fullLocalScan: argv.includes("--full-local-scan"),
  };
}

function bootstrapMinAccountUsdc(): bigint {
  return e2ePersistentMinAccountUsdcRough();
}

async function main() {
  const { dryRun, force, allowNonReference, noUpdateLocalFixed, fullLocalScan } = parseArgs(
    process.argv.slice(2),
  );

  const trader = loadIntegrationTraderKeypair();
  const owner = trader.getPublicKey().toSuiAddress();

  if (normAddr(owner) !== normAddr(INTEGRATION_REFERENCE_WALLET_ADDRESS) && !allowNonReference) {
    console.error(
      `Signer ${owner} does not match INTEGRATION_REFERENCE_WALLET_ADDRESS ` +
        `(${INTEGRATION_REFERENCE_WALLET_ADDRESS}). E2E resolves UserAccount via pinned id / env (see integration-reference-wallet.ts).\n` +
        "Use the integration key that owns that address, or pass --allow-non-reference-wallet.",
    );
    process.exit(1);
  }

  const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);
  const usdcType = client.config.collaterals.USDC.type;
  const minUsdc = bootstrapMinAccountUsdc();
  let balance = await getAccountBalance(client, accountId, usdcType);

  if (balance < minUsdc) {
    const need = minUsdc - balance;
    if (dryRun) {
      console.log(
        `[dry-run] Would deposit ${need} USDC (raw) from wallet; account has ${balance}, need ${minUsdc}.`,
      );
    } else {
      console.log(
        `Depositing ${need} USDC (raw) from wallet into account ${accountId.slice(0, 12)}…`,
      );
      const depTx = await buildDepositUsdcFromWalletTx(client, owner, accountId, need);
      const depResult = await execTx(depTx, trader, { gasBudget: 50_000_000 });
      assertSuccess(depResult);
      balance = await getAccountBalance(client, accountId, usdcType);
    }
  }

  if (!dryRun && balance < minUsdc) {
    throw new Error(`Account USDC still below ${minUsdc} after deposit attempt (have ${balance}).`);
  }

  const bases = activeE2ePersistentPerpBases();
  console.log(
    `Account ${accountId.slice(0, 14)}… | USDC balance ${balance} | markets: ${bases.join(", ")}`,
  );

  const positionsForLocal = await ensureE2ePersistentPerpSlots({
    client,
    accountId,
    signer: trader,
    dryRun,
    force,
    logStyle: "bootstrap",
    execBuiltTxWithCooldownRetries,
  });

  if (!dryRun && !noUpdateLocalFixed && shouldAutoPersistLocalFixedPositions()) {
    try {
      if (!fullLocalScan) {
        const allConfigured = Object.keys(client.config.markets) as BaseAsset[];
        for (const base of allConfigured) {
          if (positionsForLocal[base] !== undefined) continue;
          const rows = await listAccountPositionsInMarket(
            client,
            accountId,
            base,
            E2E_PERSISTENT_POSITION_SCAN_DEPTH,
          );
          const id = minOpenPositionId(rows);
          if (id !== undefined) positionsForLocal[base] = id;
        }
      }
      await persistE2eFixedPositionsLocal({
        client,
        accountId,
        ...(fullLocalScan ? {} : { positionsKnown: positionsForLocal }),
      });
    } catch (e) {
      console.warn("[e2e-fixed-local] persist failed:", e instanceof Error ? e.message : String(e));
    }
  }

  console.log(dryRun ? "Dry run done." : "Bootstrap done. Run `pnpm test:e2e`.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

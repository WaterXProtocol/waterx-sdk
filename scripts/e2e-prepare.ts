/**
 * Auto-prepare common e2e prerequisites:
 * - ensure >= N funded TTO USDC coin objects in UserAccount (default: 2)
 * - open missing **persistent e2e** perps (`e2e-persistent-state.ts`, includes SOL) when absent
 * - wait until cooldown windows elapse for markets that already have open positions
 * - top up **wallet** WLP + per-collateral coins for `wlp-simulate` (pull from UserAccount when possible)
 *
 * Requires integration trader key (same as `pnpm test:integration`).
 *
 * Usage:
 *   pnpm e2e:prepare
 *   pnpm e2e:prepare -- --owner 0x... --dry-run
 *   pnpm e2e:prepare -- --no-update-local-fixed-positions
 *   pnpm e2e:prepare -- --no-open-positions   # skip opening missing perps (faster if slots exist)
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  getAccountBalance,
  getAccountCoins,
  getMarketCooldownMs,
  WaterXClient,
} from "../src/index.ts";
import { buildMintWlpTx, buildReceiveCoinTx } from "../src/tx-builders.ts";
import {
  persistE2eFixedPositionsLocal,
  shouldAutoPersistLocalFixedPositions,
} from "../test/helpers/e2e-fixed-positions-persist.ts";
import { ensureE2ePersistentPerpSlots } from "../test/helpers/e2e-persistent-perp-slots.ts";
import {
  E2E_WALLET_WLP_MIN_RAW,
  e2eWalletCollateralMinForMintSimulate,
  sumWalletCoinBalance,
} from "../test/helpers/e2e-wlp-readiness.ts";
import { INTEGRATION_REFERENCE_WALLET_ADDRESS } from "../test/helpers/integration-reference-wallet.ts";
import { activeLifecycleTestBases, lifecycleRow } from "../test/helpers/lifecycle-test-markets.ts";
import { resolveE2eOpenPosition } from "../test/helpers/resolve-e2e-open-position.ts";
import {
  buildDepositUsdcFromWalletTx,
  ensureUserAccountForIntegration,
} from "../test/integration/helpers/account-bootstrap.ts";
import {
  assertSuccess,
  execBuiltTxWithCooldownRetries,
  execTx,
  loadIntegrationTraderKeypair,
  sleep,
} from "../test/integration/setup.ts";

/** USDC pulled from account → wallet → `mint_wlp_to` recipient wallet (6 dp). */
const PREPARE_WLP_TOPUP_PULL_USDC = 5_000_000n;

function parseOwnerArg(argv: string[]): string {
  const idx = argv.findIndex((a) => a === "--owner");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1]!;
  return INTEGRATION_REFERENCE_WALLET_ADDRESS;
}

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const noOpenPositions = argv.includes("--no-open-positions");
  const noUpdateLocalFixed = argv.includes("--no-update-local-fixed-positions");
  const ownerArg = parseOwnerArg(argv);
  const client = WaterXClient.testnet();

  const trader = loadIntegrationTraderKeypair();
  const signerOwner = trader.getPublicKey().toSuiAddress();
  if (normAddr(ownerArg) !== normAddr(signerOwner)) {
    throw new Error(
      `--owner ${ownerArg} does not match configured integration signer ${signerOwner}. ` +
        "Use the integration signer address or reconfigure WATERX_INTEGRATION_*.",
    );
  }

  const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);
  const usdcType = client.config.collaterals.USDC.type;
  const minFundedPerCoin = activeLifecycleTestBases().reduce((acc, base) => {
    const inc = lifecycleRow(base).e2ePtb.increaseCollateral;
    return inc > acc ? inc : acc;
  }, 5_000_000n);

  // 1) Ensure at least 2 funded TTO USDC coin objects.
  const coins = await getAccountCoins(client, accountId, usdcType);
  const funded = coins.filter((c) => BigInt(c.balance) >= minFundedPerCoin).length;
  if (funded < 2) {
    const need = 2 - funded;
    console.log(
      `[prepare] funded TTO USDC coins=${funded}, need +${need} (threshold=${minFundedPerCoin})`,
    );
    for (let i = 0; i < need; i++) {
      if (dryRun) {
        console.log(`[dry-run] would deposit one split USDC coin amount=${minFundedPerCoin}`);
        continue;
      }
      const tx = await buildDepositUsdcFromWalletTx(
        client,
        signerOwner,
        accountId,
        minFundedPerCoin,
      );
      const r = await execTx(tx, trader, { gasBudget: 80_000_000 });
      assertSuccess(r);
      console.log(`[prepare] deposited split coin ${i + 1}/${need} digest=${r.digest}`);
    }
  } else {
    console.log(`[prepare] funded TTO USDC coin readiness OK (${funded} >= 2)`);
  }

  // 2) Missing persistent e2e perps (BTC, ETH, SUI, SOL, WAL, DEEP — see `e2e-persistent-state.ts`).
  if (!dryRun && !noOpenPositions) {
    await ensureE2ePersistentPerpSlots({
      client,
      accountId,
      signer: trader,
      dryRun: false,
      force: false,
      logStyle: "prepare",
      execBuiltTxWithCooldownRetries,
    });
  } else if (dryRun && !noOpenPositions) {
    console.log(
      "[dry-run] would open any missing persistent e2e perp (same set as e2e:bootstrap-positions)",
    );
  } else if (noOpenPositions) {
    console.log("[prepare] --no-open-positions: skipping perp slot check");
  }

  // 3) Wallet: collaterals + WLP for `test/simulate/wlp-simulate.test.ts`.
  if (!dryRun) {
    const wlpType = client.config.wlpType;
    for (const { asset, coinType } of client.getCollateralAssets()) {
      const minW = e2eWalletCollateralMinForMintSimulate(asset);
      const wSum = await sumWalletCoinBalance(client, signerOwner, coinType);
      if (wSum >= minW) continue;
      const deficit = minW - wSum;
      const accBal = await getAccountBalance(client, accountId, coinType);
      if (accBal < deficit) {
        console.log(
          `[prepare] wallet ${asset}: skip top-up (wallet=${wSum}, need +${deficit} to reach ${minW}; account=${accBal})`,
        );
        continue;
      }
      console.log(
        `[prepare] receive ${asset} from account → wallet for WLP mint simulate (+${deficit} → min ${minW})`,
      );
      const recvTx = await buildReceiveCoinTx(client, {
        accountObjectAddress: accountId,
        collateral: asset,
        amount: deficit,
        recipient: signerOwner,
      });
      const rr = await execTx(recvTx, trader, { gasBudget: 80_000_000 });
      assertSuccess(rr);
    }

    let wlpW = await sumWalletCoinBalance(client, signerOwner, wlpType);
    if (wlpW < E2E_WALLET_WLP_MIN_RAW) {
      const usdcMin = e2eWalletCollateralMinForMintSimulate("USDC");
      const needUsdc = usdcMin + PREPARE_WLP_TOPUP_PULL_USDC;
      let usdcW = await sumWalletCoinBalance(
        client,
        signerOwner,
        client.config.collaterals.USDC.type,
      );
      if (usdcW < needUsdc) {
        const pull = needUsdc - usdcW;
        const accUsdc = await getAccountBalance(
          client,
          accountId,
          client.config.collaterals.USDC.type,
        );
        if (accUsdc < pull) {
          console.warn(
            `[prepare] cannot mint wallet WLP: need ${pull} more USDC on wallet; account USDC=${accUsdc}`,
          );
        } else {
          const recvTx = await buildReceiveCoinTx(client, {
            accountObjectAddress: accountId,
            collateral: "USDC",
            amount: pull,
            recipient: signerOwner,
          });
          const rr = await execTx(recvTx, trader, { gasBudget: 80_000_000 });
          assertSuccess(rr);
          usdcW = await sumWalletCoinBalance(
            client,
            signerOwner,
            client.config.collaterals.USDC.type,
          );
        }
      }
      if (usdcW >= needUsdc) {
        const walletCoins = await getAccountCoins(
          client,
          signerOwner,
          client.config.collaterals.USDC.type,
        );
        const usable = walletCoins.find((c) => BigInt(c.balance) >= PREPARE_WLP_TOPUP_PULL_USDC);
        if (!usable) {
          console.warn("[prepare] wallet WLP top-up: no single USDC coin >= pull amount");
        } else {
          const bal = BigInt(usable.balance);
          let mintTx: Transaction;
          if (bal === PREPARE_WLP_TOPUP_PULL_USDC) {
            mintTx = await buildMintWlpTx(client, {
              depositCoin: usable.objectId,
              recipient: signerOwner,
              collateral: "USDC",
            });
          } else {
            const tx = new Transaction();
            tx.setGasBudget(250_000_000);
            const primary = tx.object(usable.objectId);
            const [depositCoin] = tx.splitCoins(primary, [PREPARE_WLP_TOPUP_PULL_USDC]);
            await buildMintWlpTx(client, {
              depositCoin,
              recipient: signerOwner,
              collateral: "USDC",
              tx,
            });
            tx.transferObjects([primary], signerOwner);
            mintTx = tx;
          }
          const mr = await execTx(mintTx, trader, { gasBudget: 250_000_000 });
          assertSuccess(mr);
          wlpW = await sumWalletCoinBalance(client, signerOwner, wlpType);
          console.log(`[prepare] wallet WLP after top-up: ${wlpW}`);
        }
      }
    } else {
      console.log(`[prepare] wallet WLP readiness OK (${wlpW} >= ${E2E_WALLET_WLP_MIN_RAW})`);
    }
  } else {
    console.log(
      "[dry-run] would run wallet WLP / collateral top-up from account when below thresholds",
    );
  }

  // 4) Wait for cooldown windows to elapse for existing lifecycle positions.
  let maxWaitMs = 0;
  for (const base of activeLifecycleTestBases()) {
    const openHit = await resolveE2eOpenPosition(client, accountId, base);
    if (!openHit) continue;
    const m = client.getMarketEntry(base);
    const cooldownMs = await getMarketCooldownMs(client, m.marketId);
    const waitMs = Number(openHit.info.updateTimestamp) + Number(cooldownMs) + 750 - Date.now();
    if (waitMs > maxWaitMs) maxWaitMs = waitMs;
    console.log(
      `[prepare] ${base} cooldown=${cooldownMs}ms, remaining=${Math.max(0, Math.ceil(waitMs / 1000))}s`,
    );
  }
  if (maxWaitMs > 0) {
    if (dryRun) {
      console.log(`[dry-run] would wait ~${Math.ceil(maxWaitMs / 1000)}s for cooldown readiness`);
    } else {
      const waitSec = Math.ceil(maxWaitMs / 1000);
      console.log(`[prepare] waiting ${waitSec}s for cooldown readiness...`);
      await sleep(maxWaitMs);
    }
  } else {
    console.log("[prepare] cooldown readiness already satisfied");
  }

  // final visibility
  const finalCoins = await getAccountCoins(client, accountId, usdcType);
  const finalFunded = finalCoins.filter((c) => BigInt(c.balance) >= minFundedPerCoin).length;
  console.log(`[prepare] done. funded TTO USDC coins>=${minFundedPerCoin}: ${finalFunded}`);

  if (!dryRun && !noUpdateLocalFixed && shouldAutoPersistLocalFixedPositions()) {
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

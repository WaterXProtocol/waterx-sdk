/**
 * Maintains **e2e-only persistent** perp + WLP on the integration reference UserAccount.
 * Does not run increase/decrease/close on existing positions — only opens when a market has zero
 * open positions, or mints WLP when below minimum. Other integration tests must use scratch
 * positions and close them (see `trader-position-lifecycle.test.ts`).
 */
import { Transaction } from "@mysten/sui/transactions";
import { getAccountBalance } from "@waterx/perp-sdk";
import { beforeAll, describe, expect, it } from "vitest";

import type { BaseAsset } from "../../../src/constants.ts";
import { getAccountCoins } from "../../../src/fetch.ts";
import {
  buildMintWlpTx,
  buildOpenPositionTx,
  buildReceiveCoinTx,
} from "../../../src/tx-builders.ts";
import {
  buildDepositUsdcFromWalletTx,
  ensureUserAccountForIntegration,
} from "../helpers/account-bootstrap.ts";
import {
  activeE2ePersistentPerpBases,
  E2E_PERSISTENT_WLP,
  e2ePersistentPerpRow,
} from "../helpers/e2e-persistent-state.ts";
import {
  alignPositionSizeToMarket,
  assertMarketSnapshotTradeable,
  fetchIntegrationMarketSummaries,
  type IntegrationMarketSnapshotMap,
} from "../helpers/integration-market-snapshot.ts";
import { listAccountPositionsInMarket } from "../helpers/list-account-positions.ts";
import {
  assertSuccess,
  client,
  execBuiltTxWithCooldownRetries,
  execIntegrationOrSkipSupra,
  execTx,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../setup.ts";

describe.skipIf(!isIntegrationTraderConfigured())(
  "Integration: e2e persistent state (perp slots + WLP, do not mutate in other tests)",
  () => {
    const perpBases = activeE2ePersistentPerpBases();
    let marketAtStart: IntegrationMarketSnapshotMap;

    beforeAll(async () => {
      marketAtStart = await fetchIntegrationMarketSummaries(client, perpBases);
    }, 180_000);

    describe.each(perpBases)("%s perp slot", (base: BaseAsset) => {
      it("opens one position only when this market has no open position for the account", async (ctx) => {
        const trader = loadIntegrationTraderKeypair();
        const owner = trader.getPublicKey().toSuiAddress();
        const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);

        const openRows = await listAccountPositionsInMarket(client, accountId, base, 256);
        if (openRows.length > 0) {
          expect(openRows.length).toBeGreaterThan(0);
          return;
        }

        const row = e2ePersistentPerpRow(base);
        const lev = row.simulateLeverage ?? row.leverage;
        const usdcType = client.config.collaterals.USDC.type;
        const minFree = row.openCollateral + 15_000_000n;
        let balance = await getAccountBalance(client, accountId, usdcType);
        if (balance < minFree) {
          const need = minFree - balance;
          const depTx = await buildDepositUsdcFromWalletTx(client, owner, accountId, need);
          const depResult = await execTx(depTx, trader, { gasBudget: 50_000_000 });
          assertSuccess(depResult);
          balance = await getAccountBalance(client, accountId, usdcType);
        }
        expect(balance).toBeGreaterThanOrEqual(minFree);

        const entry = client.getMarketEntry(base);
        const snap = marketAtStart[base]!;
        assertMarketSnapshotTradeable(snap, base);
        const openSize = alignPositionSizeToMarket(row.openSize);

        const result = await execIntegrationOrSkipSupra(ctx, () =>
          execBuiltTxWithCooldownRetries(
            () =>
              buildOpenPositionTx(client, {
                accountId,
                base,
                isLong: row.isLong,
                leverage: lev,
                collateralAmount: row.openCollateral,
                size: openSize,
              }),
            trader,
            { cooldownMarketIds: [entry.marketId] },
          ),
        );
        if (result === undefined) return;
        assertSuccess(result);

        const after = await listAccountPositionsInMarket(client, accountId, base, 256);
        expect(after.length).toBeGreaterThan(0);
      }, 300_000);
    });

    it("mints WLP into the account when balance is below E2E_PERSISTENT_WLP.minBalanceRaw", async () => {
      const trader = loadIntegrationTraderKeypair();
      const owner = trader.getPublicKey().toSuiAddress();
      const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);

      const wlpType = client.config.wlpType;
      const usdcType = client.config.collaterals.USDC.type;
      const { minBalanceRaw, mintPullUsdc } = E2E_PERSISTENT_WLP;

      const wlpBal = await getAccountBalance(client, accountId, wlpType);
      if (wlpBal >= minBalanceRaw) {
        expect(wlpBal).toBeGreaterThanOrEqual(minBalanceRaw);
        return;
      }

      let usdcFree = await getAccountBalance(client, accountId, usdcType);
      const needFree = mintPullUsdc + 10_000_000n;
      if (usdcFree < needFree) {
        const need = needFree - usdcFree;
        const depTx = await buildDepositUsdcFromWalletTx(client, owner, accountId, need);
        const depResult = await execTx(depTx, trader, { gasBudget: 50_000_000 });
        assertSuccess(depResult);
        usdcFree = await getAccountBalance(client, accountId, usdcType);
      }
      expect(usdcFree).toBeGreaterThanOrEqual(mintPullUsdc);

      const recvTx = await buildReceiveCoinTx(client, {
        accountObjectAddress: accountId,
        collateral: "USDC",
        amount: mintPullUsdc,
        recipient: owner,
      });
      const recvResult = await execTx(recvTx, trader, { gasBudget: 80_000_000 });
      assertSuccess(recvResult);

      const walletCoins = await getAccountCoins(client, owner, usdcType);
      const usable = walletCoins.find((c) => BigInt(c.balance) >= mintPullUsdc);
      if (!usable) {
        throw new Error(
          `Wallet USDC after receive: need one coin ≥ ${mintPullUsdc}, have ${walletCoins.length} coin(s).`,
        );
      }

      const bal = BigInt(usable.balance);
      let mintTx: Transaction;
      if (bal === mintPullUsdc) {
        mintTx = await buildMintWlpTx(client, {
          depositCoin: usable.objectId,
          recipient: accountId,
          collateral: "USDC",
        });
      } else {
        const tx = new Transaction();
        tx.setGasBudget(250_000_000);
        const primary = tx.object(usable.objectId);
        const [depositCoin] = tx.splitCoins(primary, [mintPullUsdc]);
        await buildMintWlpTx(client, {
          depositCoin,
          recipient: accountId,
          collateral: "USDC",
          tx,
        });
        tx.transferObjects([primary], owner);
        mintTx = tx;
      }

      const mintResult = await execTx(mintTx, trader, { gasBudget: 250_000_000 });
      assertSuccess(mintResult);

      const after = await getAccountBalance(client, accountId, wlpType);
      expect(after).toBeGreaterThanOrEqual(minBalanceRaw);
    }, 300_000);

    it("optional: mint WLP with USDSUI when WLP low and account has USDSUI", async (ctx) => {
      const trader = loadIntegrationTraderKeypair();
      const owner = trader.getPublicKey().toSuiAddress();
      const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);

      const wlpType = client.config.wlpType;
      const { minBalanceRaw, mintPullUsdc } = E2E_PERSISTENT_WLP;
      const wlpBal = await getAccountBalance(client, accountId, wlpType);
      if (wlpBal >= minBalanceRaw) {
        expect(wlpBal).toBeGreaterThanOrEqual(minBalanceRaw);
        return;
      }

      const usdsuiType = client.config.collaterals.USDSUI.type;
      const usdsuiFree = await getAccountBalance(client, accountId, usdsuiType);
      const needFree = mintPullUsdc + 10_000_000n;
      if (usdsuiFree < needFree) {
        ctx.skip(
          `USDSUI account balance ${usdsuiFree} < ${needFree} — fund account or use USDC mint path`,
        );
        return;
      }

      const recvTx = await buildReceiveCoinTx(client, {
        accountObjectAddress: accountId,
        collateral: "USDSUI",
        amount: mintPullUsdc,
        recipient: owner,
      });
      const recvResult = await execTx(recvTx, trader, { gasBudget: 80_000_000 });
      assertSuccess(recvResult);

      const walletCoins = await getAccountCoins(client, owner, usdsuiType);
      const usable = walletCoins.find((c) => BigInt(c.balance) >= mintPullUsdc);
      if (!usable) {
        throw new Error(
          `Wallet USDSUI after receive: need one coin ≥ ${mintPullUsdc}, have ${walletCoins.length} coin(s).`,
        );
      }

      const bal = BigInt(usable.balance);
      let mintTx: Transaction;
      if (bal === mintPullUsdc) {
        mintTx = await buildMintWlpTx(client, {
          depositCoin: usable.objectId,
          recipient: accountId,
          collateral: "USDSUI",
        });
      } else {
        const tx = new Transaction();
        tx.setGasBudget(250_000_000);
        const primary = tx.object(usable.objectId);
        const [depositCoin] = tx.splitCoins(primary, [mintPullUsdc]);
        await buildMintWlpTx(client, {
          depositCoin,
          recipient: accountId,
          collateral: "USDSUI",
          tx,
        });
        tx.transferObjects([primary], owner);
        mintTx = tx;
      }

      const mintResult = await execTx(mintTx, trader, { gasBudget: 250_000_000 });
      assertSuccess(mintResult);

      const after = await getAccountBalance(client, accountId, wlpType);
      expect(after).toBeGreaterThanOrEqual(minBalanceRaw);
    }, 300_000);
  },
);

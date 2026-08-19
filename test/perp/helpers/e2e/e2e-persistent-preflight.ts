/**
 * Testnet preflight: keeper-open per-ticker slots + wxa WLP (+ optional CREDIT) for e2e simulate discovery.
 * Reuses the same on-chain targets as `trader-e2e-persistent-state.test.ts`.
 */
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import type { PerpClient } from "../../../../src/perp/client.ts";
import { getAccountBalance } from "../../../../src/perp/fetch.ts";
import { buildMintWlpTx } from "../../../../src/perp/tx-builders.ts";
import { openPositionByKeeper } from "../../../../src/perp/user/trading.ts";
import { requestRedeemWlp } from "../../../../src/perp/user/wlp.ts";
import {
  buildDepositUsdcFromWalletTx,
  ensureUserAccountForIntegration,
  selectWalletCoinsCoveringAmount,
} from "../../integration/helpers/account-bootstrap.ts";
import {
  activeE2ePersistentPerpTickers,
  E2E_PERSISTENT_REDEEM,
  E2E_PERSISTENT_WLP,
  e2ePersistentPerpRow,
  e2ePersistentPerpTickersForClient,
} from "../../integration/helpers/e2e-persistent-state.ts";
import { integrationGasBudget } from "../../integration/helpers/integration-gas.ts";
import {
  assertMarketTickerTradeableSnapshot,
  fetchIntegrationMarketSummaries,
  keeperOpenAcceptablePrice,
  type IntegrationMarketSnapshotMap,
} from "../../integration/helpers/integration-market-snapshot.ts";
import { listAccountPositionsInMarket } from "../../integration/helpers/list-account-positions.ts";
import { ensureIntegrationMinCreditBalance } from "../integration/ensure-credit-balance.ts";
import {
  assertIntegrationTxSuccess,
  classifyPreflightTxError,
  execBuiltTxWithCooldownRetriesOnClient,
  execTxOnClient,
} from "../integration/integration-exec.ts";
import {
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../integration/integration-trader-key.ts";
import { refreshOraclePricesForTradingEdge } from "../trading/oracle-trading-edge.ts";
import { findPendingRedeemForAccount } from "./discover-on-chain-position.ts";
import { isCreditPipelineConfigured } from "./e2e-custody.ts";
import { resolveE2eNetwork } from "./e2e-network.ts";
import { lifecycleTickerRow } from "./lifecycle-test-markets.ts";

export type E2ePreflightSlotResult =
  | { status: "exists" }
  | { status: "opened" }
  | { status: "skipped"; reason: string };

export type E2ePreflightReport = {
  accountId: string;
  owner: string;
  perpSlots: Record<string, E2ePreflightSlotResult>;
  wlp: { status: "ok" } | { status: "minted" } | { status: "skipped"; reason: string };
  redeem:
    | { status: "ok" }
    | { status: "requested"; requestId: string }
    | { status: "skipped"; reason: string };
  credit: { status: "ok" } | { status: "minted" } | { status: "skipped"; reason: string };
  warnings: string[];
};

function preflightLog(msg: string): void {
  console.log(`[e2e preflight] ${msg}`);
}

/**
 * True when opt-in preflight env + integration key are set (used by scripts; not wired in e2e setupFiles).
 * Prefer `pnpm test:e2e:preflight` for local seeding — `pnpm test:e2e` / CI do not call this.
 */
export function shouldRunE2ePersistentPreflight(): boolean {
  if (resolveE2eNetwork() !== "testnet") return false;
  const flag = process.env.WATERX_E2E_PREFLIGHT?.trim().toLowerCase();
  if (flag !== "1" && flag !== "true" && flag !== "on" && flag !== "yes") return false;
  return isIntegrationTraderConfigured();
}

function publishWxaAccountIdForDiscovery(accountId: string): void {
  if (!process.env.WATERX_E2E_WXA_ACCOUNT_ID?.trim()) {
    process.env.WATERX_E2E_WXA_ACCOUNT_ID = accountId;
    preflightLog(`set WATERX_E2E_WXA_ACCOUNT_ID=${accountId}`);
  }
}

async function seedPerpSlot(
  client: PerpClient,
  trader: Ed25519Keypair,
  owner: string,
  accountId: string,
  ticker: string,
  marketAtStart: IntegrationMarketSnapshotMap,
): Promise<E2ePreflightSlotResult> {
  const snap = marketAtStart[ticker];
  if (!snap) {
    return { status: "skipped", reason: `market snapshot missing for ${ticker}` };
  }
  try {
    assertMarketTickerTradeableSnapshot(snap, ticker);
  } catch (e) {
    return {
      status: "skipped",
      reason: e instanceof Error ? e.message : String(e),
    };
  }

  const openRows = await listAccountPositionsInMarket(client, accountId, ticker);
  if (openRows.length > 0) {
    return { status: "exists" };
  }

  const row = e2ePersistentPerpRow(ticker);
  const rowHint = lifecycleTickerRow(ticker);
  const usdcType = client.getPoolTokenType("USDCUSD");

  const { coins, totalBalance } = await selectWalletCoinsCoveringAmount(
    client,
    owner,
    usdcType,
    row.openCollateral,
  );
  if (totalBalance < row.openCollateral) {
    return {
      status: "skipped",
      reason: `wallet USDC ${totalBalance} < open collateral ${row.openCollateral}`,
    };
  }

  try {
    const result = await execBuiltTxWithCooldownRetriesOnClient(
      client,
      async () => {
        const tx = new Transaction();
        await refreshOraclePricesForTradingEdge(tx, client, [ticker]);
        const primary = tx.object(coins[0]!.objectId);
        if (coins.length > 1) {
          tx.mergeCoins(
            primary,
            coins.slice(1).map((c) => tx.object(c.objectId)),
          );
        }
        const collArg =
          totalBalance === row.openCollateral
            ? primary
            : tx.splitCoins(primary, [row.openCollateral])[0]!;
        if (totalBalance > row.openCollateral) {
          tx.transferObjects([primary], owner);
        }
        openPositionByKeeper(client, tx, {
          ticker,
          accountObjectAddress: accountId,
          collateralType: usdcType,
          collateralCoin: collArg,
          isLong: row.isLong,
          size: row.openSize,
          acceptablePrice: keeperOpenAcceptablePrice(row.isLong, rowHint),
        });
        return tx;
      },
      trader,
      { cooldownTickers: [ticker], gasBudget: integrationGasBudget("keeper") },
    );
    assertIntegrationTxSuccess(result);
    const after = await listAccountPositionsInMarket(client, accountId, ticker);
    if (after.length === 0) {
      return { status: "skipped", reason: "keeper open tx succeeded but no position visible" };
    }
    return { status: "opened" };
  } catch (e) {
    const kind = classifyPreflightTxError(e);
    const detail = e instanceof Error ? e.message.split("\n")[0] : String(e);
    if (kind === "oracle") {
      return { status: "skipped", reason: `oracle transient: ${detail}` };
    }
    if (kind === "sui") {
      return { status: "skipped", reason: `insufficient SUI for gas: ${detail}` };
    }
    throw e;
  }
}

async function seedWlp(
  client: PerpClient,
  trader: Ed25519Keypair,
  owner: string,
  accountId: string,
): Promise<E2ePreflightReport["wlp"]> {
  const wlpType = client.wlpType();
  const usdcType = client.getPoolTokenType("USDCUSD");
  const { minBalanceRaw, mintPullUsdc } = E2E_PERSISTENT_WLP;

  const wlpBal = await getAccountBalance(client, accountId, wlpType);
  if (wlpBal >= minBalanceRaw) {
    return { status: "ok" };
  }

  try {
    let usdcFree = await getAccountBalance(client, accountId, usdcType);
    const needFree = mintPullUsdc + 5_000_000n;
    if (usdcFree < needFree) {
      const need = needFree - usdcFree;
      const depTx = await buildDepositUsdcFromWalletTx(client, owner, accountId, need);
      const depResult = await execTxOnClient(client, depTx, trader, {
        gasBudget: integrationGasBudget("default"),
      });
      assertIntegrationTxSuccess(depResult);
      usdcFree = await getAccountBalance(client, accountId, usdcType);
    }
    if (usdcFree < mintPullUsdc) {
      return {
        status: "skipped",
        reason: `wxa USDC ${usdcFree} < mint pull ${mintPullUsdc}`,
      };
    }

    const mintResult = await execBuiltTxWithCooldownRetriesOnClient(
      client,
      () =>
        buildMintWlpTx(client, {
          accountId,
          depositTokenType: usdcType,
          depositTicker: "USDCUSD",
          depositAmount: mintPullUsdc,
          minLpAmount: 1n,
          skipOraclePriceRefresh: false,
        }),
      trader,
      { gasBudget: integrationGasBudget("wlp") },
    );
    assertIntegrationTxSuccess(mintResult);
    return { status: "minted" };
  } catch (e) {
    const kind = classifyPreflightTxError(e);
    const detail = e instanceof Error ? e.message.split("\n")[0] : String(e);
    if (kind === "oracle") {
      return { status: "skipped", reason: `oracle transient: ${detail}` };
    }
    if (kind === "sui") {
      return { status: "skipped", reason: `insufficient SUI for gas: ${detail}` };
    }
    throw e;
  }
}

async function seedPendingRedeem(
  client: PerpClient,
  trader: Ed25519Keypair,
  accountId: string,
  wlpSeed: E2ePreflightReport["wlp"],
): Promise<E2ePreflightReport["redeem"]> {
  const redeemFlag = process.env.WATERX_E2E_PREFLIGHT_REDEEM?.trim().toLowerCase();
  if (redeemFlag === "0" || redeemFlag === "false" || redeemFlag === "off") {
    return { status: "skipped", reason: "WATERX_E2E_PREFLIGHT_REDEEM disabled" };
  }
  if (wlpSeed.status === "skipped") {
    return { status: "skipped", reason: `WLP seed skipped: ${wlpSeed.reason}` };
  }

  const wlpType = client.wlpType();
  const wlpBal = await getAccountBalance(client, accountId, wlpType);
  const { lpAmount } = E2E_PERSISTENT_REDEEM;
  if (wlpBal < lpAmount) {
    return {
      status: "skipped",
      reason: `wxa WLP ${wlpBal} < redeem enqueue ${lpAmount}`,
    };
  }

  const existing = await findPendingRedeemForAccount(client, accountId);
  if (existing) {
    return { status: "ok" };
  }

  let usdcType: string;
  try {
    usdcType = client.getPoolTokenType("USDCUSD");
  } catch (e) {
    return {
      status: "skipped",
      reason: e instanceof Error ? e.message : String(e),
    };
  }

  try {
    const result = await execBuiltTxWithCooldownRetriesOnClient(
      client,
      async () => {
        const tx = new Transaction();
        await refreshOraclePricesForTradingEdge(tx, client, ["USDCUSD"]);
        requestRedeemWlp(client, tx, {
          accountId,
          redeemTokenType: usdcType,
          lpAmount,
        });
        return tx;
      },
      trader,
      { gasBudget: integrationGasBudget("wlp") },
    );
    assertIntegrationTxSuccess(result);

    const row = await findPendingRedeemForAccount(client, accountId);
    if (!row) {
      return {
        status: "skipped",
        reason: "requestRedeemWlp tx ok but no queue row for wxa account",
      };
    }
    return { status: "requested", requestId: row.requestId.toString() };
  } catch (e) {
    const kind = classifyPreflightTxError(e);
    const detail = e instanceof Error ? e.message.split("\n")[0] : String(e);
    if (kind === "oracle") {
      return { status: "skipped", reason: `oracle transient: ${detail}` };
    }
    if (kind === "sui") {
      return { status: "skipped", reason: `insufficient SUI for gas: ${detail}` };
    }
    throw e;
  }
}

async function seedCreditIfConfigured(
  client: PerpClient,
  trader: Ed25519Keypair,
  owner: string,
  accountId: string,
): Promise<E2ePreflightReport["credit"]> {
  if (!isCreditPipelineConfigured(client)) {
    return { status: "skipped", reason: "credit pipeline not in deployment config" };
  }
  const creditFlag = process.env.WATERX_E2E_PREFLIGHT_CREDIT?.trim().toLowerCase();
  if (creditFlag === "0" || creditFlag === "false" || creditFlag === "off") {
    return { status: "skipped", reason: "WATERX_E2E_PREFLIGHT_CREDIT disabled" };
  }

  const creditType = client.creditType();
  const before = await getAccountBalance(client, accountId, creditType);
  const minCredit = 2_000n;
  if (before >= minCredit) {
    return { status: "ok" };
  }

  try {
    await ensureIntegrationMinCreditBalance({
      client,
      trader,
      owner,
      accountId,
      minCredit,
      execTx: (tx, signer, opts) => execTxOnClient(client, tx, signer, opts),
      assertSuccess: assertIntegrationTxSuccess,
    });
    return { status: "minted" };
  } catch (e) {
    const kind = classifyPreflightTxError(e);
    const detail = e instanceof Error ? e.message.split("\n")[0] : String(e);
    if (kind === "sui") {
      return { status: "skipped", reason: `insufficient SUI for gas: ${detail}` };
    }
    return { status: "skipped", reason: detail };
  }
}

/**
 * Idempotent keeper opens + wxa WLP mint (same as integration persistent-state test).
 * Never throws for expected resource skips — returns a report and logs warnings.
 */
export async function runE2ePersistentPreflight(client: PerpClient): Promise<E2ePreflightReport> {
  const trader = loadIntegrationTraderKeypair();
  const owner = trader.getPublicKey().toSuiAddress();
  const execTx = (tx: Transaction, signer: Ed25519Keypair, opts?: { gasBudget?: number }) =>
    execTxOnClient(client, tx, signer, opts);

  const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);
  publishWxaAccountIdForDiscovery(accountId);

  const configuredTickers = e2ePersistentPerpTickersForClient(
    client.config.packages.waterx_perp.markets ?? {},
  );
  const marketAtStart = await fetchIntegrationMarketSummaries(client, configuredTickers);

  const perpSlots: Record<string, E2ePreflightSlotResult> = {};
  const warnings: string[] = [];

  for (const ticker of activeE2ePersistentPerpTickers()) {
    if (!configuredTickers.includes(ticker)) {
      perpSlots[ticker] = { status: "skipped", reason: "ticker not on deployment" };
      continue;
    }
    const slot = await seedPerpSlot(client, trader, owner, accountId, ticker, marketAtStart);
    perpSlots[ticker] = slot;
    if (slot.status === "opened") {
      preflightLog(`${ticker}: keeper opened position`);
    } else if (slot.status === "exists") {
      preflightLog(`${ticker}: position already open`);
    } else {
      warnings.push(`${ticker}: ${slot.reason}`);
      preflightLog(`${ticker}: skipped (${slot.reason})`);
    }
  }

  const wlp = await seedWlp(client, trader, owner, accountId);
  if (wlp.status === "minted") preflightLog("wxa WLP minted");
  else if (wlp.status === "ok") preflightLog("wxa WLP balance ok");
  else {
    warnings.push(`WLP: ${wlp.reason}`);
    preflightLog(`WLP: skipped (${wlp.reason})`);
  }

  const redeem = await seedPendingRedeem(client, trader, accountId, wlp);
  if (redeem.status === "requested") {
    preflightLog(`wxa pending redeem enqueued (requestId=${redeem.requestId})`);
  } else if (redeem.status === "ok") {
    preflightLog("wxa pending redeem already queued");
  } else {
    warnings.push(`redeem: ${redeem.reason}`);
    preflightLog(`redeem: skipped (${redeem.reason})`);
  }

  const credit = await seedCreditIfConfigured(client, trader, owner, accountId);
  if (credit.status === "minted") preflightLog("wxa CREDIT topped up");
  else if (credit.status === "ok") preflightLog("wxa CREDIT balance ok");
  else if (credit.status === "skipped") {
    preflightLog(`CREDIT: ${credit.reason}`);
  }

  return { accountId, owner, perpSlots, wlp, redeem, credit, warnings };
}

export async function runE2ePersistentPreflightIfNeeded(
  client: PerpClient,
): Promise<E2ePreflightReport | null> {
  if (!shouldRunE2ePersistentPreflight()) {
    return null;
  }
  preflightLog("starting (testnet + integration key)");
  try {
    return await runE2ePersistentPreflight(client);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[e2e preflight] aborted: ${msg}`);
    return null;
  }
}

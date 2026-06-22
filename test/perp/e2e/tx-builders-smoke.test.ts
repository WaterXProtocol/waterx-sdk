/**
 * E2E: dry-run a market-order place PTB (oracle refresh + request + execute),
 * the atomic mint+stake WLP PTB, and a custody collateral→CREDIT mint for every
 * vault asset (USDC + USDSUI on testnet, the real coins on mainnet).
 */
import { Transaction } from "@mysten/sui/transactions";
import { buildMintAndStakeWlpTx, buildPlaceOrderTx } from "@waterx/sdk";
import { describe, it } from "vitest";

import { mintCreditToAccount } from "../../../src/user/custody.ts";
import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";
import {
  assertSimulateReached,
  skipHermesIfFeedUnavailable,
} from "../helpers/e2e/simulate-assertions.ts";

const DUMMY_ACCOUNT = "0x0000000000000000000000000000000000000000000000000000000000000001";

/** Vault assets at module load (resolved client) — drives per-token cases below. */
const CUSTODY_ASSETS = client.config.packages.native_custody?.assets ?? [];

describe(`tx-builders smoke simulate (${e2eNetwork})`, () => {
  it("buildPlaceOrderTx simulates (market form)", async (ctx) => {
    const collateralType = client.getPoolTokenType("USDCUSD");
    let tx;
    try {
      tx = await buildPlaceOrderTx(client, {
        ticker: "BTCUSD",
        accountId: DUMMY_ACCOUNT,
        collateralType,
        collateralTicker: "USDCUSD",
        main: {
          isLong: true,
          isStopOrder: false,
          reduceOnly: false,
          size: rawPrice(0.0001),
          acceptablePrice: rawPrice(200_000),
          collateralAmount: 1_000_000n,
        },
        skipOraclePriceRefresh: false,
        useSponsor: true,
      });
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      throw e;
    }
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await client.simulate(tx);
    assertSimulateReached(sim);
  }, 120_000);

  it("buildMintAndStakeWlpTx simulates (mint WLP + stake in one PTB)", async (ctx) => {
    let tx;
    try {
      tx = await buildMintAndStakeWlpTx(client, {
        accountId: DUMMY_ACCOUNT,
        depositTokenType: client.getPoolTokenType("USDCUSD"),
        depositTicker: "USDCUSD",
        depositAmount: 1_000_000n,
        minLpAmount: 0n,
        // testnet WLP pool has no rewarders; defaults to client.getRewarderTypes("WLP").
        rewarderTypes: client.getRewarderTypes("WLP"),
      });
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      throw e;
    }
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await client.simulate(tx);
    // Reaches chain: a Move abort (e.g. dummy account holds no CREDIT) is still
    // proof the mint→stake PTB is well-formed and the type plumbing resolves.
    assertSimulateReached(sim);
  }, 120_000);

  // Custody collateral → USD CREDIT, one case per vault asset (USDC + USDSUI on
  // testnet MOCK coins, real coins on mainnet). `coin::zero` synthesises the
  // input coin so the test needs no funded wallet — it only verifies the
  // per-asset type plumbing reaches chain simulate.
  if (CUSTODY_ASSETS.length === 0) {
    it.skip("mintCreditToAccount per vault asset (native_custody not deployed)", () => {});
  } else {
    it.each(CUSTODY_ASSETS.map((a) => ({ label: a.name ?? a.type, type: a.type })))(
      "mintCreditToAccount simulates for $label",
      async ({ type }) => {
        const tx = new Transaction();
        const zeroCoin = tx.moveCall({ target: "0x2::coin::zero", typeArguments: [type] });
        mintCreditToAccount(client, tx, {
          accountId: DUMMY_ACCOUNT,
          assetCoin: zeroCoin,
          assetType: type,
        });
        tx.setSender(DUMMY_ACCOUNT);
        const sim = await client.simulate(tx);
        assertSimulateReached(sim);
      },
      120_000,
    );
  }
});

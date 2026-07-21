/**
 * Mint WLP from the USD balance already sitting in your wxa account.
 *
 * Flow (single PTB):
 *   1. refreshOraclePrices(["USDCUSD"])   — Hermes + Pyth update + oracle aggregate
 *   2. lp_pool::mint_wlp<WLP, USD>        — burn `DEPOSIT_AMOUNT` USD from wxa, mint WLP into wxa
 *
 * Required env:
 *   WATERX_SMOKE_ACCOUNT_ID    wxa account id (must already hold ≥ DEPOSIT_AMOUNT USD)
 *
 * Optional env:
 *   DEPOSIT_AMOUNT             raw USD units to deposit (default 1_000_000 = 1 USD; pool min_deposit = 1_000_000)
 *   MIN_LP_AMOUNT              slippage floor in raw WLP units (default 0)
 *   EXECUTE=1                  actually sign + execute (otherwise simulate only)
 *
 * Run:
 *   WATERX_SMOKE_ACCOUNT_ID=0x… pnpm exec tsx scripts/deposit-to-wlp.ts
 *   WATERX_SMOKE_ACCOUNT_ID=0x… EXECUTE=1 pnpm exec tsx scripts/deposit-to-wlp.ts
 */
import { fromBase64 } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import {
  allowProtocolAsset,
  isProtocolAssetAllowed,
} from "../src/generated/waterx_account/account.ts";
import { setPriceRefreshThresholdMs } from "../src/generated/waterx_perp/global_config.ts";
import { aggregateTickerWithPyth, refreshOraclePrices } from "../src/oracle/index.ts";
import { PerpClient } from "../src/perp/client.ts";
import { DRY_RUN_SENDER } from "../src/perp/constants.ts";
import { getAccountBalance, getGlobalConfigData } from "../src/perp/fetch.ts";
import { mintWlp, updateTokenValue } from "../src/perp/user/wlp.ts";
import { loadRepoEnvFiles, waterxConfigUrlFromEnv } from "./load-repo-env.ts";
import { loadActiveKeypair, resolveActiveAddress } from "./load-signer.ts";

async function isUsdAllowed(
  client: PerpClient,
  registry: string,
  perpWitness: string,
  usdType: string,
): Promise<boolean> {
  const tx = new Transaction();
  isProtocolAssetAllowed({
    package: client.config.packages.waterx_account.published_at,
    arguments: { registry: tx.object(registry) },
    typeArguments: [perpWitness, usdType],
  })(tx);
  tx.setSender(DRY_RUN_SENDER);
  const sim = (await client.simulate(tx)) as {
    $kind?: string;
    FailedTransaction?: { status?: { error?: { message?: string } } };
    commandResults?: { returnValues?: { bcs?: Uint8Array | string }[] }[];
  };
  if (sim.$kind === "FailedTransaction") {
    throw new Error(
      `is_protocol_asset_allowed simulate failed: ${sim.FailedTransaction?.status?.error?.message ?? "(no msg)"}`,
    );
  }
  const b = sim.commandResults?.[0]?.returnValues?.[0]?.bcs;
  if (!b) throw new Error("is_protocol_asset_allowed returned no value");
  const bytes = typeof b === "string" ? fromBase64(b) : b;
  return bcs.bool().parse(bytes);
}

async function getOwner(client: PerpClient, objectId: string): Promise<string | undefined> {
  const r = (await client.grpcClient.getObject({ objectId })) as {
    object?: { owner?: { AddressOwner?: string } };
  };
  return r.object?.owner?.AddressOwner;
}

async function getPriceRefreshThresholdMs(client: PerpClient): Promise<bigint> {
  const cfg = await getGlobalConfigData(client);
  return BigInt(cfg.price_refresh_threshold_ms);
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const address = resolveActiveAddress();

  const accountId = process.env.WATERX_SMOKE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error(
      "deposit-to-wlp: WATERX_SMOKE_ACCOUNT_ID is required. " +
        "Run scripts/create-wxa-account.ts first.",
    );
  }
  const depositAmount = BigInt(process.env.DEPOSIT_AMOUNT ?? "1000000");
  const minLpAmount = BigInt(process.env.MIN_LP_AMOUNT ?? "0");
  const doExecute = process.env.EXECUTE === "1";
  // Keystore (secret) only needed to broadcast — dry runs stay address-only.
  const keypair = doExecute ? loadActiveKeypair().keypair : null;
  // SKIP_PRICE_UPDATE=1 mints without refreshing the oracle / bumping
  // TokenPoolInfo.value_usd — relies on the pool prices already being fresh
  // within price_refresh_threshold_ms. Mirrors buildMintWlpTx's
  // `skipOraclePriceRefresh: true`.
  const skipPriceUpdate = process.env.SKIP_PRICE_UPDATE === "1";

  const client = await PerpClient.create("TESTNET", {
    cache: true,
    waterxConfigUrl: waterxConfigUrlFromEnv(),
  });

  const usdType = client.creditType();
  const wlpType = client.wlpType();
  const ticker = "USDCUSD"; // WLP pool's only token's ticker (lp_pool.TokenPoolInfo.ticker)

  console.log(`sender:        ${address}`);
  console.log(`account:       ${accountId}`);
  console.log(`wlp_pool:      ${client.config.packages.wlp.wlp_pool}`);
  console.log(`wlp_aum:       ${client.config.packages.wlp.wlp_aum}`);
  console.log(`deposit token: ${usdType}`);
  console.log(`lp token:      ${wlpType}`);
  console.log(`deposit raw:   ${depositAmount} (USD, 6 dec)`);
  console.log(`min lp raw:    ${minLpAmount}`);
  console.log(`price update:  ${skipPriceUpdate ? "SKIPPED" : "refresh + updateTokenValue"}`);
  console.log(`mode:          ${doExecute ? "SIM + EXECUTE" : "SIM only"}`);

  const usdBalance = await getAccountBalance(client, accountId, usdType);
  console.log(`wxa USD bal:   ${usdBalance}`);
  if (usdBalance < depositAmount) {
    throw new Error(
      `deposit-to-wlp: wxa USD balance ${usdBalance} < deposit ${depositAmount}. ` +
        `Run scripts/mint-usd-from-collateral.ts first (or lower DEPOSIT_AMOUNT).`,
    );
  }

  // Precheck: WaterXPerp must be allowed to `take<USD>` from the wxa account.
  // On this testnet deployment the registry whitelist started with MOCK_USDC
  // only; USD has to be added via the admin AdminCap before mint_wlp works.
  const perpWitness = `${client.config.packages.waterx_perp.original_id}::account_data::WaterXPerp`;
  const wxaRegistry = client.config.packages.waterx_account.account_registry;
  const allowed = await isUsdAllowed(client, wxaRegistry, perpWitness, usdType);
  console.log(`USD allowed:   ${allowed}`);

  if (!allowed) {
    const adminCap = client.config.packages.waterx_account.admin_cap;
    if (!adminCap) throw new Error("waterx_account.admin_cap not in config");
    const owner = await getOwner(client, adminCap);
    if (owner !== address) {
      throw new Error(
        `USD is not whitelisted for WaterXPerp and AdminCap owner ${owner} != sender ${address}`,
      );
    }
    console.log(`granting WaterXPerp ← allow_protocol_asset<USD> via AdminCap ${adminCap}…`);
    const grantTx = new Transaction();
    allowProtocolAsset({
      package: client.config.packages.waterx_account.published_at,
      arguments: { registry: grantTx.object(wxaRegistry), _: grantTx.object(adminCap) },
      typeArguments: [perpWitness, usdType],
    })(grantTx);
    grantTx.setSender(address);
    if (!doExecute) {
      const grantSim = (await client.simulate(grantTx)) as {
        $kind?: string;
        FailedTransaction?: { status?: { error?: { message?: string } } };
      };
      if (grantSim.$kind === "FailedTransaction") {
        const msg = grantSim.FailedTransaction?.status?.error?.message ?? "(no msg)";
        throw new Error(`grant simulate aborted: ${msg}`);
      }
      console.log("  ✓ grant simulate ok (will be executed when EXECUTE=1)");
    } else {
      const gr = (await client.signAndExecuteTransaction({
        signer: keypair!,
        transaction: grantTx,
      })) as {
        Transaction?: { digest?: string; status?: { success?: boolean; error?: string | null } };
      };
      const gd = gr.Transaction?.digest ?? "";
      const ok = gr.Transaction?.status?.success === true;
      if (!ok) throw new Error(`grant failed: ${gr.Transaction?.status?.error ?? ""} ${gd}`);
      console.log(`  ✓ grant executed  digest=${gd}`);
      await client.grpcClient.waitForTransaction({ digest: gd, timeout: 30_000 }).catch(() => {});
    }
  }

  // Precheck 2: this testnet's WlpPool has WLP itself registered as a
  // TokenPoolInfo with empty ticker, so its `last_price_refresh_timestamp`
  // can never be refreshed via oracle. mint_wlp's `assert_prices_fresh`
  // loops over every TokenPoolInfo and fails the moment any entry's stale
  // delta > price_refresh_threshold_ms. Bump the threshold via the perp
  // AdminCap so the unrefreshable WLP entry stops aborting.
  const globalConfigId = client.config.packages.waterx_perp.global_config;
  const perpAdminCap = client.config.packages.waterx_perp.admin_cap;
  const currentThreshold = await getPriceRefreshThresholdMs(client);
  const TARGET_THRESHOLD_MS = 7n * 24n * 3600n * 1000n; // 7 days
  console.log(`refresh threshold: ${currentThreshold} ms`);
  if (currentThreshold < TARGET_THRESHOLD_MS) {
    if (!perpAdminCap) throw new Error("waterx_perp.admin_cap not in config");
    const adminOwner = await getOwner(client, perpAdminCap);
    if (adminOwner !== address) {
      throw new Error(
        `price_refresh_threshold_ms=${currentThreshold} < ${TARGET_THRESHOLD_MS}; perp AdminCap owner ${adminOwner} != sender`,
      );
    }
    console.log(`bumping price_refresh_threshold_ms → ${TARGET_THRESHOLD_MS} via perp AdminCap…`);
    const bumpTx = new Transaction();
    setPriceRefreshThresholdMs({
      package: client.config.packages.waterx_perp.published_at,
      arguments: {
        globalConfig: bumpTx.object(globalConfigId),
        _: bumpTx.object(perpAdminCap),
        v: TARGET_THRESHOLD_MS,
      },
    })(bumpTx);
    bumpTx.setSender(address);
    if (!doExecute) {
      const s = (await client.simulate(bumpTx)) as {
        $kind?: string;
        FailedTransaction?: { status?: { error?: { message?: string } } };
      };
      if (s.$kind === "FailedTransaction") {
        throw new Error(
          `bump threshold simulate aborted: ${s.FailedTransaction?.status?.error?.message ?? ""}`,
        );
      }
      console.log("  ✓ bump simulate ok (will execute when EXECUTE=1)");
    } else {
      const br = (await client.signAndExecuteTransaction({
        signer: keypair!,
        transaction: bumpTx,
      })) as {
        Transaction?: { digest?: string; status?: { success?: boolean; error?: string | null } };
      };
      const bd = br.Transaction?.digest ?? "";
      if (br.Transaction?.status?.success !== true) {
        throw new Error(`bump failed: ${br.Transaction?.status?.error ?? ""} ${bd}`);
      }
      console.log(`  ✓ bump executed  digest=${bd}`);
      await client.grpcClient.waitForTransaction({ digest: bd, timeout: 30_000 }).catch(() => {});
    }
  }

  const tx = new Transaction();
  if (skipPriceUpdate) {
    // "Don't update the price": skip the Hermes fetch + on-chain Pyth push
    // (updatePythPrices) and the TokenPoolInfo.value_usd bump. mint_wlp still
    // calls oracle::get_price, which aborts EStalePrice unless oracle::aggregate
    // ran THIS PTB — so we re-aggregate the price already sitting on-chain.
    // Only works while that on-chain Pyth price is within pyth_rule tolerance.
    const feed = client.getPythFeed(ticker);
    aggregateTickerWithPyth(tx, client, {
      ticker,
      priceInfoObjectId: feed.price_info_object,
    });
  } else {
    // Standalone dev script, no TradingRequest to reimburse a sponsor fund
    // against — pay the Pyth update fee from tx.gas.
    await refreshOraclePrices(tx, client, [ticker], { feeSource: { kind: "gas" } });
    // Push the freshly-aggregated oracle price into TokenPoolInfo.value_usd /
    // last_price_refresh_timestamp so lp_pool::assert_prices_fresh accepts it.
    updateTokenValue(client, tx, { tokenType: usdType });
  }
  mintWlp(client, tx, {
    accountId,
    depositTokenType: usdType,
    depositAmount,
    minLpAmount,
  });
  tx.setSender(address);

  console.log("\nsimulating…");
  const sim = (await client.simulate(tx)) as {
    $kind?: string;
    FailedTransaction?: { status?: { error?: { message?: string } } };
  };
  if (sim.$kind === "FailedTransaction") {
    const msg = sim.FailedTransaction?.status?.error?.message ?? "(no msg)";
    throw new Error(`simulate aborted: ${msg}`);
  }
  console.log("  ✓ simulate ok");

  if (!doExecute) {
    console.log("\nEXECUTE != 1 — stopping after simulate. Set EXECUTE=1 to broadcast.");
    return;
  }

  console.log("\nexecuting…");
  const r = (await client.signAndExecuteTransaction({
    signer: keypair!,
    transaction: tx,
  })) as {
    Transaction?: { digest?: string; status?: { success?: boolean; error?: string | null } };
  };
  const digest = r.Transaction?.digest ?? "";
  const success = r.Transaction?.status?.success === true;
  if (!success) {
    throw new Error(`execute failed: ${r.Transaction?.status?.error ?? "(no error)"} ${digest}`);
  }
  console.log(`  ✓ executed  digest=${digest}`);
  await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 }).catch(() => {});

  const usdAfter = await getAccountBalance(client, accountId, usdType);
  const wlpAfter = await getAccountBalance(client, accountId, wlpType);
  console.log(`\nwxa USD after: ${usdAfter}  (Δ ${usdAfter - usdBalance})`);
  console.log(`wxa WLP after: ${wlpAfter}`);
  console.log(`tx: https://suiscan.xyz/testnet/tx/${digest}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

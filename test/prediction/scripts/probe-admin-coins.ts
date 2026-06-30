/**
 * Developer CLI — prints the AdminCap holder address plus settlement / MOCK_USDC / SUI coins.
 *
 * Useful when `depositSettlement` / `adminPlaceOrderFor` E2E tests skip — admin PTBs need
 * `Coin<::usd::USD>`, not MOCK_USDC (use account E2E for PSM deposit coverage).
 *
 *   pnpm exec tsx test/prediction/scripts/probe-admin-coins.ts
 */
import { resolveMockUsdcCoinType } from "~predict-tests/helpers/account-funding.ts";
import { createE2eClient } from "~predict-tests/helpers/e2e-context.ts";
import {
  discoverBestWalletCoin,
  E2E_WALLET_COIN_MIN_BALANCE,
} from "~predict-tests/helpers/wallet-coin-discovery.ts";

async function main() {
  const client = await createE2eClient();
  const cap = client.predictionAdminCap();

  const capObj = await client.grpcClient.getObject({ objectId: cap });
  const owner = capObj.object?.owner;
  if (!owner || owner.$kind !== "AddressOwner") {
    console.error("AdminCap is not addressed-owned:", owner);
    return;
  }
  const adminAddr = owner.AddressOwner;
  console.log("AdminCap holder:", adminAddr);
  console.log("settlement coin type (admin PTB payment):", client.settlementCoinType());
  console.log("MOCK_USDC type (PSM backing, not admin payment):", resolveMockUsdcCoinType(client));

  const walletCoin = await discoverBestWalletCoin(client, adminAddr, E2E_WALLET_COIN_MIN_BALANCE);
  console.log(
    "discovered wallet coin:",
    walletCoin
      ? {
          objectId: walletCoin.objectId,
          source: walletCoin.source,
          balance: walletCoin.balance.toString(),
        }
      : null,
  );
  console.log(
    "adminUsdCoinObjectId (settlement USD only):",
    walletCoin && walletCoin.source !== "mock-usdc" ? walletCoin.objectId : null,
  );

  const sui = await client.listCoins({ owner: adminAddr, coinType: "0x2::sui::SUI" });
  console.log(
    "Admin's SUI coins:",
    JSON.stringify(sui, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

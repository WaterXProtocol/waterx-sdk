/**
 * Developer CLI — prints the AdminCap holder address plus its USD and SUI coin objects.
 *
 * Useful when the `depositSettlement` / `adminPlaceOrderFor` E2E tests skip with
 * "AdminCap holder has no settlement coin" — confirm whether a USD transfer landed.
 *
 *   pnpm exec tsx scripts/probe-admin-coins.ts
 */
import { createE2eClient } from "~predict-tests/helpers/e2e-context.ts";

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

  const usd = await client.listCoins({
    owner: adminAddr,
    coinType: client.settlementCoinType(),
  });
  console.log(
    "Admin's USD coins:",
    JSON.stringify(usd, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2),
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

/**
 * E2e simulate tests that need multiple TTO USDC {@link CoinForReceiving} refs in one PTB cannot
 * use a single on-account coin: the remainder after `open_position_request` is created mid-tx and
 * is not addressable via static `receivingRef` for a second op. When the account has fewer funded
 * coins than required, we optionally run the same wallet→account split deposit as `pnpm e2e:prepare`
 * (requires integration signer = {@link INTEGRATION_REFERENCE_WALLET_ADDRESS}).
 */
import { getAccountCoins } from "@waterx/perp-sdk";

import type { WaterXClient } from "../../src/client.ts";
import { buildDepositUsdcFromWalletTx } from "../integration/helpers/account-bootstrap.ts";
import {
  assertSuccess,
  execTx,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../integration/setup.ts";
import { INTEGRATION_REFERENCE_WALLET_ADDRESS } from "./integration-reference-wallet.ts";

export type FundedTtoCoin = {
  objectId: string;
  version: bigint;
  digest: string;
};

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
}

type VitestSkipCtx = { skip: (reason?: string) => void };

/**
 * Ensures at least `needCount` on-account USDC coins with balance ≥ `minBalancePerCoin` each.
 * When short and integration key is configured for the reference wallet, submits split deposits from
 * the wallet (mutates testnet state).
 */
export async function ensureAtLeastFundedTtoUsdcCoinsForSimulate(opts: {
  ctx: VitestSkipCtx;
  client: WaterXClient;
  accountId: string;
  usdcType: string;
  minBalancePerCoin: bigint;
  needCount: number;
}): Promise<FundedTtoCoin[] | null> {
  const { ctx, client, accountId, usdcType, minBalancePerCoin, needCount } = opts;

  async function listFunded(): Promise<FundedTtoCoin[]> {
    const usdcCoins = await getAccountCoins(client, accountId, usdcType);
    return usdcCoins
      .filter((c) => BigInt(c.balance) >= minBalancePerCoin)
      .map((c) => ({ objectId: c.objectId, version: BigInt(c.version), digest: c.digest }));
  }

  let funded = await listFunded();
  let attempts = 0;
  while (funded.length < needCount) {
    if (!isIntegrationTraderConfigured()) {
      ctx.skip(
        `Need ${needCount} TTO USDC coins with balance ≥ ${minBalancePerCoin} each (have ${funded.length}). ` +
          `Set WATERX_INTEGRATION_PRIVATE_KEY (reference wallet) to auto-split from wallet, or run \`pnpm e2e:prepare\`.`,
      );
      return null;
    }

    const kp = loadIntegrationTraderKeypair();
    const signerAddr = kp.getPublicKey().toSuiAddress();
    if (normAddr(signerAddr) !== normAddr(INTEGRATION_REFERENCE_WALLET_ADDRESS)) {
      ctx.skip(
        `Integration signer ${signerAddr} does not match INTEGRATION_REFERENCE_WALLET_ADDRESS; ` +
          `e2e simulate auto-split only runs for the reference wallet key.`,
      );
      return null;
    }

    if (attempts++ > 10) {
      ctx.skip(
        `Still have ${funded.length} funded TTO USDC coins after repeated deposit splits; ` +
          `fund the integration wallet with USDC or run \`pnpm e2e:prepare\`.`,
      );
      return null;
    }

    try {
      const tx = await buildDepositUsdcFromWalletTx(
        client,
        signerAddr,
        accountId,
        minBalancePerCoin,
      );
      const r = await execTx(tx, kp, { gasBudget: 80_000_000 });
      assertSuccess(r);
    } catch (e) {
      ctx.skip(
        `Auto-split deposit failed while ensuring ${needCount} TTO coins (have ${funded.length}): ` +
          `${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }

    funded = await listFunded();
  }

  return funded.slice(0, needCount);
}

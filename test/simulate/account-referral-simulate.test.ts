/** E2E: account/delegate/referral SDK wrappers (simulate only). */
import { Transaction } from "@mysten/sui/transactions";
import {
  addDelegate,
  createAccount,
  getAccountCoins,
  receiveCoin,
  removeDelegate,
  setReferralCode,
  transferToAccount,
  updateDelegatePermissions,
} from "@waterx/perp-sdk";
import { beforeAll, describe, it } from "vitest";

import { discoverActivePosition } from "../helpers/e2e/discover-on-chain-position.ts";
import { client } from "../helpers/e2e/e2e-client.ts";
import { activeLifecycleTestBases } from "../helpers/e2e/lifecycle-test-markets.ts";
import { assertSimulateSuccess } from "../helpers/e2e/simulate-assertions.ts";

let probe: { accountId: string; owner: string } | null = null;

beforeAll(async () => {
  for (const base of activeLifecycleTestBases()) {
    let d = await discoverActivePosition(client, base, {
      minAccountUsdcBalance: 500_000n,
      maxPages: 24,
      requireCooldownElapsed: false,
    });
    if (!d) {
      d = await discoverActivePosition(client, base, {
        maxPages: 24,
        requireCooldownElapsed: false,
      });
    }
    if (d) {
      probe = { accountId: d.accountObjectAddress, owner: d.ownerAddress };
      break;
    }
  }
}, 180_000);

function requireProbe(ctx: { skip: (reason?: string) => void }): {
  accountId: string;
  owner: string;
} {
  if (!probe) {
    ctx.skip("No discovery probe (open position on any lifecycle market).");
    return null as never;
  }
  return probe;
}

function randomCode(prefix = "e2e"): string {
  return `${prefix}${Date.now().toString(36).slice(-6)}`;
}

describe("account / delegate / referral wrappers (simulate)", () => {
  it("createAccount wrapper", async (ctx) => {
    const { owner } = requireProbe(ctx);
    const tx = new Transaction();
    tx.setSender(owner);
    tx.setGasBudget(120_000_000);
    createAccount(client, tx, `sim-${Date.now().toString(36).slice(-5)}`);
    const result = await client.simulate(tx);
    assertSimulateSuccess(result, 1, { transaction: tx });
  }, 60_000);

  it("add/update/remove delegate wrappers in one PTB", async (ctx) => {
    const { accountId, owner } = requireProbe(ctx);
    const delegate = "0x1111111111111111111111111111111111111111111111111111111111111111";

    const tx = new Transaction();
    tx.setSender(owner);
    tx.setGasBudget(150_000_000);

    addDelegate(client, tx, {
      accountObjectAddress: accountId,
      delegate,
      permissions: 63,
    });
    updateDelegatePermissions(client, tx, {
      accountObjectAddress: accountId,
      delegate,
      newPermissions: 127,
    });
    removeDelegate(client, tx, {
      accountObjectAddress: accountId,
      delegate,
    });

    const result = await client.simulate(tx);
    assertSimulateSuccess(result, 3, { transaction: tx });
  }, 60_000);

  it("transferToAccount + receiveCoin wrappers", async (ctx) => {
    const { accountId, owner } = requireProbe(ctx);
    const usdcType = client.config.collaterals.USDC.type;

    const walletUsdc = await client.listCoins({
      owner,
      coinType: usdcType,
    });
    if (!walletUsdc.objects.length) {
      ctx.skip(`No wallet-level USDC at discovery owner.`);
      return;
    }

    const accountUsdc = await getAccountCoins(client, accountId, usdcType);
    if (!accountUsdc.length) {
      ctx.skip("No account-level USDC coin available for receiveCoin wrapper.");
      return;
    }
    const recv = accountUsdc[0]!;

    const tx = new Transaction();
    tx.setSender(owner);
    tx.setGasBudget(200_000_000);

    transferToAccount(client, tx, {
      accountObjectAddress: accountId,
      coin: walletUsdc.objects[0]!.objectId,
      coinType: usdcType,
    });

    const received = receiveCoin(client, tx, {
      accountObjectAddress: accountId,
      coins: [{ objectId: recv.objectId, version: recv.version, digest: recv.digest }],
      coinType: usdcType,
    });
    tx.transferObjects([received], owner);

    const result = await client.simulate(tx);
    assertSimulateSuccess(result, 2, { transaction: tx });
  }, 60_000);

  it("setReferralCode wrapper", async (ctx) => {
    const { owner } = requireProbe(ctx);
    const tx = new Transaction();
    tx.setSender(owner);
    tx.setGasBudget(80_000_000);
    setReferralCode(client, tx, { code: randomCode() });
    const result = await client.simulate(tx);
    assertSimulateSuccess(result, 1, { transaction: tx });
  }, 60_000);
});

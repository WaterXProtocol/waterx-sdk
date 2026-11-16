/** Opt-in real-chain contract integration, NOT automatic Broker/venue end-to-end coverage. */
import { randomUUID } from "node:crypto";
import { getAccountIds, getAllowedVersions, getRegistry, isKeeper } from "~predict/fetch.ts";
import { cancelOrder, claim, fillOrder, resolveMarket } from "~predict/prediction.ts";
import {
  getPositionSettlement,
  getVoucherAccount,
  placeOrderWithVoucher,
} from "~predict/voucher.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { VOUCHER_ASSETS } from "../fixtures/voucher-config.ts";
import { createE2eClient } from "../helpers/e2e-context.ts";
import { predictE2eNetwork } from "../helpers/e2e-network.ts";
import { loadOptionalKeeperSigner, loadSigner, optionalEnv } from "../helpers/env.ts";
import { expectEvent, expectNoEvent } from "../helpers/events.ts";
import { executeAndFetch } from "../helpers/integration-setup.ts";

const enabled = optionalEnv("E2E_VOUCHER_INTEGRATION") === "1";

describe.skipIf(!enabled)("Voucher lifecycle (real testnet; explicit opt-in)", () => {
  let client: Awaited<ReturnType<typeof createE2eClient>>;
  let owner: ReturnType<typeof loadSigner>;
  let keeper: ReturnType<typeof loadSigner>;
  let accountId: string;

  beforeAll(async () => {
    // Fail before any write; no automatic account funding, grants, or role/config mutations.
    expect(predictE2eNetwork).toBe("testnet");
    client = await createE2eClient();
    expect(client.network).toBe("TESTNET");
    const asset = optionalEnv("E2E_SETTLEMENT_ASSET") ?? "USD";
    if (!VOUCHER_ASSETS.some((entry) => entry === asset))
      throw new Error("Unsupported Voucher settlement asset");
    client.settlement = asset;
    owner = loadSigner();
    keeper = loadOptionalKeeperSigner() ?? owner;
    const configuredAccount = optionalEnv("E2E_ACCOUNT_ID");
    if (!configuredAccount)
      throw new Error("E2E_ACCOUNT_ID must identify an isolated, pre-funded Voucher account");
    accountId = configuredAccount;
    expect(await getAccountIds(client, { owner: owner.toSuiAddress() })).toContain(accountId);
    expect(await isKeeper(client, { keeper: keeper.toSuiAddress() })).toBe(true);
    expect(await getAllowedVersions(client)).toContain(8);
    const credit = await getVoucherAccount(client, { accountId });
    expect(credit.paused).toBe(false);
    expect(credit.reserved).toBe(0n);
    expect(credit.available).toBeGreaterThanOrEqual(40n);
    const registry = await getRegistry(client);
    expect(registry.balance - registry.minReserve).toBeGreaterThanOrEqual(15n);
  });

  it.each(["YES", "NO", "INVALID", "CANCEL"] as const)(
    "reserve → fill/settle or cancel: %s",
    async (outcome) => {
      const baseline = await getVoucherAccount(client, { accountId });
      expect(baseline.reserved).toBe(0n);
      const marketId = new TextEncoder().encode(`voucher-it-${randomUUID()}`);
      // Do not automatically resubmit an uncertain write. IDs come only from this tx's events.
      const send = (signer: typeof owner, build: Parameters<typeof executeAndFetch>[2]) =>
        executeAndFetch(client, signer, build, { maxAttempts: 1 });
      const placed = await send(owner, (tx) => {
        placeOrderWithVoucher(client, tx, {
          accountId,
          marketId,
          selection: "YES",
          maxSpend: 10n,
          minShares: 1n,
          priceCapBps: 10_000n,
          expiryTs: BigInt(Date.now() + 600_000),
        });
      });
      const orderId = BigInt(
        String(expectEvent(placed, "::events::VoucherOrderPlaced").json.order_id),
      );
      // Set while the order can still hold a reservation; cleared once it is cancelled or filled.
      let liveOrderId: bigint | undefined = orderId;
      try {
        expectEvent(placed, "::events::VoucherReserved", {
          order_id: orderId.toString(),
          amount: "10",
        });
        expect(await getVoucherAccount(client, { accountId })).toMatchObject({
          available: baseline.available - 10n,
          reserved: 10n,
        });

        if (outcome === "CANCEL") {
          const cancelled = await send(keeper, (tx) => {
            cancelOrder(client, tx, { orderId });
          });
          liveOrderId = undefined;
          expectEvent(cancelled, "::events::VoucherReleased", {
            order_id: orderId.toString(),
            amount: "10",
          });
          expectNoEvent(cancelled, "::events::VoucherPositionSettled");
          expect(await getVoucherAccount(client, { accountId })).toMatchObject({
            available: baseline.available,
            reserved: 0n,
          });
          return;
        }

        const filled = await send(keeper, (tx) => {
          fillOrder(client, tx, { orderId, filledShares: 15n, filledCost: 6n });
        });
        liveOrderId = undefined;
        const consumed = expectEvent(filled, "::events::VoucherConsumed", {
          order_id: orderId.toString(),
          amount: "6",
          released_amount: "4",
        });
        const positionId = BigInt(String(consumed.json.position_id));
        expect(await getVoucherAccount(client, { accountId })).toMatchObject({
          available: baseline.available - 6n,
          reserved: 0n,
        });
        await send(keeper, (tx) => {
          resolveMarket(client, tx, { marketId, outcome });
        });
        const gross = outcome === "YES" ? 15n : outcome === "INVALID" ? 6n : 0n;
        const cash = outcome === "YES" ? 9n : 0n;
        const refund = outcome === "INVALID" ? 6n : 0n;
        expect(await getPositionSettlement(client, { positionId })).toEqual({
          positionId,
          isVoucher: true,
          grossPayout: gross,
          cashPayout: cash,
          voucherRefund: refund,
        });
        const claimed = await send(owner, (tx) => {
          claim(client, tx, { positionId });
        });
        expectEvent(claimed, "::events::PositionClaimed", {
          position_id: positionId.toString(),
          payout: cash.toString(),
        });
        expectEvent(claimed, "::events::VoucherPositionSettled", {
          position_id: positionId.toString(),
          filled_cost: "6",
          gross_payout: gross.toString(),
          cash_paid: cash.toString(),
          voucher_returned: refund.toString(),
        });
        expect(await getVoucherAccount(client, { accountId })).toMatchObject({
          available: baseline.available - 6n + refund,
          reserved: 0n,
        });
      } finally {
        // Best effort: release a reservation a mid-test failure left behind, so the next case and the
        // next run still start from `reserved === 0n`. A cancel of an already-finalized order aborts.
        if (liveOrderId !== undefined) {
          const stale = liveOrderId;
          await send(keeper, (tx) => {
            cancelOrder(client, tx, { orderId: stale });
          }).catch(() => undefined);
        }
      }
    },
    360_000,
  );
});

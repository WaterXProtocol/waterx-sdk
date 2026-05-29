/**
 * E2E: wxa account + per-account positions / orders via view simulate.
 */
import { getAccountData, getAccountOrders, getAccountPositions } from "@waterx/perp-sdk";
import { beforeAll, describe, expect, it } from "vitest";

import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";
import type { FundedProbe } from "../helpers/e2e/e2e-funded-probe.ts";
import { loadFundedProbe } from "../helpers/e2e/e2e-funded-probe.ts";

describe(`read account (${e2eNetwork})`, () => {
  let probe: FundedProbe | null;

  beforeAll(async () => {
    probe = await loadFundedProbe(client);
  }, 180_000);

  it("getAccountData accepts simulate for discovered wxa account id", async () => {
    const id =
      probe?.accountId ?? "0x0000000000000000000000000000000000000000000000000000000000000001";
    const data = await getAccountData(client, id);
    expect(data === undefined || typeof data === "object").toBe(true);
  }, 90_000);

  it("getAccountPositions when funded probe resolves", async (ctx) => {
    const p = probe;
    if (!p) {
      ctx.skip("No funded probe account on chain");
      return;
    }
    const positions = await getAccountPositions(client, {
      ticker: "BTCUSD",
      accountObjectAddress: p.accountId,
      basePriceUsd: rawPrice(50_000),
      collateralPriceUsd: 1n,
    });
    expect(Array.isArray(positions)).toBe(true);
  }, 120_000);

  it("getAccountOrders when funded probe resolves", async (ctx) => {
    const p = probe;
    if (!p) {
      ctx.skip("No funded probe account on chain");
      return;
    }
    const orders = await getAccountOrders(client, {
      ticker: "BTCUSD",
      accountObjectAddress: p.accountId,
      basePriceUsd: rawPrice(50_000),
    });
    expect(Array.isArray(orders)).toBe(true);
  }, 120_000);
});

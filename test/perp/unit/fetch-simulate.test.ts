/**
 * Unit tests for fetch.ts — mocks `client.simulate` (no chain).
 */
import { toBase64 } from "@mysten/bcs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getGlobalConfigData } from "../../../src/fetch.ts";
import { GlobalConfigData } from "../../../src/generated/waterx_perp_view/view.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

describe("fetch simulate decode", () => {
  const client = createUnitTestClient();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getGlobalConfigData parses BCS from simulate", async () => {
    const payload = GlobalConfigData.serialize({
      allowed_versions: [1],
      keeper_addresses: [],
      redeem_operator_addresses: [],
      protocol_fee_share_bps: 100n,
      liquidator_fee_bps: 50n,
      insurance_fee_bps: 25n,
      max_skipped_orders_per_match: 10n,
      oi_cap_bps: 5000n,
      price_refresh_threshold_ms: 60_000n,
    }).toBytes();

    vi.spyOn(client, "simulate").mockResolvedValue({
      $kind: "Success",
      commandResults: [{ returnValues: [{ bcs: payload }] }],
    } as never);

    const data = await getGlobalConfigData(client);
    expect(BigInt(data.protocol_fee_share_bps)).toBe(100n);
    expect(data.allowed_versions).toEqual([1]);
  });

  it("surfaces FailedTransaction from simulate", async () => {
    vi.spyOn(client, "simulate").mockResolvedValue({
      $kind: "FailedTransaction",
      FailedTransaction: { status: { error: { message: "abort code 1" } } },
    } as never);

    await expect(getGlobalConfigData(client)).rejects.toThrow(/simulate aborted/);
  });

  it("uses default message when FailedTransaction has no error detail", async () => {
    vi.spyOn(client, "simulate").mockResolvedValue({
      $kind: "FailedTransaction",
      FailedTransaction: { status: {} },
    } as never);

    await expect(getGlobalConfigData(client)).rejects.toThrow(
      /simulate aborted: FailedTransaction/,
    );
  });

  it("decodes base64 string and JSON-RPC numeric-indexed BCS blobs", async () => {
    const payload = GlobalConfigData.serialize({
      allowed_versions: [2],
      keeper_addresses: [],
      redeem_operator_addresses: [],
      protocol_fee_share_bps: 200n,
      liquidator_fee_bps: 50n,
      insurance_fee_bps: 25n,
      max_skipped_orders_per_match: 10n,
      oi_cap_bps: 5000n,
      price_refresh_threshold_ms: 60_000n,
    }).toBytes();

    vi.spyOn(client, "simulate").mockResolvedValue({
      $kind: "Success",
      commandResults: [{ returnValues: [{ bcs: toBase64(payload) }] }],
    } as never);
    const fromB64 = await getGlobalConfigData(client);
    expect(BigInt(fromB64.protocol_fee_share_bps)).toBe(200n);

    const indexed = Object.fromEntries([...payload.entries()].map(([i, v]) => [String(i), v]));
    vi.spyOn(client, "simulate").mockResolvedValue({
      $kind: "Success",
      commandResults: [{ returnValues: [{ bcs: indexed }] }],
    } as never);
    const fromIndexed = await getGlobalConfigData(client);
    expect(BigInt(fromIndexed.protocol_fee_share_bps)).toBe(200n);
  });

  it("reads nested value.bcs when top-level bcs is absent", async () => {
    const payload = GlobalConfigData.serialize({
      allowed_versions: [3],
      keeper_addresses: [],
      redeem_operator_addresses: [],
      protocol_fee_share_bps: 300n,
      liquidator_fee_bps: 50n,
      insurance_fee_bps: 25n,
      max_skipped_orders_per_match: 10n,
      oi_cap_bps: 5000n,
      price_refresh_threshold_ms: 60_000n,
    }).toBytes();

    vi.spyOn(client, "simulate").mockResolvedValue({
      $kind: "Success",
      commandResults: [{ returnValues: [{ value: { bcs: payload } }] }],
    } as never);

    const data = await getGlobalConfigData(client);
    expect(BigInt(data.protocol_fee_share_bps)).toBe(300n);
  });

  it("throws when simulate returns no BCS at the requested index", async () => {
    vi.spyOn(client, "simulate").mockResolvedValue({
      $kind: "Success",
      commandResults: [{ returnValues: [{}] }],
    } as never);

    await expect(getGlobalConfigData(client)).rejects.toThrow(/simulate returned no BCS/);
  });
});

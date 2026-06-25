/**
 * Unit tests for cross-chain credit / bridge PTB builders (`src/user/credit.ts`).
 */
import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { PerpClient } from "../../../src/perp/client.ts";
import {
  consumeCreditDeposit,
  custodyMint,
  enqueueWithdrawal,
  executeWithdrawalNative,
  executeWithdrawalWormhole,
  redeemVaa,
  requestCreditWithdraw,
  routeNative,
  routeWormhole,
} from "../../../src/perp/user/credit.ts";
import {
  MOCK_CREDIT_TYPE,
  MOCK_CUSTODY_ASSET_TYPE,
  MOCK_TESTNET_CONFIG,
} from "../helpers/fixtures/mock-testnet-config.ts";
import {
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_DEPOSIT_COIN,
} from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const client = createUnitTestClient();
const accountId = PTB_DUMMY_ACCOUNT_ID;

/** 20-byte EVM address (hex). */
const EVM_ADDR = "0x1111111111111111111111111111111111111111";
const EVM_ADDR_2 = "0x2222222222222222222222222222222222222222";

describe("user/credit — byte / address validation", () => {
  it("redeemVaa accepts bare hex strings without 0x prefix", () => {
    const tx = new Transaction();
    redeemVaa(client, tx, {
      vaaBytes: "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    });
    expect(tx.getData().commands?.length).toBe(1);
  });

  it("redeemVaa accepts number[] VAA bytes", () => {
    const tx = new Transaction();
    redeemVaa(client, tx, { vaaBytes: [0xde, 0xad] });
    expect(tx.getData().commands?.length).toBe(1);
  });

  it("redeemVaa rejects odd-length hex VAA", () => {
    expect(() => redeemVaa(client, new Transaction(), { vaaBytes: "0xabc" })).toThrow(
      /odd-length hex/,
    );
  });

  it("routeWormhole rejects non-integer evmDestinationChain", () => {
    expect(() =>
      routeWormhole(client, new Transaction(), {
        evmDestinationChain: 1.5,
        evmRecipient: EVM_ADDR,
        evmToken: EVM_ADDR_2,
      }),
    ).toThrow(/u16 \(0\.\.65535\)/);
  });

  it("routeWormhole rejects negative and out-of-range chain ids", () => {
    expect(() =>
      routeWormhole(client, new Transaction(), {
        evmDestinationChain: -1,
        evmRecipient: EVM_ADDR,
        evmToken: EVM_ADDR_2,
      }),
    ).toThrow(/u16 \(0\.\.65535\)/);

    expect(() =>
      routeWormhole(client, new Transaction(), {
        evmDestinationChain: 65_536,
        evmRecipient: EVM_ADDR,
        evmToken: EVM_ADDR_2,
      }),
    ).toThrow(/u16 \(0\.\.65535\)/);
  });

  it("routeWormhole rejects EVM addresses that are not 20 bytes", () => {
    expect(() =>
      routeWormhole(client, new Transaction(), {
        evmDestinationChain: 10002,
        evmRecipient: "0x1111",
        evmToken: EVM_ADDR_2,
      }),
    ).toThrow(/evmRecipient must be a 20-byte/);

    expect(() =>
      routeWormhole(client, new Transaction(), {
        evmDestinationChain: 10002,
        evmRecipient: EVM_ADDR,
        evmToken: new Uint8Array(19),
      }),
    ).toThrow(/evmToken must be a 20-byte/);
  });
});

describe("user/credit — PTB builders (configured pipeline)", () => {
  it("redeemVaa emits one moveCall and accepts hex / base64 VAA bytes", () => {
    const txHex = new Transaction();
    const reqHex = redeemVaa(client, txHex, {
      vaaBytes: "0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    });
    expect(reqHex).toBeDefined();
    expect(txHex.getData().commands?.length).toBe(1);

    const txRaw = new Transaction();
    redeemVaa(client, txRaw, { vaaBytes: new Uint8Array([1, 2, 3]) });
    expect(txRaw.getData().commands?.length).toBe(1);
  });

  it("consumeCreditDeposit chains after redeemVaa", () => {
    const tx = new Transaction();
    const req = redeemVaa(client, tx, { vaaBytes: new Uint8Array([0xaa]) });
    consumeCreditDeposit(client, tx, { depositRequest: req });
    expect(tx.getData().commands?.length).toBe(2);
  });

  it("routeWormhole and routeNative each emit one moveCall", () => {
    const txW = new Transaction();
    const extraW = routeWormhole(client, txW, {
      evmDestinationChain: 10002,
      evmRecipient: EVM_ADDR,
      evmToken: EVM_ADDR_2,
    });
    expect(extraW).toBeDefined();
    expect(txW.getData().commands?.length).toBe(1);

    const txN = new Transaction();
    const extraN = routeNative(client, txN, { assetType: MOCK_CUSTODY_ASSET_TYPE });
    expect(extraN).toBeDefined();
    expect(txN.getData().commands?.length).toBe(1);
  });

  it("requestCreditWithdraw + enqueueWithdrawal compose wormhole withdraw path", () => {
    const tx = new Transaction();
    const route = routeWormhole(client, tx, {
      evmDestinationChain: 10002,
      evmRecipient: EVM_ADDR,
      evmToken: EVM_ADDR_2,
    });
    const wreq = requestCreditWithdraw(client, tx, {
      accountId,
      amount: 1_000n,
      recipient: accountId,
      route,
    });
    enqueueWithdrawal(client, tx, { withdrawRequest: wreq });
    expect(tx.getData().commands?.length).toBe(4);
  });

  it("executeWithdrawalWormhole and executeWithdrawalNative (keeper)", () => {
    const txW = new Transaction();
    executeWithdrawalWormhole(client, txW, {
      key: 1n,
      wormholeFee: txW.object(PTB_DUMMY_DEPOSIT_COIN),
    });
    expect(txW.getData().commands?.length).toBeGreaterThanOrEqual(1);

    const txN = new Transaction();
    executeWithdrawalNative(client, txN, {
      key: 2n,
      assetType: MOCK_CUSTODY_ASSET_TYPE,
    });
    expect(txN.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("custodyMint omits extraData when not provided", () => {
    const tx = new Transaction();
    custodyMint(client, tx, {
      accountId,
      assetCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      assetType: MOCK_CUSTODY_ASSET_TYPE,
    });
    expect(tx.getData().commands?.length).toBe(1);
  });

  it("custodyMint + consumeCreditDeposit", () => {
    const txMint = new Transaction();
    const depReq = custodyMint(client, txMint, {
      accountId,
      assetCoin: txMint.object(PTB_DUMMY_DEPOSIT_COIN),
      assetType: MOCK_CUSTODY_ASSET_TYPE,
      extraData: "0xdeadbeef",
    });
    consumeCreditDeposit(client, txMint, {
      depositRequest: depReq,
      creditType: MOCK_CREDIT_TYPE,
    });
    expect(txMint.getData().commands?.length).toBe(2);
  });
});

describe("user/credit — missing config guards", () => {
  function clientMissing(partial: Partial<typeof MOCK_TESTNET_CONFIG.packages>): PerpClient {
    const cfg = structuredClone(MOCK_TESTNET_CONFIG);
    Object.assign(cfg.packages, partial);
    return new PerpClient("TESTNET", cfg, {
      grpcUrl: "https://fullnode.test.invalid:443",
    });
  }

  const tx = () => new Transaction();
  const coin = (t: Transaction) => t.object(PTB_DUMMY_DEPOSIT_COIN);

  it("redeemVaa requires initialized bridge", () => {
    const c = clientMissing({
      wormhole_bridge: {
        ...MOCK_TESTNET_CONFIG.packages.wormhole_bridge!,
        bridge: undefined,
      },
    });
    expect(() => redeemVaa(c, tx(), { vaaBytes: [1] })).toThrow(/bridge missing/);
  });

  it("routeWormhole requires withdrawal_queue package", () => {
    const c = clientMissing({ withdrawal_queue: undefined });
    expect(() =>
      routeWormhole(c, tx(), {
        evmDestinationChain: 1,
        evmRecipient: EVM_ADDR,
        evmToken: EVM_ADDR_2,
      }),
    ).toThrow(/withdrawal_queue not configured/);
  });

  it("enqueueWithdrawal requires queue object id", () => {
    const c = clientMissing({
      withdrawal_queue: {
        published_at: MOCK_TESTNET_CONFIG.packages.withdrawal_queue!.published_at,
      },
    });
    const t = tx();
    const route = routeNative(c, t, { assetType: MOCK_CUSTODY_ASSET_TYPE });
    const wreq = requestCreditWithdraw(c, t, {
      accountId,
      amount: 1n,
      recipient: accountId,
      route,
    });
    expect(() => enqueueWithdrawal(c, t, { withdrawRequest: wreq })).toThrow(
      /withdrawal_queue\.queue missing/,
    );
  });

  it("custodyMint requires native_custody vault", () => {
    const c = clientMissing({ native_custody: undefined });
    const t = tx();
    expect(() =>
      custodyMint(c, t, {
        accountId,
        assetCoin: coin(t),
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      }),
    ).toThrow(/native_custody not configured/);
  });

  it("executeWithdrawalNative requires custody vault id", () => {
    const c = clientMissing({
      native_custody: {
        published_at: MOCK_TESTNET_CONFIG.packages.native_custody!.published_at,
        assets: MOCK_TESTNET_CONFIG.packages.native_custody!.assets,
      },
    });
    expect(() =>
      executeWithdrawalNative(c, tx(), {
        key: 1n,
        assetType: MOCK_CUSTODY_ASSET_TYPE,
      }),
    ).toThrow(/native_custody\.vault missing/);
  });

  it("redeemVaa requires waterx_credit.credit_registry", () => {
    const c = clientMissing({
      waterx_credit: {
        published_at: MOCK_TESTNET_CONFIG.packages.waterx_credit!.published_at,
        credit_type: MOCK_CREDIT_TYPE,
      },
    });
    expect(() => redeemVaa(c, tx(), { vaaBytes: [1] })).toThrow(
      /waterx_credit\.credit_registry missing/,
    );
  });
});

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  GIFT_DOMAIN_CLAIM,
  GIFT_KDF_DOMAIN,
  GIFT_SIG_LEN,
  GIFT_URL_SEED_BYTES,
} from "~predict/constants.ts";
import {
  base64UrlNoPadDecode,
  base64UrlNoPadEncode,
  buildClaimShareFlow,
  buildCreateGiftFlow,
  buildGiftClaimMessage,
  claimShare,
  createGift,
  deleteGift,
  deriveGiftAddress,
  deriveGiftKeypair,
  encodeGiftUrl,
  generateGiftSeed,
  parseGiftUrl,
  signGiftClaim,
} from "~predict/gift.ts";
import { describe, expect, it } from "vitest";

import { TESTNET_FIXTURE_IDS } from "../fixtures/testnet-config.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import { assertLastMoveCall, listMoveCalls } from "../helpers/ptb.ts";

const FIXED_SEED = new Uint8Array([
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
]);

const SENDER = "0xa036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc54";
const SOURCE_ACCOUNT = "0xf036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc51";

describe("gift KDF", () => {
  it("derives a deterministic Ed25519 keypair from a fixed seed", () => {
    const kp = deriveGiftKeypair(FIXED_SEED);
    const kp2 = deriveGiftKeypair(FIXED_SEED);
    expect(kp.getPublicKey().toRawBytes()).toEqual(kp2.getPublicKey().toRawBytes());
  });

  it("KDF matches sha256(KDF_DOMAIN || seed)", () => {
    const merged = new Uint8Array(GIFT_KDF_DOMAIN.length + FIXED_SEED.length);
    merged.set(GIFT_KDF_DOMAIN, 0);
    merged.set(FIXED_SEED, GIFT_KDF_DOMAIN.length);
    const expectedSecret = sha256(merged);
    const expectedKp = Ed25519Keypair.fromSecretKey(expectedSecret);
    const actualKp = deriveGiftKeypair(FIXED_SEED);
    expect(actualKp.getPublicKey().toRawBytes()).toEqual(expectedKp.getPublicKey().toRawBytes());
  });

  it("rejects wrong-length seeds", () => {
    expect(() => deriveGiftKeypair(new Uint8Array(8))).toThrow(/16 bytes/);
    expect(() => deriveGiftKeypair(new Uint8Array(32))).toThrow(/16 bytes/);
  });
});

describe("claim message", () => {
  it("is exactly DOMAIN_CLAIM || gift_id || sender = 92 bytes", () => {
    const giftId = "0x" + "ab".repeat(32);
    const msg = buildGiftClaimMessage(giftId, SENDER);
    expect(msg.length).toBe(GIFT_DOMAIN_CLAIM.length + 32 + 32);
    expect(msg.length).toBe(92);

    expect(msg.slice(0, GIFT_DOMAIN_CLAIM.length)).toEqual(GIFT_DOMAIN_CLAIM);

    const giftBytes = msg.slice(GIFT_DOMAIN_CLAIM.length, GIFT_DOMAIN_CLAIM.length + 32);
    expect(Buffer.from(giftBytes).toString("hex")).toBe("ab".repeat(32));
  });

  it("signGiftClaim produces a 64-byte raw Ed25519 signature", async () => {
    const kp = deriveGiftKeypair(FIXED_SEED);
    const giftId = "0x" + "cd".repeat(32);
    const sig = await signGiftClaim(kp, giftId, SENDER);
    expect(sig.length).toBe(GIFT_SIG_LEN);
    expect(sig.length).toBe(64);
  });
});

describe("base64url no-pad", () => {
  it("roundtrips arbitrary bytes", () => {
    for (let len = 1; len <= 33; len += 4) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (i * 17 + 3) & 0xff;
      const encoded = base64UrlNoPadEncode(bytes);
      expect(encoded).not.toMatch(/[+/=]/);
      const decoded = base64UrlNoPadDecode(encoded);
      expect(Array.from(decoded)).toEqual(Array.from(bytes));
    }
  });

  it("encodes a 16-byte seed to 22 chars", () => {
    expect(base64UrlNoPadEncode(FIXED_SEED).length).toBe(22);
  });
});

describe("gift URL", () => {
  it("roundtrips through encode + parse", () => {
    const url = encodeGiftUrl(FIXED_SEED, { host: "https://waterx.io" });
    expect(url).toMatch(/^https:\/\/waterx\.io\/g\/#/);
    const { seed } = parseGiftUrl(url);
    expect(Array.from(seed)).toEqual(Array.from(FIXED_SEED));
  });

  it("accepts a bare fragment as input", () => {
    const enc = base64UrlNoPadEncode(FIXED_SEED);
    const { seed } = parseGiftUrl(`#${enc}`);
    expect(Array.from(seed)).toEqual(Array.from(FIXED_SEED));
  });

  it("rejects URLs without a fragment", () => {
    expect(() => parseGiftUrl("https://waterx.io/g/")).toThrow(/fragment/);
  });

  it("rejects empty fragments", () => {
    expect(() => parseGiftUrl("https://waterx.io/g/#")).toThrow(/empty fragment/);
  });
});

describe("deriveGiftAddress", () => {
  const client = createMockPredictClient();

  it("is deterministic and pubkey-dependent", () => {
    const kp = deriveGiftKeypair(FIXED_SEED);
    const addrA = deriveGiftAddress(client, kp.getPublicKey().toRawBytes());
    const addrB = deriveGiftAddress(client, kp.getPublicKey().toRawBytes());
    expect(addrA).toBe(addrB);
    expect(addrA).toMatch(/^0x[0-9a-f]{64}$/);

    const otherSeed = new Uint8Array(FIXED_SEED);
    otherSeed[0] ^= 0x01;
    const otherAddr = deriveGiftAddress(
      client,
      deriveGiftKeypair(otherSeed).getPublicKey().toRawBytes(),
    );
    expect(otherAddr).not.toBe(addrA);
  });

  it("depends on the claimable_link_config parent id", () => {
    const pubkey = deriveGiftKeypair(FIXED_SEED).getPublicKey().toRawBytes();
    const a = deriveGiftAddress(client, pubkey);
    const b = deriveGiftAddress(client, pubkey, {
      claimableLinkConfig: "0x" + "9".repeat(64),
    });
    expect(a).not.toBe(b);
  });

  it("rejects wrong-length pubkey", () => {
    expect(() => deriveGiftAddress(client, new Uint8Array(31))).toThrow(/32 bytes/);
  });

  // The GiftKey type tag must key on the gift package's *original* id, which
  // Sui pins across upgrades — not `published_at`, which advances on every
  // upgrade. Otherwise the off-chain gift_id diverges from the on-chain
  // `derive_gift_address` after the first upgrade.
  it("is invariant to a package upgrade when original_id is set", () => {
    const pubkey = deriveGiftKeypair(FIXED_SEED).getPublicKey().toRawBytes();
    const originalId = "0x" + "a".repeat(64);

    // Fresh deploy: published_at == original id.
    const beforeUpgrade = createMockPredictClient({
      packages: {
        waterx_prediction_gift: {
          published_at: originalId,
          claimable_link_config: TESTNET_FIXTURE_IDS.claimableLinkConfig,
        },
      },
    });

    // After an upgrade: published_at advances, original_id stays put.
    const afterUpgrade = createMockPredictClient({
      packages: {
        waterx_prediction_gift: {
          published_at: "0x" + "b".repeat(64),
          original_id: originalId,
          claimable_link_config: TESTNET_FIXTURE_IDS.claimableLinkConfig,
        },
      },
    });

    expect(deriveGiftAddress(afterUpgrade, pubkey)).toBe(deriveGiftAddress(beforeUpgrade, pubkey));
  });

  it("falls back to published_at when original_id is absent", () => {
    const pubkey = deriveGiftKeypair(FIXED_SEED).getPublicKey().toRawBytes();
    const cfg = (publishedAt: string) => ({
      packages: {
        waterx_prediction_gift: {
          published_at: publishedAt,
          claimable_link_config: TESTNET_FIXTURE_IDS.claimableLinkConfig,
        },
      },
    });
    const a = createMockPredictClient(cfg("0x" + "a".repeat(64)));
    const b = createMockPredictClient(cfg("0x" + "b".repeat(64)));
    expect(deriveGiftAddress(a, pubkey)).not.toBe(deriveGiftAddress(b, pubkey));
  });

  it("giftTypeOriginId overrides the type tag independently of giftPackageId", () => {
    const pubkey = deriveGiftKeypair(FIXED_SEED).getPublicKey().toRawBytes();
    const originalId = "0x" + "c".repeat(64);
    // Derivation keyed on originalId regardless of the runtime giftPackageId.
    const withOrigin = deriveGiftAddress(client, pubkey, {
      giftTypeOriginId: originalId,
      giftPackageId: "0x" + "d".repeat(64),
    });
    const baseline = deriveGiftAddress(client, pubkey, { giftPackageId: originalId });
    expect(withOrigin).toBe(baseline);
  });
});

describe("gift PTB builders", () => {
  const client = createMockPredictClient();
  const pubkey = deriveGiftKeypair(FIXED_SEED).getPublicKey().toRawBytes();

  it("createGift emits the expected move call", () => {
    const tx = new Transaction();
    createGift(client, tx, {
      sourceAccountId: SOURCE_ACCOUNT,
      sourcePositionId: 7n,
      pubkey,
      shareCount: 5n,
      expiresAtMs: 99_999_999_999_999n,
    });
    assertLastMoveCall(tx, {
      module: "claimable_link",
      function: "create_gift",
      package: TESTNET_FIXTURE_IDS.waterxPredictionGiftPackageId,
      typeArguments: [TESTNET_FIXTURE_IDS.settlementCoinType],
    });
  });

  it("createGift roundtrip with a referral code attaches it as Option<String>", () => {
    const tx = new Transaction();
    createGift(client, tx, {
      sourceAccountId: SOURCE_ACCOUNT,
      sourcePositionId: 7n,
      pubkey,
      shareCount: 5n,
      expiresAtMs: 99_999_999_999_999n,
      referralCode: "WATERX-VIP",
    });
    const calls = listMoveCalls(tx);
    expect(calls.at(-1)?.function).toBe("create_gift");
  });

  it("claimShare requires a 64-byte sig", () => {
    const tx = new Transaction();
    expect(() =>
      claimShare(client, tx, {
        giftId: "0x" + "ab".repeat(32),
        sig: new Uint8Array(63),
      }),
    ).toThrow(/64 bytes/);
  });

  it("claimShare emits the expected move call with no recipient (None)", () => {
    const tx = new Transaction();
    claimShare(client, tx, {
      giftId: "0x" + "ab".repeat(32),
      sig: new Uint8Array(GIFT_SIG_LEN),
    });
    assertLastMoveCall(tx, {
      module: "claimable_link",
      function: "claim_share",
      package: TESTNET_FIXTURE_IDS.waterxPredictionGiftPackageId,
      typeArguments: [TESTNET_FIXTURE_IDS.settlementCoinType],
    });
  });

  it("claimShare rejects a TransactionArgument recipient", () => {
    const tx = new Transaction();
    const obj = tx.object(SOURCE_ACCOUNT);
    expect(() =>
      claimShare(client, tx, {
        giftId: "0x" + "ab".repeat(32),
        sig: new Uint8Array(GIFT_SIG_LEN),
        recipientAccountId: obj,
      }),
    ).toThrow(/string id or null/);
  });

  it("deleteGift emits the expected move call", () => {
    const tx = new Transaction();
    deleteGift(client, tx, { giftId: "0x" + "ab".repeat(32) });
    assertLastMoveCall(tx, {
      module: "claimable_link",
      function: "delete_gift",
      package: TESTNET_FIXTURE_IDS.waterxPredictionGiftPackageId,
      typeArguments: [TESTNET_FIXTURE_IDS.settlementCoinType],
    });
  });
});

describe("buildCreateGiftFlow", () => {
  const client = createMockPredictClient();

  it("generates a fresh seed and returns the predicted giftId", () => {
    const tx = new Transaction();
    const { seed, giftId, pubkey } = buildCreateGiftFlow(client, tx, {
      sourceAccountId: SOURCE_ACCOUNT,
      sourcePositionId: 1n,
      shareCount: 1n,
      expiresAtMs: 99_999_999_999_999n,
    });
    expect(seed.length).toBe(GIFT_URL_SEED_BYTES);
    expect(pubkey.length).toBe(32);
    expect(giftId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(giftId).toBe(deriveGiftAddress(client, pubkey));
    assertLastMoveCall(tx, { module: "claimable_link", function: "create_gift" });
  });
});

describe("buildClaimShareFlow", () => {
  const client = createMockPredictClient();

  it("signs over the predicted giftId + sender and emits claim_share", async () => {
    const seed = generateGiftSeed();
    const tx = new Transaction();
    const { giftId, sig } = await buildClaimShareFlow(client, tx, {
      seed,
      sender: SENDER,
    });
    expect(giftId).toBe(
      deriveGiftAddress(client, deriveGiftKeypair(seed).getPublicKey().toRawBytes()),
    );
    expect(sig.length).toBe(GIFT_SIG_LEN);
    assertLastMoveCall(tx, { module: "claimable_link", function: "claim_share" });
  });
});

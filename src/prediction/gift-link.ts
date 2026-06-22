/**
 * Pure gift claimable-link crypto helpers (no PredictClient / RPC).
 * Browser-safe — no node:crypto. Used by FE gift share / claim flows.
 */
import { bcs } from "@mysten/sui/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import { sha256 } from "@noble/hashes/sha2.js";

const GIFT_KDF_DOMAIN = new TextEncoder().encode("waterx_prediction_gift/kdf");
const GIFT_DOMAIN_CLAIM = new TextEncoder().encode("waterx_prediction_gift/claim");
const GIFT_URL_SEED_BYTES = 16;
const GIFT_SIG_LEN = 64;

export function base64UrlNoPadEncode(bytes: Uint8Array): string {
  return toBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function base64UrlNoPadDecode(value: string): Uint8Array {
  let b64 = value.replaceAll("-", "+").replaceAll("_", "/");
  while (b64.length % 4 !== 0) b64 += "=";
  return fromBase64(b64);
}

export function generateGiftSeed(): Uint8Array {
  const seed = new Uint8Array(GIFT_URL_SEED_BYTES);
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error(
      "generateGiftSeed: globalThis.crypto.getRandomValues is unavailable; use Node >= 19 or a polyfill",
    );
  }
  globalThis.crypto.getRandomValues(seed);
  return seed;
}

export interface GiftUrlParts {
  seed: Uint8Array;
}

export function parseGiftUrl(url: string): GiftUrlParts {
  const hashIdx = url.indexOf("#");
  if (hashIdx === -1) throw new Error("parseGiftUrl: no '#' fragment in URL");
  const fragment = url.slice(hashIdx + 1);
  if (fragment === "") throw new Error("parseGiftUrl: empty fragment");
  const seed = base64UrlNoPadDecode(fragment);
  if (seed.length !== GIFT_URL_SEED_BYTES) {
    throw new Error(`Gift URL seed must be ${GIFT_URL_SEED_BYTES} bytes, got ${seed.length}`);
  }
  return { seed };
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function deriveGiftKeypair(seed: Uint8Array): Ed25519Keypair {
  if (seed.length !== GIFT_URL_SEED_BYTES) {
    throw new Error(`Gift URL seed must be ${GIFT_URL_SEED_BYTES} bytes, got ${seed.length}`);
  }
  const secret = sha256(concatBytes(GIFT_KDF_DOMAIN, seed));
  return Ed25519Keypair.fromSecretKey(secret);
}

export function buildGiftClaimMessage(giftId: string, sender: string): Uint8Array {
  return concatBytes(
    GIFT_DOMAIN_CLAIM,
    bcs.Address.serialize(giftId).toBytes(),
    bcs.Address.serialize(sender).toBytes(),
  );
}

export async function signGiftClaim(
  giftKeypair: Ed25519Keypair,
  giftId: string,
  sender: string,
): Promise<Uint8Array> {
  const sig = await giftKeypair.sign(buildGiftClaimMessage(giftId, sender));
  if (sig.length !== GIFT_SIG_LEN) {
    throw new Error(`Gift signature must be ${GIFT_SIG_LEN} bytes, got ${sig.length}`);
  }
  return sig;
}

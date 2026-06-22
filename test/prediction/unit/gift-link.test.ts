import {
  base64UrlNoPadDecode,
  base64UrlNoPadEncode,
  deriveGiftKeypair,
  generateGiftSeed,
  parseGiftUrl,
} from "~predict/gift-link.ts";
import { describe, expect, it } from "vitest";

describe("gift-link (browser-safe)", () => {
  it("generateGiftSeed returns 16 bytes", () => {
    const seed = generateGiftSeed();
    expect(seed).toHaveLength(16);
  });

  it("deriveGiftKeypair is deterministic for the same seed", () => {
    const seed = new Uint8Array(16).fill(7);
    const a = deriveGiftKeypair(seed).getPublicKey().toRawBytes();
    const b = deriveGiftKeypair(seed).getPublicKey().toRawBytes();
    expect(a).toEqual(b);
  });

  it("round-trips seed through gift URL fragment encoding", () => {
    const seed = generateGiftSeed();
    const url = `https://app.example/gift#${base64UrlNoPadEncode(seed)}`;
    expect(parseGiftUrl(url).seed).toEqual(seed);
    expect(base64UrlNoPadDecode(base64UrlNoPadEncode(seed))).toEqual(seed);
  });
});

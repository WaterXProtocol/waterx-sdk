import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { describe, expect, it } from "vitest";

import { loadSigner } from "../helpers/env.ts";

describe("env secret key parsing", () => {
  it("accepts suiprivkey bech32 export", () => {
    const kp = Ed25519Keypair.generate();
    process.env.SUI_PRIVATE_KEY = kp.getSecretKey();
    expect(loadSigner().toSuiAddress()).toBe(kp.toSuiAddress());
    delete process.env.SUI_PRIVATE_KEY;
  });

  it("accepts 32-byte hex seed", () => {
    const kp = Ed25519Keypair.generate();
    const { secretKey } = decodeSuiPrivateKey(kp.getSecretKey());
    process.env.SUI_PRIVATE_KEY = `0x${Buffer.from(secretKey).toString("hex")}`;
    expect(loadSigner().toSuiAddress()).toBe(kp.toSuiAddress());
    delete process.env.SUI_PRIVATE_KEY;
  });

  it("rejects wrong byte length with a helpful error", () => {
    process.env.SUI_PRIVATE_KEY = `0x${"ab".repeat(52)}`;
    expect(() => loadSigner()).toThrow(/decoded to 52 bytes/);
    delete process.env.SUI_PRIVATE_KEY;
  });
});

import { describe, expect, it } from "vitest";

import {
  betsMeDetailPath,
  betsMeListPath,
  isSuiWalletAddress,
  resolveBetsWalletAddress,
  suiAddressFromJwt,
  withBetsAddress,
} from "../helpers/api-bets-path.ts";

const WALLET = "0x" + "a".repeat(64);

describe("api-bets-path", () => {
  it("recognizes valid Sui wallet addresses", () => {
    expect(isSuiWalletAddress(WALLET)).toBe(true);
    expect(isSuiWalletAddress("0xshort")).toBe(false);
    expect(isSuiWalletAddress(undefined)).toBe(false);
  });

  it("decodes suiAddress from JWT payload", () => {
    const payload = Buffer.from(JSON.stringify({ suiAddress: WALLET })).toString("base64url");
    const jwt = `hdr.${payload}.sig`;
    expect(suiAddressFromJwt(jwt)).toBe(WALLET);
  });

  it("resolveBetsWalletAddress prefers explicit override", () => {
    const other = "0x" + "b".repeat(64);
    expect(resolveBetsWalletAddress(null, WALLET)).toBe(WALLET);
    expect(resolveBetsWalletAddress({ jwt: "x.y.z" }, WALLET)).toBe(WALLET);
    expect(resolveBetsWalletAddress({ jwt: "x.y.z" }, other)).toBe(other);
  });

  it("withBetsAddress appends address when missing", () => {
    expect(withBetsAddress("/predict/bets/me?filter=all", WALLET)).toBe(
      `/predict/bets/me?filter=all&address=${encodeURIComponent(WALLET)}`,
    );
    expect(withBetsAddress("/predict/feed", WALLET)).toBe("/predict/feed");
    expect(withBetsAddress(`/predict/bets/me?address=${WALLET}`, WALLET)).toBe(
      `/predict/bets/me?address=${WALLET}`,
    );
  });

  it("betsMeListPath and detail path include address", () => {
    expect(betsMeListPath(WALLET, { filter: "all", limit: 5 })).toContain(`address=${WALLET}`);
    expect(betsMeDetailPath("bet-1", WALLET)).toBe(
      `/predict/bets/me/bet-1/detail?address=${encodeURIComponent(WALLET)}`,
    );
  });
});

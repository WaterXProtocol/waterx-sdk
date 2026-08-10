import { afterEach, describe, expect, it } from "vitest";

import {
  waterxConfigUrlForNetwork,
  waterxConfigUrlFromEnv,
} from "../../../scripts/load-repo-env.ts";

describe("waterxConfigUrlForNetwork", () => {
  const prev = process.env.WATERX_CONFIG_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.WATERX_CONFIG_URL;
    else process.env.WATERX_CONFIG_URL = prev;
  });

  it("rewrites testnet.json → mainnet.json for mainnet", () => {
    process.env.WATERX_CONFIG_URL = "https://cdn.example/testnet.json";
    expect(waterxConfigUrlForNetwork("mainnet")).toBe("https://cdn.example/mainnet.json");
    expect(waterxConfigUrlForNetwork("MAINNET")).toBe("https://cdn.example/mainnet.json");
  });

  it("rewrites mainnet.json → testnet.json for testnet", () => {
    process.env.WATERX_CONFIG_URL = "https://cdn.example/mainnet.json";
    expect(waterxConfigUrlForNetwork("testnet")).toBe("https://cdn.example/testnet.json");
  });

  it("leaves matching URLs unchanged", () => {
    process.env.WATERX_CONFIG_URL = "https://cdn.example/mainnet.json";
    expect(waterxConfigUrlForNetwork("mainnet")).toBe("https://cdn.example/mainnet.json");
  });

  it("returns undefined when unset", () => {
    delete process.env.WATERX_CONFIG_URL;
    expect(waterxConfigUrlFromEnv()).toBeUndefined();
    expect(waterxConfigUrlForNetwork("mainnet")).toBeUndefined();
  });
});

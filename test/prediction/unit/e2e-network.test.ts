import { afterEach, describe, expect, it } from "vitest";

import { predictE2eNetworkKey, resolvePredictE2eNetwork } from "../helpers/e2e-network.ts";

describe("prediction e2e network resolution", () => {
  const prev = process.env.WATERX_E2E_NETWORK;

  afterEach(() => {
    if (prev === undefined) delete process.env.WATERX_E2E_NETWORK;
    else process.env.WATERX_E2E_NETWORK = prev;
  });

  it("defaults to testnet when WATERX_E2E_NETWORK is unset", () => {
    delete process.env.WATERX_E2E_NETWORK;
    expect(resolvePredictE2eNetwork()).toBe("testnet");
    expect(predictE2eNetworkKey()).toBe("TESTNET");
  });

  it("maps WATERX_E2E_NETWORK=mainnet to MAINNET", () => {
    process.env.WATERX_E2E_NETWORK = "mainnet";
    expect(resolvePredictE2eNetwork()).toBe("mainnet");
    expect(predictE2eNetworkKey()).toBe("MAINNET");
  });
});

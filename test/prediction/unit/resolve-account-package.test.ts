import { resolveAccountPackageId } from "~predict/utils.ts";
import { describe, expect, it } from "vitest";

import { createMockPredictClient } from "../helpers/mock-client.ts";

describe("resolveAccountPackageId", () => {
  it("falls back to client config when override is empty string", () => {
    const client = createMockPredictClient();
    expect(resolveAccountPackageId(client, "")).toBe(client.waterxAccountPackageId());
  });

  it("uses explicit override when non-empty", () => {
    const client = createMockPredictClient();
    const custom = "0xabc123";
    expect(resolveAccountPackageId(client, custom)).toBe(custom);
  });
});

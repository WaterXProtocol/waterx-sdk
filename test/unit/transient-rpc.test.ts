import { describe, expect, it } from "vitest";

import {
  isInfrastructureTransientError,
  isTransientRpcErrorMessage,
} from "../helpers/e2e/transient-rpc.ts";

describe("transient-rpc", () => {
  it("matches common RPC / fetch failure messages", () => {
    expect(isTransientRpcErrorMessage("RpcError: fetch failed")).toBe(true);
    expect(isTransientRpcErrorMessage("Too Many Requests")).toBe(true);
  });

  it("treats network TypeError as transient infra", () => {
    expect(isInfrastructureTransientError(new TypeError("fetch failed"))).toBe(true);
    expect(isInfrastructureTransientError(new TypeError("NetworkError when attempting fetch"))).toBe(
      true,
    );
  });

  it("does not treat arbitrary TypeError as transient infra", () => {
    expect(
      isInfrastructureTransientError(new TypeError("Cannot read properties of undefined (reading 'x')")),
    ).toBe(false);
  });

  it("treats AbortError as transient infra", () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    expect(isInfrastructureTransientError(err)).toBe(true);
  });
});

import { afterEach, describe, expect, it } from "vitest";

import { shouldRunE2ePersistentPreflight } from "../helpers/e2e/e2e-persistent-preflight.ts";
import { skipIfOracleFetchUnavailable } from "../helpers/e2e/simulate-assertions.ts";
import {
  isExhaustedQuoteCenterRoute,
  isInfrastructureTransientError,
  isOracleTransientFailureMessage,
  isTransientRpcErrorMessage,
} from "../helpers/e2e/transient-rpc.ts";

describe("e2e persistent preflight flags", () => {
  const prev: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("is off by default (pnpm test:e2e does not auto-run preflight)", () => {
    prev.WATERX_E2E_PREFLIGHT = process.env.WATERX_E2E_PREFLIGHT;
    delete process.env.WATERX_E2E_PREFLIGHT;
    expect(shouldRunE2ePersistentPreflight()).toBe(false);
  });

  it("flag is true when WATERX_E2E_PREFLIGHT=1 and integration key is configured", () => {
    prev.WATERX_E2E_PREFLIGHT = process.env.WATERX_E2E_PREFLIGHT;
    process.env.WATERX_E2E_PREFLIGHT = "1";
    expect(shouldRunE2ePersistentPreflight()).toBe(
      Boolean(process.env.WATERX_INTEGRATION_PRIVATE_KEY?.trim()),
    );
  });
});

describe("oracle skip predicates — a route outage is never an environment blip", () => {
  // A quote-center 404 on EVERY rung means the SDK is asking for paths the
  // service does not serve, so every money-path build on that network is
  // broken. Both predicates used to swallow it, which is why the 2026-09-04
  // leaf-route rename shipped green for ~12 days (PR #94).
  const exhausted =
    "WaterX quote-center fetch failed: 404 Not Found (fell back from " +
    "GET /v1/sign/bbo/consensus → 404; GET /v1/quotes/leaves → 404)";

  it("an exhausted ladder is recognized as a route outage", () => {
    expect(isExhaustedQuoteCenterRoute(exhausted)).toBe(true);
  });

  it("skipIfOracleFetchUnavailable does NOT skip it, despite the 404", () => {
    let skipped: string | undefined;
    const ctx = {
      skip: (reason?: string) => {
        skipped = reason ?? "";
      },
    };
    expect(skipIfOracleFetchUnavailable(ctx, new Error(exhausted))).toBe(false);
    expect(skipped).toBeUndefined();
  });

  it("isOracleTransientFailureMessage does NOT classify it transient", () => {
    expect(isOracleTransientFailureMessage(exhausted)).toBe(false);
  });

  it("a per-feed 404 IS still skipped — that one is a deployment mismatch", () => {
    let skipped: string | undefined;
    const ctx = {
      skip: (reason?: string) => {
        skipped = reason ?? "";
      },
    };
    const perFeed = new Error("Lazer price fetch failed: 404 Price ids not found");
    expect(skipIfOracleFetchUnavailable(ctx, perFeed)).toBe(true);
    expect(skipped).toMatch(/mismatch/);
  });

  it("isInfrastructureTransientError does NOT classify it transient either", () => {
    // The suites call skipIfOracleFetchUnavailable and then
    // skipIfTransientInfrastructureError on the SAME error, so one predicate
    // refusing the outage achieves nothing on its own. This one needs an
    // explicit guard because the message contains the bare substring
    // "fetch failed", which the generic RPC heuristic matches:
    expect(isTransientRpcErrorMessage(exhausted)).toBe(true);
    expect(isInfrastructureTransientError(new Error(exhausted))).toBe(false);
  });

  it("the over-the-cap batch error is an outage too, though it says no 'fetch failed'", () => {
    // The marker is what identifies an exhausted ladder. A second copy of this
    // predicate additionally required /quote-center.*fetch failed/ and so read
    // this one as a blip.
    const overCap =
      "WaterX quote-center batch fetch needs 40 symbols but the enclave signs at most 32 " +
      "per request, and a batch envelope cannot be split (one signature covers the whole " +
      "batch). Request fewer tickers, or use a quote-center that serves the per-symbol " +
      "leaf route, which IS chunked. (fell back from GET /v1/sign/bbo/consensus → 404)";
    expect(isExhaustedQuoteCenterRoute(overCap)).toBe(true);
    expect(isOracleTransientFailureMessage(overCap)).toBe(false);
    expect(isInfrastructureTransientError(new Error(overCap))).toBe(false);
  });

  it("a leaf fetch that failed on a retryable status is still transient", () => {
    // Not `…leaf fetch failed: 404`: fetchLeafChunk answers 404 in its own
    // branch (unknown symbol, or walk the ladder), so that message is
    // unreachable. What this arm actually sees is a status the fetch policy
    // retried and gave up on.
    expect(
      isOracleTransientFailureMessage(
        "WaterX quote-center leaf fetch failed: 503 Service Unavailable",
      ),
    ).toBe(true);
  });
});

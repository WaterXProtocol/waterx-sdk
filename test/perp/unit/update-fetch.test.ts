/**
 * `fetchWithPolicy` unit tests — retry/backoff/timeout/Bearer policy for the
 * oracle money-path fetches. No real network; `globalThis.fetch` is mocked
 * per test.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { FetchPolicyError, fetchWithPolicy } from "../../../src/oracle/update-fetch.ts";

/**
 * A `fetch` mock that never resolves on its own and only rejects when its
 * `init.signal` aborts — mirrors real `fetch()`, which rejects synchronously
 * for an ALREADY-aborted signal (not just on a future "abort" event, which
 * never fires for a signal that aborted before the listener was attached).
 */
function mockFetchThatRejectsOnAbort(): ReturnType<typeof vi.fn> {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new DOMException("The operation was aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted", "AbortError")),
        );
      }),
  );
}

describe("fetchWithPolicy", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns the response unchanged on first-attempt success", async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const res = await fetchWithPolicy("https://x.test.invalid/a/b");

    expect(res.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  describe("Bearer auth", () => {
    it("attaches Authorization: Bearer <apiKey> when apiKey is set", async () => {
      let captured: RequestInit | undefined;
      const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
        captured = init;
        return { ok: true } as Response;
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      await fetchWithPolicy("https://x.test.invalid/a", {}, { apiKey: "unit-test-token" });

      expect(captured?.headers).toEqual({ Authorization: "Bearer unit-test-token" });
    });

    it("merges Bearer auth into caller-supplied headers without dropping them", async () => {
      let captured: RequestInit | undefined;
      const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
        captured = init;
        return { ok: true } as Response;
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      await fetchWithPolicy(
        "https://x.test.invalid/a",
        { headers: { "Content-Type": "application/json" } },
        { apiKey: "unit-test-token" },
      );

      expect(captured?.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer unit-test-token",
      });
    });

    it("does not attach an Authorization header when apiKey is empty/unset (today's keyless shape)", async () => {
      let captured: RequestInit | undefined;
      const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
        captured = init;
        return { ok: true } as Response;
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      await fetchWithPolicy("https://x.test.invalid/a", {}, { apiKey: "" });

      expect(captured?.headers).toBeUndefined();
    });

    it("merges Bearer auth into a Headers instance without dropping existing entries", async () => {
      let captured: RequestInit | undefined;
      const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
        captured = init;
        return { ok: true } as Response;
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      await fetchWithPolicy(
        "https://x.test.invalid/a",
        { headers: new Headers({ "Content-Type": "application/json" }) },
        { apiKey: "unit-test-token" },
      );

      // `Headers` normalizes names to lowercase on iteration — the merge
      // preserves whatever `Headers.forEach` hands back for existing
      // entries; only the literal `Authorization` key we add is ours.
      expect(captured?.headers).toEqual({
        "content-type": "application/json",
        Authorization: "Bearer unit-test-token",
      });
    });

    it("merges Bearer auth into an array-form headers list without dropping existing entries", async () => {
      let captured: RequestInit | undefined;
      const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
        captured = init;
        return { ok: true } as Response;
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      await fetchWithPolicy(
        "https://x.test.invalid/a",
        {
          headers: [
            ["Content-Type", "application/json"],
            ["X-Custom", "1"],
          ],
        },
        { apiKey: "unit-test-token" },
      );

      expect(captured?.headers).toEqual({
        "Content-Type": "application/json",
        "X-Custom": "1",
        Authorization: "Bearer unit-test-token",
      });
    });
  });

  describe("retry", () => {
    it("retries on HTTP 429 then succeeds, backing off exponentially between attempts", async () => {
      let calls = 0;
      const fetchSpy = vi.fn(async () => {
        calls += 1;
        if (calls < 3) return { ok: false, status: 429 } as Response;
        return { ok: true, status: 200 } as Response;
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const res = await fetchWithPolicy("https://x.test.invalid/a", {}, { retryDelayMs: 5 });

      expect(res.ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      // Backoff: retryDelayMs * 2^attempt for attempts 0 and 1 → 5ms, 10ms.
      const delays = setTimeoutSpy.mock.calls.map((c) => c[1]);
      expect(delays).toEqual(expect.arrayContaining([5, 10]));
    });

    it("retries on HTTP 503 then succeeds", async () => {
      let calls = 0;
      const fetchSpy = vi.fn(async () => {
        calls += 1;
        if (calls < 2) return { ok: false, status: 503 } as Response;
        return { ok: true, status: 200 } as Response;
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const res = await fetchWithPolicy("https://x.test.invalid/a", {}, { retryDelayMs: 1 });

      expect(res.ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("retries on a network error then succeeds", async () => {
      let calls = 0;
      const fetchSpy = vi.fn(async () => {
        calls += 1;
        if (calls < 2) throw new TypeError("fetch failed");
        return { ok: true, status: 200 } as Response;
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const res = await fetchWithPolicy("https://x.test.invalid/a", {}, { retryDelayMs: 1 });

      expect(res.ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("does NOT retry a non-429 4xx (deterministic auth/bad-request failure) — returns the response as-is", async () => {
      const fetchSpy = vi.fn(async () => ({ ok: false, status: 401 }) as Response);
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const res = await fetchWithPolicy("https://x.test.invalid/a", {}, { retries: 5 });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(401);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry a 400 either", async () => {
      const fetchSpy = vi.fn(async () => ({ ok: false, status: 400 }) as Response);
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const res = await fetchWithPolicy("https://x.test.invalid/a", {}, { retries: 5 });

      expect(res.status).toBe(400);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("retries after a per-attempt timeout, succeeding on a later attempt", async () => {
      let calls = 0;
      const fetchSpy = vi.fn((_url: string, init?: RequestInit) => {
        calls += 1;
        if (calls === 1) {
          // First attempt: never resolves on its own — only the
          // per-attempt AbortSignal.timeout(20) can end it.
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("The operation was aborted", "AbortError")),
            );
          });
        }
        return Promise.resolve({ ok: true, status: 200 } as Response);
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const res = await fetchWithPolicy(
        "https://x.test.invalid/a",
        {},
        { retries: 1, timeoutMs: 20, retryDelayMs: 1 },
      );

      expect(res.ok).toBe(true);
      expect(calls).toBe(2);
    });
  });

  describe("final-failure error shape", () => {
    it("throws a FetchPolicyError naming host+path (no query string) and the last status, after exhausting retries on a persistently retryable status", async () => {
      const fetchSpy = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      let caught: unknown;
      try {
        await fetchWithPolicy(
          "https://hermes.test.invalid/v2/updates/price/latest?ids[]=0xsecretfeedid",
          {},
          { retries: 1, retryDelayMs: 1 },
        );
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(FetchPolicyError);
      const err = caught as FetchPolicyError;
      expect(err.message).toContain("hermes.test.invalid/v2/updates/price/latest");
      expect(err.message).not.toContain("ids");
      expect(err.message).not.toContain("0xsecretfeedid");
      expect(err.message).not.toContain("?");
      expect(err.status).toBe(503);
      expect(err.attempts).toBe(2); // retries: 1 ⇒ 2 total attempts
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("throws a FetchPolicyError naming host+path and the cause, after exhausting retries on a persistent network error", async () => {
      const networkError = new TypeError("fetch failed");
      const fetchSpy = vi.fn(async () => {
        throw networkError;
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      let caught: unknown;
      try {
        await fetchWithPolicy(
          "https://hermes.test.invalid/v2/updates/price/latest",
          {},
          { retries: 0, retryDelayMs: 1 },
        );
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(FetchPolicyError);
      const err = caught as FetchPolicyError;
      expect(err.message).toContain("hermes.test.invalid/v2/updates/price/latest");
      expect(err.message).toContain("fetch failed");
      expect(err.status).toBeUndefined();
      expect(err.attempts).toBe(1); // retries: 0 ⇒ 1 total attempt
      expect(err.cause).toBe(networkError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("includes a truncated response-body snippet in the final error (restores the old single-attempt diagnostic)", async () => {
      const bodyText = "rate limited, please slow down";
      const fetchSpy = vi.fn(
        async () => ({ ok: false, status: 503, text: async () => bodyText }) as unknown as Response,
      );
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      let caught: unknown;
      try {
        await fetchWithPolicy("https://x.test.invalid/a", {}, { retries: 0, retryDelayMs: 1 });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(FetchPolicyError);
      const err = caught as FetchPolicyError;
      expect(err.bodySnippet).toBe(bodyText);
      expect(err.message).toContain(bodyText);
    });

    it("truncates a long response body to ~200 chars in the final error", async () => {
      const longBody = "x".repeat(500);
      const fetchSpy = vi.fn(
        async () => ({ ok: false, status: 503, text: async () => longBody }) as unknown as Response,
      );
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      let caught: unknown;
      try {
        await fetchWithPolicy("https://x.test.invalid/a", {}, { retries: 0, retryDelayMs: 1 });
      } catch (err) {
        caught = err;
      }

      const err = caught as FetchPolicyError;
      // 200 chars + the "…" truncation marker.
      expect(err.bodySnippet?.length).toBeLessThanOrEqual(201);
      expect(err.bodySnippet).toContain("…");
    });

    it("carries no body snippet when the final response has no readable body (e.g. a plain test double)", async () => {
      // No `.text()` on this mock at all — readBodySnippet must swallow the
      // resulting TypeError rather than let it replace the real failure.
      const fetchSpy = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      let caught: unknown;
      try {
        await fetchWithPolicy("https://x.test.invalid/a", {}, { retries: 0, retryDelayMs: 1 });
      } catch (err) {
        caught = err;
      }

      const err = caught as FetchPolicyError;
      expect(err.bodySnippet).toBe("");
      expect(err.message).toBe(
        "fetchWithPolicy: x.test.invalid/a failed after 1 attempt(s) — last status 503",
      );
    });
  });

  describe("external cancellation", () => {
    it("an external AbortSignal aborts the whole policy, including a queued backoff sleep", async () => {
      const fetchSpy = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
      globalThis.fetch = fetchSpy as unknown as typeof fetch;
      const controller = new AbortController();

      const promise = fetchWithPolicy(
        "https://x.test.invalid/a",
        {},
        { retries: 5, retryDelayMs: 100 },
        controller.signal,
      );
      // Let the first attempt resolve and the loop enter its backoff sleep,
      // then cancel from outside — this must reject promptly, not wait out
      // the full 100ms backoff or any further retries.
      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort(new Error("caller cancelled"));

      await expect(promise).rejects.toThrow(/cancelled/);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("an AbortSignal passed via init.signal aborts the whole policy, same as the externalSignal param", async () => {
      const fetchSpy = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
      globalThis.fetch = fetchSpy as unknown as typeof fetch;
      const controller = new AbortController();

      // Passed through `init.signal` — NOT the dedicated 4th param — and no
      // externalSignal at all, proving the fold happens on its own.
      const promise = fetchWithPolicy(
        "https://x.test.invalid/a",
        { signal: controller.signal },
        { retries: 5, retryDelayMs: 100 },
      );
      await new Promise((resolve) => setTimeout(resolve, 10));
      controller.abort(new Error("cancelled via init.signal"));

      await expect(promise).rejects.toThrow(/cancelled/);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("an already-aborted external signal fails the very first attempt without retrying", async () => {
      const fetchSpy = mockFetchThatRejectsOnAbort();
      globalThis.fetch = fetchSpy as unknown as typeof fetch;
      const controller = new AbortController();
      controller.abort(new Error("pre-aborted"));

      await expect(
        fetchWithPolicy(
          "https://x.test.invalid/a",
          {},
          { retries: 5, retryDelayMs: 1 },
          controller.signal,
        ),
      ).rejects.toThrow(/aborted|pre-aborted/i);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("per-attempt timeout", () => {
    it("aborts an individual attempt at timeoutMs and surfaces it as the final failure when no retries are configured", async () => {
      const fetchSpy = mockFetchThatRejectsOnAbort();
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const start = Date.now();
      await expect(
        fetchWithPolicy(
          "https://x.test.invalid/a",
          {},
          { retries: 0, timeoutMs: 20, retryDelayMs: 1 },
        ),
      ).rejects.toBeInstanceOf(FetchPolicyError);
      // The mock never resolves on its own — reaching failure at all proves
      // the per-attempt AbortSignal.timeout(20) fired and aborted it.
      expect(Date.now() - start).toBeGreaterThanOrEqual(15);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});

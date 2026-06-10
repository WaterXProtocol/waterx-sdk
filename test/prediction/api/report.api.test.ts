import { describe, expect, it } from "vitest";

import {
  betsMeListPath,
  betsMeSummaryPath,
  resolveBetsWalletAddress,
} from "../helpers/api-bets-path.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import {
  DEFAULT_REPORT_REQUESTS,
  fetchReportEntry,
  filterReportRequests,
  parseReportSections,
  printApiReport,
  type ApiReportEntry,
  type ApiReportRequest,
} from "../helpers/api-report.ts";
import { discoverReachableDetailSlug, marketDetailPath } from "../helpers/api-smoke.ts";

const reportSections = parseReportSections(process.env.E2E_API_REPORT);

describe.skipIf(!process.env.E2E_API_REPORT)("predict API response report", () => {
  it("prints formatted feed / browse / detail / bets responses", async () => {
    const env = resolveApiEnvironment();
    expect(
      env,
      "configure test/prediction/api/environments/{local|staging}.json or E2E_API_BASE_URL",
    ).toBeTruthy();
    if (!env) return;

    const requests: ApiReportRequest[] = [...DEFAULT_REPORT_REQUESTS];

    if (reportSections === "all" || reportSections.has("markets") || reportSections.has("detail")) {
      for (const segment of ["sport", "crypto"] as const) {
        const ref = await discoverReachableDetailSlug(env, segment);
        if (ref) {
          requests.push({
            id: `markets:${segment}`,
            label: `Market detail · ${segment}`,
            path: marketDetailPath(segment, ref.slug),
          });
        }
      }
    }

    const wallet = resolveBetsWalletAddress(env);
    if (
      wallet &&
      (reportSections === "all" || reportSections.has("bets") || reportSections.has("bets-me"))
    ) {
      requests.push(
        {
          id: "bets:me",
          label: "Bets · my history",
          path: betsMeListPath(wallet, { filter: "all", limit: 3 }),
        },
        {
          id: "bets:summary",
          label: "Bets · summary",
          path: betsMeSummaryPath(wallet),
        },
      );
    }

    const selected = filterReportRequests(requests, reportSections);
    expect(selected.length, "no report sections matched E2E_API_REPORT filter").toBeGreaterThan(0);

    const entries: ApiReportEntry[] = [];
    for (const request of selected) {
      entries.push(await fetchReportEntry(env, request));
    }

    printApiReport(
      {
        envName: env.name,
        baseUrl: env.baseUrl,
        sections: process.env.E2E_API_REPORT ?? "all",
      },
      entries,
    );

    const unreachable = entries.filter((e) => e.error);
    if (unreachable.length > 0) {
      expect.soft(unreachable.map((e) => e.request.path)).toEqual([]);
    }
  }, 120_000);
});

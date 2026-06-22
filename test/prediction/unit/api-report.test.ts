import { describe, expect, it } from "vitest";

import {
  DEFAULT_REPORT_REQUESTS,
  filterReportRequests,
  parseReportSections,
  shouldIncludeSection,
} from "../helpers/api-report.ts";

describe("api-report helpers", () => {
  it("parseReportSections treats 1/all as full report", () => {
    expect(parseReportSections("1")).toBe("all");
    expect(parseReportSections("all")).toBe("all");
    expect(parseReportSections(undefined)).toBe("all");
  });

  it("parseReportSections splits comma list", () => {
    expect(parseReportSections("feed,browse")).toEqual(new Set(["feed", "browse"]));
  });

  it("shouldIncludeSection matches id prefix", () => {
    const sections = new Set(["feed"]);
    expect(shouldIncludeSection(sections, "feed:crypto")).toBe(true);
    expect(shouldIncludeSection(sections, "browse:sport")).toBe(false);
  });

  it("filterReportRequests respects section filter", () => {
    const onlyFeed = filterReportRequests(DEFAULT_REPORT_REQUESTS, new Set(["feed"]));
    expect(onlyFeed.every((r) => r.id.startsWith("feed"))).toBe(true);
    expect(onlyFeed.length).toBe(2);
  });
});

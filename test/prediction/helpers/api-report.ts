import { apiFetch } from "./api-client.ts";
import type { ApiEnvironment } from "./api-env.ts";

export interface ApiReportRequest {
  id: string;
  label: string;
  path: string;
}

export interface ApiReportEntry {
  request: ApiReportRequest;
  status: number;
  ok: boolean;
  body: unknown;
  error?: string;
}

const REPORT_WIDTH = 76;

export function parseReportSections(raw: string | undefined): Set<string> | "all" {
  if (!raw || raw === "1" || raw === "all") return "all";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function shouldIncludeSection(sections: Set<string> | "all", id: string): boolean {
  if (sections === "all") return true;
  const base = id.split(":")[0];
  return sections.has(id) || sections.has(base ?? id);
}

export async function fetchReportEntry(
  env: ApiEnvironment,
  request: ApiReportRequest,
): Promise<ApiReportEntry> {
  try {
    const { status, body } = await apiFetch(env, request.path);
    return {
      request,
      status,
      ok: status >= 200 && status < 300,
      body,
    };
  } catch (err) {
    return {
      request,
      status: 0,
      ok: false,
      body: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function hr(char = "─"): string {
  return char.repeat(REPORT_WIDTH);
}

function titleLine(text: string): void {
  console.log(`\n${hr("═")}`);
  console.log(`  ${text}`);
  console.log(hr("═"));
}

function blockHeading(text: string): void {
  console.log(`\n${hr()}`);
  console.log(text);
  console.log(hr());
}

function summarizeFeedBrowseBody(body: unknown): string[] {
  const lines: string[] = [];
  if (!body || typeof body !== "object") return lines;
  const envelope = body as { success?: boolean; data?: { items?: unknown[] } };
  if (envelope.success !== true || !envelope.data?.items) {
    return lines;
  }
  const items = envelope.data.items;
  lines.push(`items: ${items.length}`);
  items.slice(0, 5).forEach((item, i) => {
    lines.push(`  ${i}. ${summarizeListItem(item)}`);
  });
  if (items.length > 5) {
    lines.push(`  … +${items.length - 5} more`);
  }
  const nextCursor = (envelope.data as { nextCursor?: unknown }).nextCursor;
  lines.push(`nextCursor: ${nextCursor === null ? "null" : String(nextCursor)}`);
  return lines;
}

function summarizeListItem(item: unknown): string {
  if (!item || typeof item !== "object") return "(invalid item)";
  const row = item as {
    market?: { slug?: string; type?: string; display?: { kind?: string } };
    round?: { phase?: string; startsAt?: number };
    nextRound?: { phase?: string; startsAt?: number };
  };
  const slug = row.market?.slug ?? "?";
  const kind = row.market?.display?.kind ?? row.market?.type ?? "?";
  const round = row.round ?? row.nextRound;
  const roundKey = row.round ? "round" : row.nextRound ? "nextRound" : "—";
  const phase = round?.phase ?? "—";
  return `${slug} (${kind}) · ${roundKey}.phase=${phase}`;
}

function summarizeBetsBody(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const envelope = body as {
    success?: boolean;
    data?: { bets?: unknown[]; summary?: Record<string, unknown> };
  };
  if (envelope.success !== true || !envelope.data) return [];
  if (Array.isArray(envelope.data.bets)) {
    return [
      `bets: ${envelope.data.bets.length}`,
      `nextCursor: ${String((envelope.data as { nextCursor?: unknown }).nextCursor ?? "null")}`,
    ];
  }
  if (envelope.data.summary) {
    const s = envelope.data.summary;
    return [
      "summary:",
      `  netPnlUsd: ${s.netPnlUsd}`,
      `  won/lost/live: ${s.wonCount}/${s.lostCount}/${s.liveCount}`,
    ];
  }
  return [];
}

function summarizeBody(body: unknown, requestId: string): string[] {
  if (requestId.startsWith("feed") || requestId.startsWith("browse")) {
    return summarizeFeedBrowseBody(body);
  }
  if (requestId.startsWith("bets")) {
    return summarizeBetsBody(body);
  }
  if (requestId.startsWith("markets")) {
    if (!body || typeof body !== "object") return [];
    const data = (body as { data?: { detail?: { market?: { slug?: string } } } }).data;
    const slug = data?.detail?.market?.slug;
    return slug ? [`detail.market.slug: ${slug}`] : [];
  }
  return [];
}

function printJson(body: unknown): void {
  console.log(JSON.stringify(body, null, 2));
}

export function printApiReport(
  meta: { envName: string; baseUrl: string; sections: string },
  entries: ApiReportEntry[],
): void {
  titleLine(`WaterX Predict API Report`);
  console.log(`  env:     ${meta.envName}`);
  console.log(`  baseUrl: ${meta.baseUrl}`);
  console.log(`  sections: ${meta.sections}`);
  console.log(`  time:    ${new Date().toISOString()}`);

  for (const entry of entries) {
    const statusLabel =
      entry.status > 0 ? `HTTP ${entry.status}` : entry.error ? "UNREACHABLE" : "HTTP ?";
    blockHeading(`${entry.request.label}\n  GET ${entry.request.path}  ·  ${statusLabel}`);

    const summary = summarizeBody(entry.body, entry.request.id);
    if (summary.length > 0) {
      console.log("\nSummary");
      for (const line of summary) {
        console.log(`  ${line}`);
      }
    }

    if (entry.error) {
      console.log(`\nError: ${entry.error}`);
    } else {
      console.log("\nResponse");
      printJson(entry.body);
    }
  }

  console.log(`\n${hr("═")}\n`);
}

export const DEFAULT_REPORT_REQUESTS: ApiReportRequest[] = [
  {
    id: "feed:crypto",
    label: "Feed · crypto",
    path: "/predict/feed?type=crypto&limit=2",
  },
  {
    id: "feed:sport",
    label: "Feed · sport",
    path: "/predict/feed?type=sport&limit=2",
  },
  {
    id: "browse:sport",
    label: "Browse · sport trending",
    path: "/predict/browse?type=sport&sort=trending&limit=2",
  },
  {
    id: "browse:crypto",
    label: "Browse · crypto trending",
    path: "/predict/browse?type=crypto&sort=trending&limit=2",
  },
];

export function filterReportRequests(
  requests: ApiReportRequest[],
  sections: Set<string> | "all",
): ApiReportRequest[] {
  return requests.filter((r) => shouldIncludeSection(sections, r.id));
}

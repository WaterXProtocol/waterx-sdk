/**
 * Resolve every relative link in the repo's tracked markdown.
 *
 *   pnpm docs:check
 *
 * Guards the docs against the most common rot: a link to a file that was
 * renamed or deleted. Only RELATIVE targets are checked — external URLs are
 * left to a human (network checks make CI flaky), and bare `#anchor` links
 * carry no path to resolve. Path fragments (`./src/perp/index.ts#L12`) are
 * stripped before resolving: the file must exist, the anchor is not verified.
 *
 * Scope is `git ls-files '*.md'`, so a NEW doc is covered the moment it is
 * tracked — an allowlist would silently default to no coverage. Exceptions are
 * named in IGNORED below, never left implicit.
 *
 * Exits non-zero listing every unresolved link.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "./load-repo-env.ts";

/**
 * Docs deliberately excluded, each with a reason. Prefer fixing the doc over
 * adding a line here.
 */
const IGNORED = new Map([
  // 48 links stale since the prediction test/src reorg (`../src/prediction.ts`,
  // `e2e/*.e2e.test.ts`). Repairing them needs per-link judgement — some
  // `*.integration.test.ts` targets are real — so it is its own change.
  ["test/prediction/COVERAGE.md", "stale since the prediction reorg; needs its own pass"],
]);

/** `[text](target)` — target captured up to the closing paren or a title. */
const MARKDOWN_LINK = /\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)/g;

interface BrokenLink {
  doc: string;
  line: number;
  target: string;
  resolved: string;
}

/** Any scheme (`https:`, `mailto:`, …) or a same-page anchor is not ours to resolve. */
function isRelative(target: string): boolean {
  return !target.startsWith("#") && !/^[a-z][a-z0-9+.-]*:/i.test(target);
}

function trackedDocs(): string[] {
  const out = execFileSync("git", ["ls-files", "*.md"], { cwd: REPO_ROOT, encoding: "utf8" });
  return out.split("\n").filter((line) => line !== "" && !IGNORED.has(line));
}

function checkDoc(doc: string): BrokenLink[] {
  const abs = path.resolve(REPO_ROOT, doc);
  const docDir = path.dirname(abs);
  const broken: BrokenLink[] = [];

  // readFileSync throws (naming the path) if a tracked doc vanished — a missing
  // doc must fail the check, never silently shrink its coverage.
  readFileSync(abs, "utf8")
    .split("\n")
    .forEach((line, index) => {
      for (const match of line.matchAll(MARKDOWN_LINK)) {
        const raw = match[1]!.replace(/^<|>$/g, "");
        if (!isRelative(raw)) continue;
        const resolved = path.resolve(docDir, raw.split("#")[0]!);
        if (!existsSync(resolved)) {
          broken.push({
            doc,
            line: index + 1,
            target: raw,
            resolved: path.relative(REPO_ROOT, resolved),
          });
        }
      }
    });

  return broken;
}

function main(): void {
  const docs = trackedDocs();
  const broken = docs.flatMap(checkDoc);

  if (broken.length > 0) {
    console.error(`✗ ${broken.length} broken relative link(s):\n`);
    for (const b of broken) {
      console.error(`  ${b.doc}:${b.line}  ${b.target}`);
      console.error(`    → no such path: ${b.resolved}`);
    }
    process.exit(1);
  }

  const skipped = IGNORED.size > 0 ? ` (${IGNORED.size} ignored)` : "";
  console.log(`✓ docs:check — all relative links resolve in ${docs.length} docs${skipped}`);
}

main();

/**
 * Resolve every relative link in the tracked markdown docs.
 *
 *   pnpm docs:check
 *
 * Guards the docs against the most common rot: a link to a file that was
 * renamed or deleted. Only RELATIVE targets are checked — external URLs are
 * left to a human (network checks make CI flaky), and bare `#anchor` links
 * carry no path to resolve.
 *
 * A link may point at a path plus a line/heading fragment
 * (`./src/perp/index.ts#L12`, `./CHANGELOG.md#unreleased`); the fragment is
 * stripped before resolving, so only the file has to exist.
 *
 * Exits non-zero listing every unresolved link.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Docs that are part of the published/integration surface. */
const DOCS = [
  "README.md",
  "SKILLS.md",
  "CLAUDE.md",
  "PACKAGES.md",
  "examples/README.md",
  "scripts/README.md",
  "test/perp/README.md",
  "test/prediction/README.md",
  ".claude/skills/waterx-sdk-integration/SKILL.md",
];

/** `[text](target)` — target captured up to the closing paren or a title. */
const MARKDOWN_LINK = /\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)/g;

interface BrokenLink {
  doc: string;
  line: number;
  target: string;
  resolved: string;
}

function isRelative(target: string): boolean {
  if (target.startsWith("#")) return false; // same-page anchor
  if (target.startsWith("mailto:")) return false;
  return !/^[a-z][a-z0-9+.-]*:\/\//i.test(target);
}

/** Strip a trailing `#fragment` — the file is what must exist, not the anchor. */
function stripFragment(target: string): string {
  const hash = target.indexOf("#");
  return hash === -1 ? target : target.slice(0, hash);
}

function checkDoc(doc: string, repoRoot: string): BrokenLink[] {
  const abs = path.resolve(repoRoot, doc);
  if (!existsSync(abs)) return []; // an optional doc that this checkout lacks
  const docDir = path.dirname(abs);
  const broken: BrokenLink[] = [];

  const lines = readFileSync(abs, "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const match of line.matchAll(MARKDOWN_LINK)) {
      const raw = match[1]!.replace(/^<|>$/g, "");
      if (!isRelative(raw)) continue;
      const filePart = stripFragment(raw);
      if (filePart === "") continue; // pure fragment after all
      const resolved = path.resolve(docDir, decodeURIComponent(filePart));
      if (!existsSync(resolved)) {
        broken.push({
          doc,
          line: index + 1,
          target: raw,
          resolved: path.relative(repoRoot, resolved),
        });
      }
    }
  });

  return broken;
}

function main(): void {
  const repoRoot = process.cwd();
  const broken = DOCS.flatMap((doc) => checkDoc(doc, repoRoot));
  const checked = DOCS.filter((doc) => existsSync(path.resolve(repoRoot, doc)));

  if (broken.length > 0) {
    console.error(`✗ ${broken.length} broken relative link(s):\n`);
    for (const b of broken) {
      console.error(`  ${b.doc}:${b.line}  ${b.target}`);
      console.error(`    → no such path: ${b.resolved}`);
    }
    process.exit(1);
  }

  console.log(`✓ docs:check — all relative links resolve (${checked.length} docs)`);
}

main();

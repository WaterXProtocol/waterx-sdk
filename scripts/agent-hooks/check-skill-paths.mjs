#!/usr/bin/env node
// The integration skill (.claude/skills/waterx-sdk-integration/SKILL.md) is
// shipped in the npm package (`package.json#files`), and SKILLS.md tells
// consumers to copy it into their own repo. There, nothing from this repo
// exists except the tarball — so every repo-relative path the skill names in
// backticks must be either a tarball entry (a `files` entry, or a path under
// one; a dist/ path must also be a target of the `exports` map), a path under
// node_modules/@waterx/sdk/ (README.md is always packed by npm), or an absolute URL. `pnpm docs:check` cannot catch this: it resolves
// only `[text](path)` links, and these are backticked.
//
// Usage: node scripts/agent-hooks/check-skill-paths.mjs [--report-only]
// Exit 1 listing every offending token, 0 when clean. No dependencies.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const reportOnly = process.argv.includes("--report-only");

const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const files = pkg.files ?? [];
const skillPath = files.find((f) => /SKILL\.md$/.test(f));
if (!skillPath) {
  console.error("package.json#files lists no SKILL.md — nothing to check (or the skill was unshipped)");
  process.exit(1);
}
const skill = readFileSync(join(repoRoot, skillPath), "utf8");

// A backticked token that looks like a repo-relative path: at least one `/`,
// no spaces, no URL scheme, not a package specifier.
const TOKEN = /`([^`\s]+)`/g;
const looksLikePath = (t) =>
  t.includes("/") &&
  !/^[a-z]+:\/\//.test(t) &&
  !t.startsWith("@") && // @waterx/sdk, @mysten/sui — package specifiers
  !t.startsWith("/v1/") && // HTTP routes
  !/^[A-Z][A-Za-z]*\.[a-z]/.test(t) && // Dotted identifiers (Foo.bar/...) are not paths
  !/^[A-Z]{2,}\//.test(t) && // Caps/caps tokens such as TP/SL, BTC/USD are prose, not paths
  /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.*#-]+)+\/?$/.test(t);

// `dist/` is not built here, so a dist path is checked against the `exports`
// map instead: it must be one of the files that map points consumers at.
const exportTargets = new Set();
const collect = (v) => {
  if (typeof v === "string") exportTargets.add(v.replace(/^\.\//, ""));
  else if (v && typeof v === "object") Object.values(v).forEach(collect);
};
collect(pkg.exports);

const allowedPrefixes = files.map((f) => f.replace(/\/+$/, ""));
const allowed = (t) => {
  if (t.startsWith("node_modules/@waterx/sdk/")) return true;
  if (t.startsWith("dist/")) return exportTargets.has(t);
  return allowedPrefixes.some((p) => t === p || t.startsWith(`${p}/`));
};

const offenders = [];
let m;
while ((m = TOKEN.exec(skill)) !== null) {
  const t = m[1];
  if (!looksLikePath(t)) continue;
  if (!allowed(t)) offenders.push({ token: t, line: skill.slice(0, m.index).split("\n").length });
}

if (offenders.length === 0) {
  console.log(`check-skill-paths: OK (${skillPath} names only packaged paths or URLs)`);
  process.exit(0);
}
for (const o of offenders) {
  console.log(`${skillPath}:${o.line}: \`${o.token}\` is not in the npm package (files: ${files.join(", ")}) — use a GitHub URL, or a dist/ path the exports map names`);
}
process.exit(reportOnly ? 0 : 1);

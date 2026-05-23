/**
 * Generates test/TEST-CASES.md from Vitest test files (unit / e2e / integration).
 * Run: pnpm exec tsx scripts/generate-test-cases-doc.ts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

type Tier = "unit" | "e2e" | "integration";
type CaseRow = {
  id: string;
  tier: Tier;
  file: string;
  suite: string;
  name: string;
};

const TIER_DIRS: { tier: Tier; prefix: string; glob: string }[] = [
  { tier: "unit", prefix: "U", glob: "test/unit/**/*.test.ts" },
  { tier: "e2e", prefix: "E", glob: "test/simulate/**/*.test.ts" },
  { tier: "integration", prefix: "I", glob: "test/integration/**/*.test.ts" },
];

function listFiles(patternDir: string): string[] {
  const dir = path.join(ROOT, patternDir.replace("/**/*.test.ts", ""));
  const out: string[] = [];
  function walk(d: string) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".test.ts")) out.push(p);
    }
  }
  walk(dir);
  return out.sort();
}

function parseTestFile(absPath: string, tier: Tier): CaseRow[] {
  const rel = path.relative(ROOT, absPath).replaceAll("\\", "/");
  const src = fs.readFileSync(absPath, "utf8");
  const rows: CaseRow[] = [];
  const suiteStack: string[] = [];
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const dMatch = line.match(
      /^\s*describe(?:\.(?:skipIf|each))?\(\s*(?:[^,]+,\s*)?(?:async\s*)?\(\)\s*=>\s*\{|^\s*describe(?:\.(?:skipIf|each))?\(\s*(?:[^,]+,\s*)?`([^`]+)`|^\s*describe(?:\.(?:skipIf|each))?\(\s*(?:[^,]+,\s*)?["']([^"']+)["']/,
    );
    if (dMatch && line.includes("=>")) {
      const name = dMatch[1] ?? dMatch[2];
      if (name) suiteStack.push(name.trim());
      continue;
    }
    if (/^\s*\}\);?\s*$/.test(line) && suiteStack.length) {
      suiteStack.pop();
      continue;
    }
    const iMatch = line.match(
      /^\s*it(?:\.each)?\(\s*(?:\[[^\]]*\],\s*)?`([^`]+)`|^\s*it(?:\.each)?\(\s*(?:\[[^\]]*\],\s*)?["']([^"']+)["']/,
    );
    if (iMatch) {
      const name = (iMatch[1] ?? iMatch[2]!).trim();
      const suite = suiteStack.join(" › ") || path.basename(rel, ".test.ts");
      rows.push({ id: "", tier, file: rel, suite, name });
    }
  }
  return rows;
}

function inferPreconditions(tier: Tier, file: string, suite: string, name: string): string {
  if (tier === "unit") {
    if (file.includes("fetch-view") || file.includes("fetch-simulate") || file.includes("pyth"))
      return "Mock `WaterXClient` / `fetch` / gRPC; no real chain";
    if (file.includes("config-load")) return "Mock `fetch` returning JSON; or in-memory cache";
    return "Offline fixture / mock config; no network, no private key";
  }
  if (tier === "integration") {
    return "`WATERX_INTEGRATION_PRIVATE_KEY` or `.integration-trader.keystore`; testnet `waterx-config`; signer has enough SUI for gas";
  }
  const base =
    "`WaterXClient.create` + testnet gRPC; `waterx-config`; optional `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa";
  if (
    file.includes("oracle") ||
    name.includes("refresh") ||
    name.includes("buildMint") ||
    name.includes("buildClose") ||
    name.includes("buildPlace") ||
    name.includes("buildIncrease") ||
    name.includes("buildDecrease") ||
    name.includes("buildDeposit") ||
    name.includes("buildWithdraw") ||
    name.includes("buildCancel") ||
    name.includes("buildAdd") ||
    name.includes("buildUpdate")
  )
    return `${base}; Hermes Pyth available (may skip on 503/521)`;
  if (
    file.includes("wlp") ||
    file.includes("staking") ||
    file.includes("trade-position") ||
    file.includes("builders-compose") ||
    file.includes("read-account")
  )
    return `${base}; on-chain wxa has balance/position (else \`ctx.skip\`)`;
  if (file.includes("ghost") || file.includes("pre-order"))
    return `${base}; uses ghost id, no real position required`;
  return base;
}

function inferOperation(tier: Tier, file: string, name: string): string {
  if (tier === "unit") {
    if (name.includes("throws") || name.includes("rejects"))
      return `Call the function under test (invalid input or missing config)`;
    if (name.includes("composes") || name.includes("emits") || name.includes("wires"))
      return `Build PTB and assert \`moveCall\` target + args`;
    if (name.includes("simulate") || name.includes("mock"))
      return `Mock simulate / fetch, call SDK API`;
    return `Run unit assertion (pure fn / parse / export)`;
  }
  if (tier === "integration") {
    if (name.includes("open") || name.includes("close") || name.includes("lifecycle"))
      return `Sign and \`signAndExecute\` multi-step tx (open / adjust / close)`;
    if (name.includes("mint") || name.includes("CREDIT"))
      return `Signed on-chain mint / enqueue withdraw tx`;
    if (name.includes("stake") || name.includes("redeem") || name.includes("keeper"))
      return `Sign and execute WLP / staking / keeper PTB`;
    return `Sign and execute integration-scenario PTB`;
  }
  if (name.startsWith("get") || name.includes("lists") || name.includes("loads"))
    return `\`simulate\` or view query for on-chain state`;
  if (name.includes("simulates") || name.includes("build"))
    return `Build PTB -> \`devInspectTransactionBlock\` / simulate`;
  if (name.includes("composes") || name.includes("PTB"))
    return `Build PTB and inspect commands or simulate`;
  return `Run e2e scenario (simulate)`;
}

function inferExpected(tier: Tier, name: string): string {
  if (tier === "unit") {
    if (name.includes("throws") || name.includes("rejects") || name.includes("fails"))
      return "Synchronous throw or `rejects.toThrow`";
    if (name.includes("returns empty") || name.includes("empty array"))
      return "Returns empty collection, no throw";
    if (name.includes("retries") || name.includes("failover"))
      return "Succeeds after retry or throws final error";
    return "Vitest `expect` assertions pass";
  }
  if (name.includes("throws") || name.includes("rejects") || name.includes("fails"))
    return "Simulate / execute aborts or errors; invalid input must fail";
  if (tier === "integration") {
    if (name.includes("when") || name.includes("skip"))
      return "`assertSuccess`; or `ctx.skip` when env / deployment doesn't match";
    return "`assertSuccess`; on-chain state matches; `ctx.skip` on insufficient gas / oracle";
  }
  if (name.includes("returns empty") || name.includes("empty"))
    return "Returns empty collection, no throw";
  if (name.includes("simulates") || name.includes("simulate"))
    return "Simulate completes (Move abort allowed for ghost / invalid id) or RPC succeeds";
  if (name.includes("skip") || name.includes("when"))
    return "Assertions pass; or `ctx.skip` when prerequisites missing / Hermes unavailable";
  return "Assertions pass (type / value / PTB structure)";
}

function mdEscape(s: string): string {
  return s.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function renderTable(rows: CaseRow[]): string {
  const lines = [
    "| ID | Module / File | Suite | Case Name | Preconditions | Operation | Expected |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.id} | ${mdEscape(r.file)} | ${mdEscape(r.suite)} | ${mdEscape(r.name)} | ${mdEscape(inferPreconditions(r.tier, r.file, r.suite, r.name))} | ${mdEscape(inferOperation(r.tier, r.file, r.name))} | ${mdEscape(inferExpected(r.tier, r.name))} |`,
    );
  }
  return lines.join("\n");
}

function main() {
  const all: CaseRow[] = [];
  const counts: Record<Tier, number> = { unit: 0, e2e: 0, integration: 0 };

  for (const { tier, prefix, glob } of TIER_DIRS) {
    const dir = glob.replace("/**/*.test.ts", "").replace("test/", "test/");
    const files = listFiles(dir);
    let n = 0;
    for (const f of files) {
      const parsed = parseTestFile(f, tier);
      for (const row of parsed) {
        n += 1;
        row.id = `${prefix}-${String(n).padStart(3, "0")}`;
        all.push(row);
      }
    }
    counts[tier] = n;
  }

  const unitRows = all.filter((r) => r.tier === "unit");
  const e2eRows = all.filter((r) => r.tier === "e2e");
  const intRows = all.filter((r) => r.tier === "integration");

  const header = [
    "# WaterX SDK Test Case Inventory",
    "",
    "> Auto-generated: pnpm exec tsx scripts/generate-test-cases-doc.ts",
    `> Generated: ${new Date().toISOString().slice(0, 10)}`,
    `> Stats: **Unit ${counts.unit}** · **E2E (simulate) ${counts.e2e}** · **Integration ${counts.integration}** · Total **${all.length}**`,
    "",
    "## ID Scheme",
    "",
    "| Prefix | Tier | Command | Notes |",
    "| --- | --- | --- | --- |",
    "| **U-xxx** | unit | pnpm test:unit | Offline mock, no on-chain signing |",
    "| **E-xxx** | e2e | pnpm test:e2e | testnet simulateTransaction |",
    "| **I-xxx** | integration | pnpm test:integration | testnet, real signed execution |",
    "",
    "## Column Definitions",
    "",
    "- **Preconditions**: env, config, private key, on-chain state, external Hermes, etc.",
    "- **Operation**: SDK API or tx flow the test actually exercises (summary).",
    "- **Expected**: Vitest assertion target; `ctx.skip` / `describe.skipIf` means a skip is allowed.",
    "",
    "## Common Skip Conditions (E2E / Integration)",
    "",
    "- No integration private key -> entire file `describe.skipIf`",
    "- No wxa balance / position / pending redeem row -> `ctx.skip`",
    "- Hermes 404 / 5xx / 521 -> `skipHermesIfFeedUnavailable` (E2E)",
    "- Insufficient SUI for gas -> integration `skipIfInsufficientSui`",
    "",
    "> **Note**: `describe.each` / `it.each` may appear as a single row in source but expand per parameter at run time (e.g. lifecycle runs once per ticker).",
    "",
    "---",
    "",
  ].join("\n");

  const body = [
    header,
    "## 1. Unit tests (`test/unit/`)\n\n",
    renderTable(unitRows),
    "\n\n---\n\n## 2. E2E simulate tests (`test/simulate/`)\n\n",
    renderTable(e2eRows),
    "\n\n---\n\n## 3. Integration tests (`test/integration/`)\n\n",
    renderTable(intRows),
    "\n\n---\n\n## Appendix: Index by file\n\n",
    "| File | Cases | ID Range |\n| --- | ---: | --- |\n",
  ];

  for (const tier of ["unit", "e2e", "integration"] as Tier[]) {
    const rows = all.filter((r) => r.tier === tier);
    const byFile = new Map<string, CaseRow[]>();
    for (const r of rows) {
      const arr = byFile.get(r.file) ?? [];
      arr.push(r);
      byFile.set(r.file, arr);
    }
    for (const [file, rs] of [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      body.push(`| ${file} | ${rs.length} | ${rs[0]!.id}-${rs[rs.length - 1]!.id} |\n`);
    }
  }

  const outPath = path.join(ROOT, "test/TEST-CASES.md");
  fs.writeFileSync(outPath, body.join(""), "utf8");
  console.info(`Wrote ${outPath} (${all.length} cases)`);
}

main();

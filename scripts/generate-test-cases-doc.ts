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
      return "Mock `WaterXClient` / `fetch` / gRPC；無真實鏈";
    if (file.includes("config-load")) return "Mock `fetch` 回傳 JSON；或記憶體 cache";
    return "離線 fixture / mock config；無網路、無私鑰";
  }
  if (tier === "integration") {
    return "`WATERX_INTEGRATION_PRIVATE_KEY` 或 `.integration-trader.keystore`；testnet `waterx-config`；簽名者 SUI 足夠 gas";
  }
  const base =
    "`WaterXClient.create` + testnet gRPC；`waterx-config`；可選 `WATERX_E2E_WXA_ACCOUNT_ID` / canonical wxa";
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
    return `${base}；Hermes Pyth 可用（503/521 可能 skip）`;
  if (
    file.includes("wlp") ||
    file.includes("staking") ||
    file.includes("trade-position") ||
    file.includes("builders-compose") ||
    file.includes("read-account")
  )
    return `${base}；鏈上 wxa 有餘額/持倉（無則 \`ctx.skip\`）`;
  if (file.includes("ghost") || file.includes("pre-order"))
    return `${base}；使用 ghost id，不要求真實持倉`;
  return base;
}

function inferOperation(tier: Tier, file: string, name: string): string {
  if (tier === "unit") {
    if (name.includes("throws") || name.includes("rejects"))
      return `呼叫被測函式（非法輸入或缺 config）`;
    if (name.includes("composes") || name.includes("emits") || name.includes("wires"))
      return `建立 PTB，檢查 \`moveCall\` 目標與參數`;
    if (name.includes("simulate") || name.includes("mock"))
      return `Mock simulate / fetch，呼叫 SDK API`;
    return `執行單元斷言（純函式、解析、匯出）`;
  }
  if (tier === "integration") {
    if (name.includes("open") || name.includes("close") || name.includes("lifecycle"))
      return `簽名並 \`signAndExecute\` 多步交易（開倉/調整/平倉）`;
    if (name.includes("mint") || name.includes("CREDIT"))
      return `鏈上 mint / enqueue withdraw 等簽名交易`;
    if (name.includes("stake") || name.includes("redeem") || name.includes("keeper"))
      return `簽名執行 WLP/staking/keeper PTB`;
    return `簽名執行整合場景 PTB`;
  }
  if (name.startsWith("get") || name.includes("lists") || name.includes("loads"))
    return `\`simulate\` 或 view 查詢鏈上狀態`;
  if (name.includes("simulates") || name.includes("build"))
    return `組 PTB → \`devInspectTransactionBlock\` / simulate`;
  if (name.includes("composes") || name.includes("PTB")) return `組 PTB 並檢查指令或 simulate`;
  return `執行 e2e 場景（simulate）`;
}

function inferExpected(tier: Tier, name: string): string {
  if (tier === "unit") {
    if (name.includes("throws") || name.includes("rejects") || name.includes("fails"))
      return "同步拋錯或 `rejects.toThrow`";
    if (name.includes("returns empty") || name.includes("empty array")) return "回傳空集合，不拋錯";
    if (name.includes("retries") || name.includes("failover")) return "重試後成功或拋出最終錯誤";
    return "Vitest `expect` 斷言通過";
  }
  if (name.includes("throws") || name.includes("rejects") || name.includes("fails"))
    return "simulate/執行 abort 或明確錯誤；非法輸入必失敗";
  if (tier === "integration") {
    if (name.includes("when") || name.includes("skip"))
      return "`assertSuccess` 或環境/部署不符時 `ctx.skip`";
    return "`assertSuccess`；鏈上狀態符合場景；gas/oracle 不足則 `ctx.skip`";
  }
  if (name.includes("returns empty") || name.includes("empty")) return "回傳空集合，不拋錯";
  if (name.includes("simulates") || name.includes("simulate"))
    return "simulate 完成（允許 Move abort 於 ghost/無效 id）或 RPC 成功";
  if (name.includes("skip") || name.includes("when"))
    return "斷言通過；或前置不足 / Hermes 不可用時 `ctx.skip`";
  return "斷言通過（型別/值/PTB 結構）";
}

function mdEscape(s: string): string {
  return s.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function renderTable(rows: CaseRow[]): string {
  const lines = [
    "| 編號 | 模組/檔案 | 測試套件 | 用例名稱 | 前置條件 | 操作步驟 | 預期結果 |",
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
    "# WaterX SDK 測試用例清單",
    "",
    "> 自動產生：pnpm exec tsx scripts/generate-test-cases-doc.ts",
    `> 產生時間：${new Date().toISOString().slice(0, 10)}`,
    `> 統計：**Unit ${counts.unit}** · **E2E (simulate) ${counts.e2e}** · **Integration ${counts.integration}** · 合計 **${all.length}**`,
    "",
    "## 編號規則",
    "",
    "| 前綴 | 專案 | 執行指令 | 說明 |",
    "| --- | --- | --- | --- |",
    "| **U-xxx** | unit | pnpm test:unit | 離線 mock，無鏈上簽名 |",
    "| **E-xxx** | e2e | pnpm test:e2e | testnet simulateTransaction |",
    "| **I-xxx** | integration | pnpm test:integration | testnet 真實簽名執行 |",
    "",
    "## 欄位說明",
    "",
    "- **前置條件**：環境、config、私鑰、鏈上狀態、外部 Hermes 等。",
    "- **操作步驟**：測試實際呼叫的 SDK API 或交易流程（摘要）。",
    "- **預期結果**：Vitest 斷言目標；含 ctx.skip / describe.skipIf 時表示允許跳過。",
    "",
    "## 共通跳過條件（E2E / Integration）",
    "",
    "- 無 integration 私鑰 → 整檔 describe.skipIf",
    "- 無 wxa 餘額/持倉/待贖回列 → ctx.skip",
    "- Hermes 404 / 5xx / 521 → skipHermesIfFeedUnavailable（E2E）",
    "- SUI gas 不足 → integration skipIfInsufficientSui",
    "",
    "> **注意**：`describe.each` / `it.each` 在原始碼中可能只佔一列，執行時會依參數展開（例如 lifecycle 每個 ticker 各跑一遍）。",
    "",
    "---",
    "",
  ].join("\n");

  const body = [
    header,
    "## 一、Unit 測試（test/unit/）\n\n",
    renderTable(unitRows),
    "\n\n---\n\n## 二、E2E Simulate 測試（test/simulate/）\n\n",
    renderTable(e2eRows),
    "\n\n---\n\n## 三、Integration 測試（test/integration/）\n\n",
    renderTable(intRows),
    "\n\n---\n\n## 附錄：依檔案索引\n\n",
    "| 檔案 | 用例數 | 編號範圍 |\n| --- | ---: | --- |\n",
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
      body.push(`| ${file} | ${rs.length} | ${rs[0]!.id}–${rs[rs.length - 1]!.id} |\n`);
    }
  }

  const outPath = path.join(ROOT, "test/TEST-CASES.md");
  fs.writeFileSync(outPath, body.join(""), "utf8");
  console.info(`Wrote ${outPath} (${all.length} cases)`);
}

main();

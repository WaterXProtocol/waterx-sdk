/**
 * Post-build smoke: package.json `exports` resolve to emitted dist files.
 * Run via `pnpm test:post-build` after `pnpm build` — not part of unit projects (no dist in CI unit job).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
  exports: Record<string, { import: string }>;
};

/** Resolve a package.json `import` target relative to repo root and load it. */
async function importExport(subpath: string): Promise<unknown> {
  const target = pkg.exports[subpath]?.import;
  if (!target) throw new Error(`missing exports[${JSON.stringify(subpath)}]`);
  return import(pathToFileURL(join(repoRoot, target)).href);
}

describe("package.json prediction subpath exports (post-build)", () => {
  it("@waterx/sdk/prediction/user resolves to user/index.js", async () => {
    const mod = (await importExport("./prediction/user")) as { placeOrder: unknown };
    expect(mod.placeOrder).toBeTypeOf("function");
  });

  it("@waterx/sdk/prediction/user/gift resolves via user/* wildcard", async () => {
    const pattern = pkg.exports["./prediction/user/*"].import;
    const target = join(repoRoot, pattern.replace("*", "gift"));
    const mod = (await import(pathToFileURL(target).href)) as { createGift: unknown };
    expect(mod.createGift).toBeTypeOf("function");
  });

  it("@waterx/sdk/prediction/utils resolves to utils/index.js", async () => {
    const mod = (await importExport("./prediction/utils")) as {
      resolveSettlementCoinType: unknown;
    };
    expect(mod.resolveSettlementCoinType).toBeTypeOf("function");
  });

  it("wildcard ./prediction/user does not point at a missing user.js file", () => {
    const require = createRequire(import.meta.url);
    expect(() => require(join(repoRoot, "dist/src/prediction/user.js"))).toThrow();
    expect(() => require(join(repoRoot, "dist/src/prediction/user/index.js"))).not.toThrow();
  });
});

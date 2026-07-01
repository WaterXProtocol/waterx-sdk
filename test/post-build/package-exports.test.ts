/**
 * Post-build smoke: package.json `exports` resolve to emitted dist files, for
 * BOTH the ESM (`import`) and CJS (`require`) conditions of the dual build.
 * Run via `pnpm test:post-build` after `pnpm build` — not part of unit projects
 * (no dist in the CI unit job).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);

interface Condition {
  types: string;
  default: string;
}
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
  exports: Record<string, { import: Condition; require: Condition } | string>;
};

/** Resolve a package.json `import` (ESM) target relative to repo root and load it. */
async function importExport(subpath: string): Promise<unknown> {
  const entry = pkg.exports[subpath];
  const target = typeof entry === "string" ? entry : entry?.import?.default;
  if (!target) throw new Error(`missing exports[${JSON.stringify(subpath)}].import.default`);
  return import(pathToFileURL(join(repoRoot, target)).href);
}

describe("package.json prediction subpath exports (post-build, ESM)", () => {
  it("@waterx/sdk/prediction/user resolves to user/index.js", async () => {
    const mod = (await importExport("./prediction/user")) as { placeOrder: unknown };
    expect(mod.placeOrder).toBeTypeOf("function");
  });

  it("@waterx/sdk/prediction/user/gift resolves via user/* wildcard", async () => {
    const entry = pkg.exports["./prediction/user/*"];
    const pattern = typeof entry === "string" ? entry : entry.import.default;
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
    expect(() => require(join(repoRoot, "dist/src/prediction/user.js"))).toThrow();
    expect(() => require(join(repoRoot, "dist/src/prediction/user/index.js"))).not.toThrow();
  });
});

describe("CommonJS consumers can require() the package (dual ESM/CJS build)", () => {
  // Self-referencing resolution: Node resolves the package's own name via `exports`,
  // exactly as a downstream CJS/webpack consumer's `require("@waterx/sdk")` would.
  it("require('@waterx/sdk') loads the CJS build", () => {
    const mod = require("@waterx/sdk") as Record<string, unknown>;
    expect(mod.WaterXClient).toBeTypeOf("function");
  });

  it.each([
    "@waterx/sdk/account",
    "@waterx/sdk/oracle",
    "@waterx/sdk/perp",
    "@waterx/sdk/prediction",
    "@waterx/sdk/prediction/user",
    "@waterx/sdk/prediction/utils",
  ])("require('%s') resolves via the require condition", (subpath) => {
    expect(() => require(subpath)).not.toThrow();
  });

  it("every exports entry ships a require + default condition pointing at dist/cjs", () => {
    for (const [key, entry] of Object.entries(pkg.exports)) {
      if (key === "./package.json") continue;
      if (typeof entry === "string") throw new Error(`${key} unexpectedly a string`);
      expect(entry.require?.default, `${key} require.default`).toBeTypeOf("string");
      expect(entry.require.default).toContain("dist/cjs/");
    }
  });
});

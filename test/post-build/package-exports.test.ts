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
import { bcs } from "@mysten/sui/bcs";
import { describe, expect, it, vi } from "vitest";

import { minimalPlaceOrderParams, PTB_DUMMY } from "../prediction/fixtures/ptb-params.ts";
import { VOUCHER_ASSETS, voucherConfig } from "../prediction/fixtures/voucher-config.ts";
import { listMoveCalls } from "../prediction/helpers/ptb.ts";

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

describe.each(["ESM", "CJS"] as const)("Voucher package consumers (%s)", (format) => {
  it.each(VOUCHER_ASSETS)("builds and reads %s via the emitted public facade", async (asset) => {
    type Prediction = typeof import("../../src/prediction/index.ts");
    type Root = typeof import("../../src/sdk.ts");
    const prediction = (
      format === "ESM" ? await importExport("./prediction") : require("@waterx/sdk/prediction")
    ) as Prediction;
    const root = (format === "ESM" ? await importExport(".") : require("@waterx/sdk")) as Root;
    const client = new prediction.PredictClient("TESTNET", voucherConfig(), { settlement: asset });
    const facade = root.WaterXClient.fromClients({} as never, client).predict;
    const raw = 9_007_199_254_740_993n;
    const params = { ...minimalPlaceOrderParams(client), maxSpend: raw };
    const direct = await prediction.buildPlaceVoucherOrderTx(client, params);
    const bound = await facade.buildPlaceVoucherOrderTx(params);
    expect(bound.getData()).toEqual(direct.getData());
    const calls = listMoveCalls(bound);
    expect(calls.map((call) => call.function)).toEqual([
      "request",
      "selection_yes",
      "place_order_with_voucher",
    ]);
    expect(calls.at(-1)?.typeArguments).toEqual([client.settlementCoinType()]);
    const data = bound.getData();
    const amount = data.commands.at(-1)?.MoveCall?.arguments[5];
    if (amount?.$kind !== "Input") throw new Error("Expected stake input");
    const pure = data.inputs[amount.Input]?.Pure;
    if (!pure) throw new Error("Expected u64 stake");
    expect(bcs.u64().parse(Buffer.from(pure.bytes, "base64"))).toBe(raw.toString());
    const simulate = vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [
        {
          returnValues: [
            {
              bcs: prediction.predictionViewCalls.VoucherAccountView.serialize({
                market_registry_id: client.marketRegistry(),
                settlement_coin_type: { name: client.settlementCoinType() },
                account_id: PTB_DUMMY.accountId,
                available: raw,
                reserved: 1n,
                paused: false,
              }).toBytes(),
            },
          ],
        },
      ],
    } as Awaited<ReturnType<typeof client.simulate>>);
    try {
      expect(await facade.getVoucherAccount({ accountId: PTB_DUMMY.accountId })).toMatchObject({
        available: raw,
        reserved: 1n,
        settlementCoinType: client.settlementCoinType(),
        marketRegistryId: client.marketRegistry(),
      });
    } finally {
      simulate.mockRestore();
    }
  });
});

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

describe("waterxConfigUrlFromRoot is public on every config-bearing entry (ESM + CJS)", () => {
  const ROOT = "https://staging.waterx-config.pages.dev";
  type Mod = { waterxConfigUrlFromRoot: (root: string, network: string) => string };

  it.each([".", "./config", "./perp", "./prediction"])("import %s", async (subpath) => {
    const mod = (await importExport(subpath)) as Mod;
    expect(mod.waterxConfigUrlFromRoot(`${ROOT}/`, "TESTNET")).toBe(`${ROOT}/testnet.json`);
    expect(() => mod.waterxConfigUrlFromRoot(`${ROOT}/testnet.json`, "TESTNET")).toThrow();
  });

  it.each(["@waterx/sdk", "@waterx/sdk/config", "@waterx/sdk/perp", "@waterx/sdk/prediction"])(
    "require('%s')",
    (specifier) => {
      const mod = require(specifier) as Mod;
      expect(mod.waterxConfigUrlFromRoot(ROOT, "MAINNET")).toBe(`${ROOT}/mainnet.json`);
    },
  );
});

describe("the canonical price reader is public on the oracle entries (ESM + CJS)", () => {
  type Mod = { readCanonicalPrices: unknown; openCanonicalStream: unknown };

  it.each([".", "./oracle", "./oracle/canonical"])("import %s", async (subpath) => {
    const entry = pkg.exports[subpath] ?? pkg.exports["./oracle/*"];
    const pattern = typeof entry === "string" ? entry : entry.import.default;
    const target = join(repoRoot, pattern.replace("*", subpath.replace("./oracle/", "")));
    const mod = (await import(pathToFileURL(target).href)) as Mod;
    expect(mod.readCanonicalPrices).toBeTypeOf("function");
    expect(mod.openCanonicalStream).toBeTypeOf("function");
  });

  it.each(["@waterx/sdk", "@waterx/sdk/oracle", "@waterx/sdk/oracle/canonical"])(
    "require('%s')",
    (specifier) => {
      const mod = require(specifier) as Mod;
      expect(mod.readCanonicalPrices).toBeTypeOf("function");
      expect(mod.openCanonicalStream).toBeTypeOf("function");
    },
  );
});

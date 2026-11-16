import { readdirSync, readFileSync } from "node:fs";
import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it, vi } from "vitest";

import { WaterXPrediction } from "../../../src/generated/waterx_prediction/account_data.ts";
import { VoucherReserved } from "../../../src/generated/waterx_prediction/events.ts";
import { voucherGranters } from "../../../src/generated/waterx_prediction/global_config.ts";
import { packageVersion } from "../../../src/generated/waterx_prediction/version.ts";
import { voucherAccount } from "../../../src/generated/waterx_prediction/view.ts";
import { PTB_DUMMY } from "../fixtures/ptb-params.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import { listMoveCalls } from "../helpers/ptb.ts";

const generated = new URL("../../../src/generated/waterx_prediction/", import.meta.url);

describe("prediction codegen package alias", () => {
  it("keeps every generated root module on the configured alias, not a CLI path-derived placeholder", () => {
    const files = readdirSync(generated).filter((file) => file.endsWith(".ts"));
    expect(files).toContain("account_data.ts");
    expect(files).toContain("voucher.ts");
    for (const file of files) {
      const source = readFileSync(new URL(file, generated), "utf8");
      expect(source, file).not.toContain("@local-pkg/");
      if (source.includes("const $moduleName")) {
        expect(source, file).toContain(
          `const $moduleName = '@waterx/prediction::${file.slice(0, -3)}'`,
        );
      }
      const defaults = source.match(/options\.package \?\? '[^']+'/g) ?? [];
      for (const value of defaults)
        expect(value, file).toBe("options.package ?? '@waterx/prediction'");
    }
  });

  it("preserves schema names and the account witness BCS layout", () => {
    expect(WaterXPrediction.name).toBe("@waterx/prediction::account_data::WaterXPrediction");
    expect(VoucherReserved.name).toBe("@waterx/prediction::events::VoucherReserved");
    expect(Array.from(WaterXPrediction.serialize({ dummy_field: true }).toBytes())).toEqual([1]);
    expect(WaterXPrediction.parse(new Uint8Array([0]))).toEqual({ dummy_field: false });
  });

  it.each([undefined, PTB_DUMMY.accountId])(
    "uses the default alias or explicit package override (%s)",
    (packageId) => {
      const tx = new Transaction();
      const calls = vi.spyOn(tx, "moveCall");
      packageVersion({ package: packageId })(tx);
      voucherGranters({ package: packageId, arguments: [PTB_DUMMY.adminCap] })(tx);
      const client = createMockPredictClient();
      voucherAccount({
        package: packageId,
        arguments: [client.marketRegistry(), PTB_DUMMY.accountId],
        typeArguments: [client.settlementCoinType()],
      })(tx);
      // Inspect named targets before address resolution; getData() requires hex package IDs.
      expect(calls.mock.calls.map(([call]) => call)).toMatchObject([
        {
          package: packageId ?? "@waterx/prediction",
          module: "version",
          function: "package_version",
        },
        {
          package: packageId ?? "@waterx/prediction",
          module: "global_config",
          function: "voucher_granters",
        },
        { package: packageId ?? "@waterx/prediction", module: "view", function: "voucher_account" },
      ]);
      if (packageId)
        expect(listMoveCalls(tx).every((call) => call.package === packageId)).toBe(true);
    },
  );
});

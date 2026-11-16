import type { PredictClient } from "../../../../src/prediction/client.ts";
import { predictAccountDualPathCases } from "./predict-dual-path-account.ts";
import { predictAdminDualPathCases } from "./predict-dual-path-admin.ts";
import { predictOpsDualPathCases } from "./predict-dual-path-ops.ts";
import type { PredictDualPathCase } from "./predict-dual-path-shared.ts";
import { predictVoucherDualPathCases } from "./predict-dual-path-voucher.ts";

export type { PredictDualPathCase } from "./predict-dual-path-shared.ts";

export function buildPredictDualPathCases(client: PredictClient): PredictDualPathCase[] {
  return [
    ...predictAccountDualPathCases,
    ...predictAdminDualPathCases,
    ...predictOpsDualPathCases(client),
    ...predictVoucherDualPathCases(client),
  ];
}

export function predictDualPathCaseNames(client: PredictClient): Set<string> {
  return new Set(buildPredictDualPathCases(client).map((c) => c.name));
}

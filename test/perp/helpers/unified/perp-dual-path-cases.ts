import { perpAccountDualPathCases } from "./perp-dual-path-account.ts";
import { perpCreditDualPathCases } from "./perp-dual-path-credit.ts";
import { perpCustodyDualPathCases } from "./perp-dual-path-custody.ts";
import { perpOrderDualPathCases } from "./perp-dual-path-order.ts";
import { perpPoolDualPathCases } from "./perp-dual-path-pool.ts";
import type { PerpDualPathCase } from "./perp-dual-path-shared.ts";
import { perpTradingDualPathCases } from "./perp-dual-path-trading.ts";
import { perpTxBuilderDualPathCases } from "./perp-dual-path-tx-builders.ts";

export type { PerpDualPathCase } from "./perp-dual-path-shared.ts";

export const perpDualPathCases: PerpDualPathCase[] = [
  ...perpAccountDualPathCases,
  ...perpOrderDualPathCases,
  ...perpTradingDualPathCases,
  ...perpCustodyDualPathCases,
  ...perpCreditDualPathCases,
  ...perpPoolDualPathCases,
  ...perpTxBuilderDualPathCases,
];

export const perpDualPathCaseNames = new Set(perpDualPathCases.map((c) => c.name));

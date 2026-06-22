/**
 * Broker place-parameter matrix (opt-in, local/staging).
 *
 *   E2E_BROKER_MATRIX=1 E2E_BROKER_MATRIX_SCENARIOS=fillable-normal,tight-701 \
 *     pnpm test:integration:predict:broker-matrix
 */
import { beforeAll, describe, expect, it } from "vitest";

import { isApiUnreachableError } from "../helpers/api-client.ts";
import {
  DEFAULT_BROKER_MATRIX,
  formatBrokerMatrixTable,
  hasBrokerMatrixEnabled,
  runBrokerMatrix,
  type BrokerMatrixRowResult,
} from "../helpers/broker-matrix.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { resolveIntegrationApiEnv, skipIntegrationApiBets } from "../helpers/integration-api.ts";
import { setupIntegration, type IntegrationCtx } from "../helpers/integration-setup.ts";

function assertScenario(row: BrokerMatrixRowResult): void {
  const exp = row.scenario.expectOutcome;
  if (!exp) return;
  if (exp === "api-reject") {
    expect(row.apiOk, row.scenario.id).toBe(false);
    return;
  }
  if (exp === "bypass") return;
  if (!row.apiOk) {
    expect.fail(`${row.scenario.id}: API failed — ${row.apiError}`);
  }
  expect(row.chainOutcome, row.scenario.id).toBe(exp);
}

describe.skipIf(!hasWriteCredentials() || !hasBrokerMatrixEnabled())(
  "broker response matrix (integration)",
  () => {
    let ctx: IntegrationCtx;
    const apiEnv = resolveIntegrationApiEnv();

    beforeAll(async () => {
      ctx = await setupIntegration();
    }, 180_000);

    it("documents broker/API outcomes for varied place inputs", async (testCtx) => {
      skipIntegrationApiBets(testCtx, apiEnv, ctx.ownerAddress);

      try {
        const rows = await runBrokerMatrix(ctx, apiEnv!);
        if (rows.length === 0) {
          testCtx.skip(true, "no catalog markets for broker matrix");
          return;
        }
        console.log("\n" + formatBrokerMatrixTable(rows) + "\n");
        for (const row of rows) {
          if (row.scenario.expectOutcome) assertScenario(row);
        }
      } catch (err) {
        if (isApiUnreachableError(err)) {
          testCtx.skip(true, `API unreachable at ${apiEnv!.baseUrl}`);
          return;
        }
        throw err;
      }
    }, 600_000);
  },
);

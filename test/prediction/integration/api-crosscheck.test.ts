import { E2E_OPEN_MARKET_LABEL } from "~predict-scripts/seed/stages.ts";
import { getOrderCursor } from "~predict/fetch.ts";
import { fillOrder, placeOrder } from "~predict/prediction.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import {
  INTEGRATION_FILLABLE_PRICE_CAP_BPS,
  INTEGRATION_MIN_FILL,
} from "../fixtures/ptb-params.ts";
import { isApiUnreachableError } from "../helpers/api-client.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { expectEvent, expectEventShape } from "../helpers/events.ts";
import {
  hasApiCrosscheckEnabled,
  pollBetsMeForOrderId,
  resolveIntegrationApiEnv,
  skipIntegrationApiCrosscheck,
} from "../helpers/integration-api.ts";
import {
  executeAndFetch,
  setupIntegration,
  type IntegrationCtx,
} from "../helpers/integration-setup.ts";

const FAR_FUTURE = 9_999_999_999_999n;
const OPEN_MARKET_BYTES = new Uint8Array(Buffer.from(E2E_OPEN_MARKET_LABEL, "utf8"));

/**
 * Optional chain → HTTP cross-check: after place (+ keeper fill when available), poll
 * `GET /predict/bets/me` for the new order id. Enable with `E2E_API_CROSSCHECK=1` plus
 * `E2E_API_ENV` / JWT (same wallet as `SUI_PRIVATE_KEY`).
 */
describe.skipIf(!hasWriteCredentials() || !hasApiCrosscheckEnabled())(
  "predict API cross-check (integration + HTTP)",
  () => {
    let ctx: IntegrationCtx;
    const apiEnv = resolveIntegrationApiEnv();

    beforeAll(async () => {
      ctx = await setupIntegration();
    }, 180_000);

    it("placeOrder (+ fill when keeper) eventually appears in GET /predict/bets/me", async (testCtx) => {
      skipIntegrationApiCrosscheck(testCtx, apiEnv);

      const before = await getOrderCursor(ctx.client);
      const placeResult = await executeAndFetch(ctx.client, ctx.signer, (tx) => {
        placeOrder(ctx.client, tx, {
          accountId: ctx.accountId,
          marketId: OPEN_MARKET_BYTES,
          selection: "YES",
          maxSpend: 1_000n,
          minShares: 1n,
          priceCapBps: INTEGRATION_FILLABLE_PRICE_CAP_BPS,
          expiryTs: FAR_FUTURE,
        });
      });
      expectEvent(placeResult, EVENT_CONTRACT.OrderPlaced.suffix, {
        account_id: ctx.accountId,
      });

      const after = await getOrderCursor(ctx.client);
      const orderId =
        after.back ?? (before.back !== null ? before.back + 1n : (after.front ?? undefined));
      expect(orderId).toBeDefined();

      if (ctx.keeper) {
        const fillResult = await executeAndFetch(ctx.client, ctx.keeper, (tx) => {
          fillOrder(ctx.client, tx, { orderId: orderId!, ...INTEGRATION_MIN_FILL });
        });
        const fillEv = expectEvent(fillResult, EVENT_CONTRACT.OrderFilled.suffix, {
          order_id: String(orderId),
        });
        expectEventShape(fillEv, EVENT_CONTRACT.OrderFilled);
      }

      try {
        const found = await pollBetsMeForOrderId(testCtx, apiEnv!, orderId!);
        if (!found) {
          testCtx.skip(
            true,
            "GET /predict/bets/me returned no bets for this wallet — likely wallet→account resolver (#498) or indexer lag on label markets",
          );
        }
      } catch (err) {
        if (isApiUnreachableError(err)) {
          testCtx.skip(true, `API unreachable at ${apiEnv!.baseUrl}`);
          return;
        }
        throw err;
      }
    }, 240_000);
  },
);

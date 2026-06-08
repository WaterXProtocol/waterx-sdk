import * as RootBcs from "~predict/bcs.ts";
import * as Index from "~predict/index.ts";
import * as UserAccount from "~predict/user/account.ts";
import * as UserAdmin from "~predict/user/admin.ts";
import * as UserBarrel from "~predict/user/index.ts";
import * as UserKeeper from "~predict/user/keeper.ts";
import * as UserOrder from "~predict/user/order.ts";
import * as UserPosition from "~predict/user/position.ts";
import * as UtilsBcs from "~predict/utils/bcs.ts";
import { describe, expect, it } from "vitest";

describe("user subpath exports alias handwritten modules", () => {
  it("barrel matches namespaced `user` export from index", () => {
    expect(Index.user.placeOrder).toBe(UserBarrel.placeOrder);
    expect(Index.user.createAccount).toBe(UserBarrel.createAccount);
    expect(Index.user.claim).toBe(UserBarrel.claim);
    expect(Index.user.batchClaim).toBe(UserBarrel.batchClaim);
    expect("fillOrder" in Index.user).toBe(false);
  });

  it("user/order matches prediction", () => {
    expect(UserOrder.placeOrder).toBe(Index.placeOrder);
    expect(UserOrder.selfCancelOrder).toBe(Index.selfCancelOrder);
  });

  it("user/position matches prediction subset", () => {
    expect(UserPosition.batchClaim).toBe(Index.batchClaim);
    expect(UserPosition.claim).toBe(Index.claim);
    expect(UserPosition.requestClose).toBe(Index.requestClose);
    expect(UserPosition.selfCancelClose).toBe(Index.selfCancelClose);
  });

  it("user/keeper matches prediction keeper exports", () => {
    expect(UserKeeper.batchForceClaim).toBe(Index.batchForceClaim);
    expect(UserKeeper.buildBatchForceClaimTransactions).toBe(
      Index.buildBatchForceClaimTransactions,
    );
    expect(UserKeeper.fillOrder).toBe(Index.fillOrder);
    expect(UserKeeper.cancelOrder).toBe(Index.cancelOrder);
    expect(UserKeeper.confirmClose).toBe(Index.confirmClose);
    expect(UserKeeper.cancelClose).toBe(Index.cancelClose);
    expect(UserKeeper.forceClaim).toBe(Index.forceClaim);
    expect(UserKeeper.resolveMarket).toBe(Index.resolveMarket);
    expect(UserKeeper.outcomeArg).toBe(Index.outcomeArg);
  });

  it("user/admin matches prediction + admin", () => {
    expect(UserAdmin.adminPlaceOrderFor).toBe(Index.adminPlaceOrderFor);
    expect(UserAdmin.pauseMarket).toBe(Index.pauseMarket);
    expect(UserAdmin.createMarketRegistry).toBe(Index.createMarketRegistry);
  });

  it("user/account re-exports account builders from prediction/account", () => {
    expect(UserAccount.createAccount).toBe(Index.createAccount);
    expect(UserAccount.requestWithdraw).toBe(Index.requestWithdraw);
    expect(UserAccount.whitelistPredictionProtocol).toBe(Index.whitelistPredictionProtocol);
  });

  it("utils/bcs re-exports BCS helpers from prediction/bcs", () => {
    expect(UtilsBcs.mapOrderView).toBe(RootBcs.mapOrderView);
    expect(UtilsBcs.decodeEnumVariant).toBe(RootBcs.decodeEnumVariant);
    expect(UtilsBcs.OrderViewBcs).toBe(RootBcs.OrderViewBcs);
  });
});

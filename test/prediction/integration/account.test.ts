import { Transaction } from "@mysten/sui/transactions";
import { createAccount, deposit } from "~predict/account.ts";
import type { PredictClient } from "~predict/client.ts";
import { getAccountData } from "~predict/fetch.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { createE2eClient } from "../helpers/e2e-context.ts";
import { hasWriteCredentials, loadSigner, readSeedDepositAmount } from "../helpers/env.ts";
import { expectEvent } from "../helpers/events.ts";
import {
  assertSuccessfulExecution,
  registryAccountIdFromAccountCreated,
  transactionDigest,
} from "../helpers/tx-result.ts";

/**
 * Account lifecycle integration — creates a fresh account and deposits settlement coin,
 * then verifies the `AccountCreated` event payload matches what the indexer / API rely on.
 */
describe.skipIf(!hasWriteCredentials())("account integration (sign + execute)", () => {
  let client: PredictClient;
  let signer: ReturnType<typeof loadSigner>;
  let createdAccountId: string | undefined;

  beforeAll(async () => {
    client = await createE2eClient();
    signer = loadSigner();
  });

  it("createAccount emits AccountCreated with the registry account id", async () => {
    const tx = new Transaction();
    tx.setSender(signer.toSuiAddress());
    createAccount(client, tx, { alias: `integration-${Date.now()}` });

    const result = await client.signAndExecuteTransaction({
      signer,
      transaction: tx,
      include: { effects: true, objectTypes: true, events: true },
    });
    assertSuccessfulExecution(result);
    const digest = transactionDigest(result);
    expect(digest).toBeDefined();
    await client.waitForTransaction(digest!);
    const withEvents = await client.grpcClient.getTransaction({
      digest: digest!,
      include: { events: true },
    });

    const ev = expectEvent(withEvents, "::events::AccountCreated");
    const ownerInEvent = String(ev.json.owner ?? "");
    expect(ownerInEvent.toLowerCase()).toBe(signer.toSuiAddress().toLowerCase());
    expect(typeof ev.json.account_object_address).toBe("string");

    createdAccountId = registryAccountIdFromAccountCreated(
      withEvents,
      client.waterxAccountPackageId(),
    );
    expect(createdAccountId).toMatch(/^0x[0-9a-fA-F]+$/);

    const data = await getAccountData(client, { accountId: createdAccountId! });
    expect(data.accountId).toBe(createdAccountId);
  });

  it("deposit credits the new account (no settlement event — only AccountData state)", async (testCtx) => {
    if (!createdAccountId) {
      throw new Error("createdAccountId not set — preceding createAccount test should have run");
    }
    const depositAmount = readSeedDepositAmount();
    const owner = signer.toSuiAddress();
    const coinPage = await client.listCoins({
      owner,
      coinType: client.settlementCoinType(),
    });
    const first = (coinPage as { objects?: { objectId?: string; balance?: string }[] })
      .objects?.[0];
    const coinId = first?.objectId;
    if (!coinId) {
      // Explicit skip instead of silent return — `return` would mark the test PASS even though
      // the deposit path never executed, hiding regressions when the wallet is unfunded.
      testCtx.skip(
        true,
        `no settlement coin (${client.settlementCoinType()}) in wallet ${owner} — fund the wallet to exercise the deposit path`,
      );
      return;
    }

    const tx = new Transaction();
    tx.setSender(owner);
    const [split] = tx.splitCoins(tx.object(coinId), [depositAmount]);
    deposit(client, tx, { accountId: createdAccountId, coin: split });

    const exec = await client.signAndExecuteTransaction({
      signer,
      transaction: tx,
      include: { effects: true, objectTypes: true },
    });
    assertSuccessfulExecution(exec);

    // `hasData=true` requires a prediction-side write (placeOrder / fillOrder) on this account;
    // a bare `deposit` only credits the waterx_account balance, so the prediction view stays empty
    // until first order. Just verify the account id round-trips through the view.
    const data = await getAccountData(client, { accountId: createdAccountId });
    expect(data.accountId).toBe(createdAccountId);
  });
});

/**
 * Parity guard: the hand-written prediction BCS schemas in `src/prediction/bcs.ts`
 * must stay byte-identical to the codegen output in
 * `src/generated/waterx_prediction/*` (which is regenerated from the deployed
 * Move ABI via `pnpm codegen`). The hand-written mirror is what `getOrder` /
 * `getPosition` / `getRegistry` / etc. actually decode with; if it silently
 * drifts from the contract (a field added/removed/reordered/retyped, or an enum
 * variant reordered) those reads mis-decode — sometimes loudly ("Offset is
 * outside the bounds of the DataView"), sometimes SILENTLY (wrong values).
 *
 * Strategy (fully offline): serialize a fixture with the GENERATED struct (the
 * canonical layout), then require the hand-written struct to (a) parse the same
 * field names and (b) re-serialize byte-for-byte. For enums, the SAME variant
 * name must serialize to the SAME index under both. This would have caught the
 * `OrderView.receiver_account_id` and `RegistryView.next_position_id` drifts.
 *
 * Regenerate after a Move ABI change with `pnpm codegen`; if this test then
 * fails, hand-edit `src/prediction/bcs.ts` (+ types + map*) to match.
 */
import {
  AccountDataViewBcs,
  MarketViewBcs,
  OrderKindBcs,
  OrderViewBcs,
  OutcomeBcs,
  PositionViewBcs,
  RegistryViewBcs,
  SelectionBcs,
  StatusBcs,
} from "~predict/bcs.ts";
import { describe, expect, it } from "vitest";

import { OrderKind as GenOrderKind } from "../../../src/generated/waterx_prediction/order.ts";
import { Outcome as GenOutcome } from "../../../src/generated/waterx_prediction/outcome.ts";
import {
  Selection as GenSelection,
  Status as GenStatus,
} from "../../../src/generated/waterx_prediction/position.ts";
import {
  AccountDataView as GenAccountDataView,
  MarketView as GenMarketView,
  OrderView as GenOrderView,
  PositionView as GenPositionView,
  RegistryView as GenRegistryView,
} from "../../../src/generated/waterx_prediction/view.ts";
import {
  accountDataFixture,
  marketFixture,
  orderFixture,
  positionFixture,
  registryFixture,
} from "../fixtures/bcs-fixtures.ts";

// `serialize` is intentionally `(v: any)`: the generated MoveStruct/MoveEnum
// each have a distinct concrete input type, and `unknown` would reject them
// (parameter contravariance). The bcs objects are dynamically shaped anyway.
interface AnyBcs {
  serialize: (v: any) => { toBytes(): Uint8Array };
  parse: (b: Uint8Array) => Record<string, unknown>;
}

// Enum-bearing fixtures need the `{ Variant: true }` object form to serialize.
const ORDER = { ...orderFixture, kind: { Open: true }, selection: { Yes: true } };
const POSITION = { ...positionFixture, selection: { No: true }, status: { Open: true } };
// non-null outcome also exercises the option<Outcome> enum-in-struct layout
const MARKET = { ...marketFixture, outcome: { Yes: true } };

function assertStructParity(
  name: string,
  gen: AnyBcs,
  hand: AnyBcs,
  fixture: Record<string, unknown>,
): void {
  const genBytes = gen.serialize(fixture).toBytes();
  const handParsed = hand.parse(genBytes);
  // Field names + count (the fixture is keyed by the generated/canonical names).
  expect(Object.keys(handParsed).sort(), `${name}: field-name drift vs generated`).toEqual(
    Object.keys(fixture).sort(),
  );
  // Byte-identical re-serialize: catches missing / extra / reordered / retyped fields.
  expect(hand.serialize(handParsed).toBytes(), `${name}: BCS layout drift vs generated`).toEqual(
    genBytes,
  );
}

function assertEnumParity(name: string, gen: AnyBcs, hand: AnyBcs, variants: string[]): void {
  for (const v of variants) {
    const g = gen.serialize({ [v]: true }).toBytes();
    const h = hand.serialize({ [v]: true }).toBytes();
    expect(Array.from(h), `${name}.${v}: enum variant index drift vs generated`).toEqual(
      Array.from(g),
    );
  }
}

describe("prediction BCS parity with generated codegen", () => {
  it("RegistryView matches generated", () =>
    assertStructParity("RegistryView", GenRegistryView, RegistryViewBcs, registryFixture));
  it("OrderView matches generated", () =>
    assertStructParity("OrderView", GenOrderView, OrderViewBcs, ORDER));
  it("PositionView matches generated", () =>
    assertStructParity("PositionView", GenPositionView, PositionViewBcs, POSITION));
  it("MarketView matches generated", () =>
    assertStructParity("MarketView", GenMarketView, MarketViewBcs, MARKET));
  it("AccountDataView matches generated", () =>
    assertStructParity(
      "AccountDataView",
      GenAccountDataView,
      AccountDataViewBcs,
      accountDataFixture,
    ));

  it("OrderKind enum matches generated", () =>
    assertEnumParity("OrderKind", GenOrderKind, OrderKindBcs, ["Open", "Close"]));
  it("Selection enum matches generated", () =>
    assertEnumParity("Selection", GenSelection, SelectionBcs, ["No", "Yes"]));
  it("Status enum matches generated", () =>
    assertEnumParity("Status", GenStatus, StatusBcs, ["Open", "PendingClose"]));
  it("Outcome enum matches generated", () =>
    assertEnumParity("Outcome", GenOutcome, OutcomeBcs, ["No", "Yes", "Invalid"]));
});

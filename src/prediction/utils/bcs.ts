/**
 * Public-subpath barrel for `@waterx/sdk/prediction/utils/bcs` (package.json `exports`).
 * Thin re-export of the flat impl in `../bcs.ts`; pinned by `user-exports.test.ts`
 * ("utils/bcs re-exports BCS helpers from prediction/bcs"). Not dead duplication.
 */
export {
  AccountDataViewBcs,
  MarketViewBcs,
  OrderKindBcs,
  OrderViewBcs,
  OutcomeBcs,
  PositionViewBcs,
  RegistryViewBcs,
  SelectionBcs,
  StatusBcs,
  decodeEnumVariant,
  mapAccountDataView,
  mapCursorView,
  mapMarketView,
  mapOrderKind,
  mapOrderView,
  mapOutcome,
  mapPositionView,
  mapRegistryView,
  mapSelection,
  mapStatus,
} from "../bcs.ts";

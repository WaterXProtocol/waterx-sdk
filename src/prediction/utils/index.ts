/**
 * Public-subpath barrel for `@waterx/sdk/prediction/utils` (package.json `exports`).
 * Intentionally a thin re-export of the flat impl in `../utils.ts` — the flat file
 * keeps its own `~predict/utils.ts` subpath + internal relative imports, while this
 * folder exposes the grouped `prediction/utils` / `prediction/utils/bcs` namespace.
 * Pinned by `test/post-build/package-exports.test.ts`. Not dead duplication.
 */
export {
  assertOutcome,
  assertSelection,
  assertU64,
  bytesToHex,
  clockArg,
  createAccountRequest,
  marketIdArg,
  marketIdBytesFromUnknown,
  normalizeMarketId,
  objectArg,
  optionU64,
  receivingCoinArg,
  requireConfig,
  resolveAccountPackageId,
  resolveAccountRegistry,
  resolveGlobalConfig,
  resolveMarketRegistry,
  resolvePackageId,
  resolveSettlementCoinType,
  toBigInt,
} from "../utils.ts";

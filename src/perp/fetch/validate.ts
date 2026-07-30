// Integer-domain guards for `perp/fetch` params — re-exported from the shared
// `utils/validate.ts` so the fetch and write (tx-build) surfaces share one
// implementation. See that module for the rationale (silent BCS mis-encoding
// of non-safe integers).

export { toU64, toU128, U64_MAX } from "../../utils/validate.ts";

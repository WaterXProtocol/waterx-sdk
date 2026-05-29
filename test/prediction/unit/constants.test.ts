import {
  ACCOUNT_PERM_ALL,
  DEFAULT_FORCE_CLAIM_CHUNK_SIZE,
  PREDICTION_ERROR_CODES,
  PREDICTION_PERM_ALL,
  PREDICTION_PERM_CANCEL_ORDER,
  PREDICTION_PERM_CLAIM,
  PREDICTION_PERM_PLACE_ORDER,
  PREDICTION_PERM_REQUEST_CLOSE,
} from "~predict/constants.ts";
import { describe, expect, it } from "vitest";

describe("constants", () => {
  it("prediction permission bitmask aggregates child bits", () => {
    expect(PREDICTION_PERM_ALL).toBe(
      PREDICTION_PERM_PLACE_ORDER |
        PREDICTION_PERM_CANCEL_ORDER |
        PREDICTION_PERM_CLAIM |
        PREDICTION_PERM_REQUEST_CLOSE,
    );
    expect(ACCOUNT_PERM_ALL).toBe(0xffffffff);
  });

  it("PREDICTION_ERROR_CODES covers documented abort codes", () => {
    expect(PREDICTION_ERROR_CODES.EUnauthorized).toBe(14);
    expect(PREDICTION_ERROR_CODES.EMarketPaused).toBe(10);
  });

  it("DEFAULT_FORCE_CLAIM_CHUNK_SIZE is 1000", () => {
    expect(DEFAULT_FORCE_CLAIM_CHUNK_SIZE).toBe(1000);
  });
});

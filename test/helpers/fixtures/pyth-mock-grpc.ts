import { vi } from "vitest";

import type { WaterXClient } from "../../../src/client.ts";
import {
  DEFAULT_MOCK_PYTH_ROW_TYPE,
  MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT,
  MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT,
  mockSuiAddress,
} from "./sui-mock-fixtures.ts";

const PYTH_STATE = mockSuiAddress("c1");
const WORMHOLE_STATE = mockSuiAddress("c2");
const PRICE_TABLE_CHILD = mockSuiAddress("c3");
const PRICE_INFO_OBJECT = mockSuiAddress("c4");

/** Minimal accumulator layout for `extractVaaBytes` (trailing=0, vaa len=2). */
export function mockAccumulatorUpdate(): Uint8Array {
  const buf = new Uint8Array(12);
  buf[6] = 0;
  buf[7] = 0;
  buf[8] = 0;
  buf[9] = 2;
  buf[10] = 0xaa;
  buf[11] = 0xbb;
  return buf;
}

export function attachPythGrpcMocks(client: WaterXClient) {
  const upgradeCapJson = { package: MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT };
  const pythStateJson = {
    upgrade_cap: upgradeCapJson,
    fields: { base_update_fee: "1000" },
  };
  const wormholeJson = { upgrade_cap: { package: MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT } };

  const feedIdHex = "f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b";
  const feedBytes = new Uint8Array(32);
  feedBytes.fill(0xf9);

  client.grpcClient = {
    getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
      if (objectId === client.pyth.state_id) {
        return { object: { json: pythStateJson } };
      }
      if (objectId === client.pyth.wormhole_state_id) {
        return { object: { json: wormholeJson } };
      }
      return { object: { json: null } };
    }),
    listDynamicFields: vi.fn(async () => ({
      dynamicFields: [
        {
          childId: PRICE_TABLE_CHILD,
          valueType: DEFAULT_MOCK_PYTH_ROW_TYPE,
        },
      ],
    })),
    getDynamicField: vi.fn(async () => ({
      dynamicField: { value: { bcs: feedBytes } },
    })),
  } as unknown as WaterXClient["grpcClient"];

  client.pyth = {
    ...client.pyth,
    state_id: PYTH_STATE,
    wormhole_state_id: WORMHOLE_STATE,
  };

  return { priceInfoObjectId: PRICE_INFO_OBJECT, feedId: `0x${feedIdHex}` };
}

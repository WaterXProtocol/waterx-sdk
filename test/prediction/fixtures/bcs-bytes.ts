import { bcs } from "@mysten/sui/bcs";
import {
  AccountDataViewBcs,
  MarketViewBcs,
  OrderViewBcs,
  PositionViewBcs,
  RegistryViewBcs,
} from "~predict/bcs.ts";

import {
  accountDataFixture,
  marketFixture,
  orderFixture,
  positionFixture,
  registryFixture,
} from "./bcs-fixtures.ts";

type Serialized = Uint8Array | { toBytes(): Uint8Array };

function toBytes(value: Serialized): Uint8Array {
  return value instanceof Uint8Array ? value : value.toBytes();
}

export function registryViewBytes(): Uint8Array {
  return toBytes(RegistryViewBcs.serialize(registryFixture));
}

export function orderViewBytes(): Uint8Array {
  return toBytes(
    OrderViewBcs.serialize({
      ...orderFixture,
      kind: { Open: true },
      selection: { Yes: true },
    }),
  );
}

export function positionViewBytes(): Uint8Array {
  return toBytes(
    PositionViewBcs.serialize({
      ...positionFixture,
      selection: { No: true },
      status: { Open: true },
    }),
  );
}

export function marketViewBytes(): Uint8Array {
  return toBytes(MarketViewBcs.serialize(marketFixture));
}

export function accountDataViewBytes(): Uint8Array {
  return toBytes(AccountDataViewBcs.serialize(accountDataFixture));
}

export function cursorViewBytes(
  count = 5n,
  front: bigint | null = 2n,
  back: bigint | null = null,
): Uint8Array[] {
  return [
    toBytes(bcs.u64().serialize(count)),
    toBytes(bcs.option(bcs.u64()).serialize(front)),
    toBytes(bcs.option(bcs.u64()).serialize(back)),
  ];
}

export function u64VectorBytes(values: bigint[]): Uint8Array {
  return toBytes(bcs.vector(bcs.u64()).serialize(values));
}

export function u16VectorBytes(values: number[]): Uint8Array {
  return toBytes(bcs.vector(bcs.u16()).serialize(values));
}

export function u64Bytes(value: bigint): Uint8Array {
  return toBytes(bcs.u64().serialize(value));
}

export function boolBytes(value: boolean): Uint8Array {
  return toBytes(bcs.bool().serialize(value));
}

export function addressVectorBytes(addresses: string[]): Uint8Array {
  return toBytes(bcs.vector(bcs.Address).serialize(addresses));
}

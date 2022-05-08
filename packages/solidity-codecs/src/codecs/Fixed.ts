import { Codec } from "../types"
import { enhanceCodec } from "../utils"

export interface Decimal<T extends number = number> {
  value: bigint
  decimals: T
}

export const Fixed = <D extends number>(
  baseCodec: Codec<bigint>,
  decimals: D,
) =>
  enhanceCodec<bigint, Decimal<D>>(
    baseCodec,
    (x) => x.value,
    (value) => ({ value, decimals }),
  )

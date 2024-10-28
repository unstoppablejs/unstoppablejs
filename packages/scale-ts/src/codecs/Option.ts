import { Decoder, Encoder, Codec } from "../types"
import { mergeUint8, toInternalBytes } from "../internal"
import { createCodec } from "../utils"
import { u8 } from "./fixed-width-ints"

const OptionDec = <T>(inner: Decoder<T>): Decoder<T | undefined> =>
  toInternalBytes<T | undefined>((bytes) =>
    u8[1](bytes) > 0 ? inner(bytes) : undefined,
  )

const OptionEnc =
  <T>(inner: Encoder<T>): Encoder<T | undefined> =>
  (value) => {
    const result = new Uint8Array(1)
    if (value === undefined) return result
    result[0] = 1
    return mergeUint8([result, inner(value)])
  }

export const Option = <T>(inner: Codec<T>): Codec<T | undefined> =>
  createCodec(OptionEnc(inner[0]), OptionDec(inner[1]))

Option.enc = OptionEnc
Option.dec = OptionDec

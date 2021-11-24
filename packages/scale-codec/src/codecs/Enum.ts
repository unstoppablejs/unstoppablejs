import { mapObject, mergeUint8 } from "@unstoppablejs/utils"
import { Codec, Decoder, Encoder } from "../types"
import { toInternalBytes, createCodec } from "../utils"
import { u8 } from "./u8"

const enumEnc = <
  O extends { [P in keyof any]: Encoder<any> },
  OT extends {
    [K in keyof O]: O[K] extends Encoder<infer D>
      ? { tag: K; value: D }
      : unknown
  },
>(
  inner: O,
): Encoder<OT[keyof O]> => {
  const keys = Object.keys(inner)
  return ({ tag, value }: any) => {
    const idx = keys.indexOf(tag)
    return mergeUint8(u8.enc(idx), inner[tag](value))
  }
}

const enumDec = <
  O extends { [P in keyof any]: Decoder<any> },
  OT extends {
    [K in keyof O]: O[K] extends Decoder<infer D>
      ? { tag: K; value: D }
      : unknown
  },
>(
  inner: O,
): Decoder<OT[keyof O]> => {
  const entries = Object.entries(inner)

  return toInternalBytes((bytes) => {
    const idx = u8.dec(bytes)
    const [tag, innerDecoder] = entries[idx]
    const innerResult = innerDecoder(bytes)

    return {
      tag,
      value: innerResult,
    } as OT[keyof O]
  })
}

export const Enum = <
  O extends { [P in keyof any]: Codec<any> },
  OT extends {
    [K in keyof O]: O[K] extends Codec<infer D> ? { tag: K; value: D } : unknown
  },
>(
  inner: O,
): Codec<OT[keyof O]> =>
  createCodec<OT[keyof O]>(
    enumEnc(mapObject(inner, ([encoder]) => encoder) as any) as any,
    enumDec(mapObject(inner, ([, decoder]) => decoder) as any),
  )

Enum.enc = enumEnc
Enum.dec = enumDec

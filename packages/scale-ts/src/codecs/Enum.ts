import {
  Codec,
  CodecType,
  Decoder,
  DecoderType,
  Encoder,
  EncoderType,
  StringRecord,
} from "../types"
import { toInternalBytes, mapObject, mergeUint8 } from "../internal"
import { createCodec, u8 } from "../"

type Tuple<T, N extends number> = readonly [T, ...T[]] & { length: N }

type Push<T extends any[], V> = [...T, V]

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never

type LastOf<T> = UnionToIntersection<
  T extends any ? () => T : never
> extends () => infer R
  ? R
  : never

type TuplifyUnion<
  T,
  L = LastOf<T>,
  N = [T] extends [never] ? true : false,
> = true extends N ? [] : Push<TuplifyUnion<Exclude<T, L>>, L>

type RestrictedLenTuple<T, O extends StringRecord<any>> = Tuple<
  T,
  TuplifyUnion<keyof O> extends Tuple<any, infer V> ? V : 0
>

const enumEnc = <O extends StringRecord<Encoder<any>>>(
  inner: O,
  x?: RestrictedLenTuple<number, O>,
): Encoder<
  {
    [K in keyof O]: { tag: K; value: EncoderType<O[K]> }
  }[keyof O]
> => {
  const keys = Object.keys(inner)
  const mappedKeys = new Map<keyof O, number>(
    x?.map((actualIdx, idx) => [keys[idx], actualIdx]) ??
      keys.map((key, idx) => [key, idx]),
  )
  const getKey = (key: keyof O) => mappedKeys.get(key)!

  return ({ tag, value }) =>
    mergeUint8(u8.enc(getKey(tag)), (inner as any)[tag](value))
}

const enumDec = <O extends StringRecord<Decoder<any>>>(
  inner: O,
  x?: RestrictedLenTuple<number, O>,
): Decoder<
  {
    [K in keyof O]: { tag: K; value: DecoderType<O[K]> }
  }[keyof O]
> => {
  const keys = Object.keys(inner)
  const mappedKeys = new Map<number, string>(
    x?.map((actualIdx, idx) => [actualIdx, keys[idx]]) ??
      keys.map((key, idx) => [idx, key]),
  )

  return toInternalBytes((bytes) => {
    const idx = u8.dec(bytes)
    const tag = mappedKeys.get(idx)!
    const innerDecoder = inner[tag]
    return {
      tag,
      value: innerDecoder(bytes),
    }
  })
}

export const Enum = <O extends StringRecord<Codec<any>>>(
  inner: O,
  ...args: [indexes?: RestrictedLenTuple<number, O>]
): Codec<
  {
    [K in keyof O]: { tag: K; value: CodecType<O[K]> }
  }[keyof O]
> =>
  createCodec(
    enumEnc(
      mapObject(inner, ([encoder]) => encoder) as StringRecord<
        O[keyof O]["enc"]
      >,
      ...(args as any[]),
    ) as Encoder<
      {
        [K in keyof O]: { tag: K; value: CodecType<O[K]> }
      }[keyof O]
    >,
    enumDec(
      mapObject(inner, ([, decoder]) => decoder) as StringRecord<
        O[keyof O]["dec"]
      >,
      ...(args as any[]),
    ) as Decoder<
      {
        [K in keyof O]: { tag: K; value: CodecType<O[K]> }
      }[keyof O]
    >,
  )

Enum.enc = enumEnc
Enum.dec = enumDec

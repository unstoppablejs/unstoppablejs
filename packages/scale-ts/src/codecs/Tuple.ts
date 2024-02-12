import { Codec, Decoder, Encoder } from "../types"
import { mergeUint8, toInternalBytes } from "../internal"
import { createCodec } from "../utils"

const TupleDec = <A extends Array<Decoder<any>>>(
  ...decoders: A
): Decoder<{ [K in keyof A]: A[K] extends Decoder<infer D> ? D : unknown }> =>
  toInternalBytes((bytes) => decoders.map((decoder) => decoder(bytes)) as any)

const TupleEnc =
  <A extends Array<Encoder<any>>>(
    ...encoders: A
  ): Encoder<{ [K in keyof A]: A[K] extends Encoder<infer D> ? D : unknown }> =>
  (values) =>
    mergeUint8(encoders.map((enc, idx) => enc(values[idx])))

export const Tuple = <A extends Array<Codec<any>>>(
  ...codecs: A
): Codec<{ [K in keyof A]: A[K] extends Codec<infer D> ? D : unknown }> =>
  createCodec(
    TupleEnc(...codecs.map(([encoder]) => encoder)),
    TupleDec(...codecs.map(([, decoder]) => decoder)),
  ) as any

Tuple.enc = TupleEnc
Tuple.dec = TupleDec

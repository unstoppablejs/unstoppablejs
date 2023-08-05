import { mapObject } from "../internal"
import {
  Codec,
  EncoderType,
  DecoderType,
  CodecType,
  Decoder,
  Encoder,
  StringRecord,
} from "../types"
import { createCodec, enhanceDecoder, enhanceEncoder } from "../utils"
import { Tuple } from "./Tuple"

const StructEnc = <A extends StringRecord<Encoder<any>>>(
  encoders: A,
): Encoder<{ [K in keyof A]: EncoderType<A[K]> }> => {
  const keys = Object.keys(encoders)
  return enhanceEncoder(
    Tuple.enc(...Object.values(encoders)),
    (input: { [K in keyof A]: EncoderType<A[K]> }) => keys.map((k) => input[k]),
  )
}

const StructDec = <A extends StringRecord<Decoder<any>>>(
  decoders: A,
): Decoder<{ [K in keyof A]: DecoderType<A[K]> }> => {
  const keys = Object.keys(decoders)
  return enhanceDecoder(
    Tuple.dec(...Object.values(decoders)),
    (tuple: Array<any>) =>
      Object.fromEntries(tuple.map((value, idx) => [keys[idx], value])) as any,
  )
}

export const Struct = <A extends StringRecord<Codec<any>>>(
  codecs: A,
): Codec<{ [K in keyof A]: CodecType<A[K]> }> =>
  createCodec(
    StructEnc(
      mapObject(codecs, (x) => x[0]) as StringRecord<A[keyof A][0]>,
    ) as any,
    StructDec(
      mapObject(codecs, (x) => x[1]) as StringRecord<A[keyof A][1]>,
    ) as any,
  )

Struct.enc = StructEnc
Struct.dec = StructDec

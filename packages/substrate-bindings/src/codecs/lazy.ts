import { Codec, Decoder, Encoder, createCodec } from "scale-ts"

export const lazyEncoder = <T>(value: () => Encoder<T>): Encoder<() => T> => {
  let cache: Encoder<T> = (x) => {
    const encoder = value()
    const result = encoder
    cache = encoder
    return result(x)
  }
  return (x) => cache(x())
}

export const lazyDecoder = <T>(value: () => Decoder<T>): Decoder<() => T> => {
  let cache: Decoder<T> = (x) => {
    const decoder = value()
    const result = decoder
    cache = decoder
    return result(x)
  }

  return (x) => () => cache(x)
}

export const lazy = <T>(value: () => Codec<T>): Codec<() => T> =>
  createCodec(
    lazyEncoder(() => value().enc),
    lazyDecoder(() => value().dec),
  )

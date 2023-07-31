import {
  Codec,
  Decoder,
  Encoder,
  createCodec,
  Struct,
  Tuple,
  u8,
  Enum,
} from "scale-ts"

export const lazyEncoder = <T>(value: () => Encoder<T>): Encoder<() => T> => {
  let cache: Encoder<T> = (x) => {
    const encoder = value()
    cache = encoder
    return encoder(x)
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

const a = Struct({ foo: u8 })
const b = Struct({ bar: u8 })
const c = Tuple(a, b)

const lazyD: Codec<() => typeof d extends Codec<infer V> ? V : unknown> = lazy(
  () => d,
)

export const d = Enum({
  first: c,
  second: lazyD,
})

export const stuffToEncode: typeof d extends Codec<infer V> ? V : unknown = {
  tag: "second",
  value: () => ({
    tag: "first",
    value: [{ foo: 2 }, { bar: 3 }],
  }),
}

import { createCodec, u16, u8 } from "scale-ts"

interface Mortal {
  period: number
  phase: number
}
export type Mortality = Mortal | null

function trailingZeroes(n: number) {
  let i = 0
  while (!(n & 1)) {
    i++
    n >>= 1
  }
  return i
}

const mortalDecoder = (firstByte: number, secondByte: number): Mortal => {
  const encoded = u16.dec(new Uint8Array([firstByte, secondByte]))
  const period = 2 << encoded % (1 << 4)
  const quantizeFactor = Math.max(period >> 12, 1)
  const phase = (encoded >> 4) * quantizeFactor
  return { period, phase }
}

const mortalEncoder = (value: Mortal): Uint8Array => {
  const quantizeFactor = Math.max(value.period >> 12, 1)
  const encoded =
    Math.min(Math.max(trailingZeroes(value.period) - 1, 1), 15) |
    ((value.phase / quantizeFactor) << 4)

  return u16.enc(encoded)
}

const mortalityEncoder = (input: Mortality): Uint8Array =>
  input ? mortalEncoder(input) : u8.enc(0)

const mortalityDecoder = (
  input: string | Uint8Array | ArrayBuffer,
): Mortality => {
  const firstByte = u8.dec(input)
  if (firstByte === 0) return null

  const secondByte = u8.dec(input)
  return mortalDecoder(firstByte, secondByte)
}

export const mortality = createCodec(mortalityEncoder, mortalityDecoder)

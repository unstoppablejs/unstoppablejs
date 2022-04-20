import { createCodec } from "../"
import { toInternalBytes } from "../internal"
import { u8, u16, u32, u64 } from "./fixed-width-ints"
import { Decoder, Encoder, Codec } from "../types"

const decoders = [u8[1], u16[1], u32[1]]

const compactDec: Decoder<number | bigint> = toInternalBytes<number | bigint>(
  (bytes) => {
    const usedBytes = bytes.i
    const init = bytes[usedBytes]

    const kind = init & 3
    if (kind !== 3) return decoders[kind](bytes) >>> 2

    const nBytes = (init >>> 2) + 4
    bytes.i++

    const nU64 = (nBytes / 8) | 0
    let nReminders = nBytes % 8
    const nU32 = (nReminders / 4) | 0
    nReminders %= 4

    let result = 0n
    let nBits = 0n
    ;(
      [
        [nReminders % 2, u8[1], 8n],
        [(nReminders / 2) | 0, u16[1], 16n],
        [nU32, u32[1], 32n],
        [nU64, u64[1], 64n],
      ] as const
    ).forEach(([len, dec, inc]) => {
      for (let i = 0; i < len; i++) {
        result = (BigInt(dec(bytes)) << nBits) | result
        nBits += inc
      }
    })
    return result
  },
)

const SINGLE_BYTE_MODE_LIMIT = 1 << 6
const TWO_BYTE_MODE_LIMIT = 1 << 14
const FOUR_BYTE_MODE_LIMIT = 1 << 30
const compactEnc: Encoder<number | bigint> = (input) => {
  if (input < 0) throw new Error(`Wrong Compat input (${input})`)

  if (input < SINGLE_BYTE_MODE_LIMIT) return u8[0](Number(input) << 2)
  if (input < TWO_BYTE_MODE_LIMIT) return u16[0]((Number(input) << 2) | 1)
  if (input < FOUR_BYTE_MODE_LIMIT) return u32[0]((Number(input) << 2) | 2)

  const result: number[] = [0]
  let tmp = BigInt(input)
  while (tmp > 0) {
    result.push(Number(tmp))
    tmp >>= 8n
  }
  result[0] = ((result.length - 5) << 2) | 3
  return new Uint8Array(result)
}

export const compact: Codec<number | bigint> = createCodec(
  compactEnc,
  compactDec,
)

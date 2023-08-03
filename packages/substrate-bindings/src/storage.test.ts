import { fc, it } from "@fast-check/vitest"
import { expect, describe, vi } from "vitest"
import { mergeUint8, toHex } from "@unstoppablejs/utils"
import { _void } from "@unstoppablejs/substrate-codecs"

describe("storage", () => {
  it.prop([fc.uint8Array(), fc.string(), fc.string()])(
    "should just encode palette item",
    async (hash, pallet, name) => {
      vi.doMock("./hashes", () => ({
        Twox128: (_: Uint8Array) => hash,
      }))

      const { Storage } = await import(`./storage?${Date.now()}`)

      const FooStorage = Storage(pallet)
      const FooBarStorage = FooStorage(name, _void.dec)

      expect(FooBarStorage.enc()).toStrictEqual(toHex(mergeUint8(hash, hash)))
    },
  )

  it.prop([fc.uint8Array(), fc.anything()])(
    "should use supplied decoder",
    async (input, anything) => {
      const { Storage } = await import("./storage")
      const FooStorage = Storage("foo")
      const FooBarStorage = FooStorage("bar", (_) => anything)

      expect(FooBarStorage.dec(input)).toStrictEqual(anything)
    },
  )
})

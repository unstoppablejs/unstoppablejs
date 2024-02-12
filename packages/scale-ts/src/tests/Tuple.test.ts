import { Tuple, compact, bool } from "../"
import { testCodec, toHex } from "./test-utils"

const codec = Tuple(compact, bool)
const tester = testCodec(codec)

describe("Tuple", () => {
  it("works", () => {
    tester([3, false], "0x0c00")
  })

  it("still works", () => {
    expect(toHex(codec.enc([3, false, true] as any))).toEqual("0x0c00")
  })
})

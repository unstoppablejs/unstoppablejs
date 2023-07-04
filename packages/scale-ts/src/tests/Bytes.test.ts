import { Bytes } from "../"
import { testCodec } from "./test-utils"

describe("Bytes", () => {
  it("works", () => {
    const tester = testCodec(Bytes(3))
    tester(new Uint8Array([0, 15, 255]), "0x000fff")
  })

  it("greedy", () => {
    const codec = Bytes(Infinity)
    const value = new Uint8Array([0, 15, 255, 1])
    expect(codec[0](value)).toEqual(value)
    expect(codec[1]("0x000fff01")).toEqual(value)
    expect(codec[1]("0x00fff01")).toEqual(value)
  })

  it("Bytes()", () => {
    const tester = testCodec(Bytes())
    tester(new Uint8Array([0, 15, 255]), "0x0c000fff")
  })
})

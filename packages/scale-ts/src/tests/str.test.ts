import { str } from "../"
import { testCodec } from "./test-utils"

const tester = testCodec(str)

describe("string", () => {
  it("works", () => {
    const value = "a$ยขเคนโฌํ๐๐"
    const hex = "0x546124c2a2e0a4b9e282aced959cf0908d88f09f9883"
    tester(value, hex)
  })
})

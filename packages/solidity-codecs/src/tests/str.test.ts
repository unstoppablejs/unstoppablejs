import { str } from "../"
import { testCodec } from "./test-utils"

const tester = testCodec(str)

describe("string", () => {
  it("works", () => {
    const value = "a$ยขเคนโฌํ๐๐"
    const val8 =
      "0000000000000000000000000000000000000000000000000000000000000015"
    const text =
      "6124c2a2e0a4b9e282aced959cf0908d88f09f98830000000000000000000000"
    tester(value, `0x${val8}${text}`)
  })
})

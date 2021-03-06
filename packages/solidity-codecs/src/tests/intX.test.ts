import { int56, int } from "../"
import { testCodec } from "./test-utils"

describe("int", () => {
  describe("int56", () => {
    const tester = testCodec(int56)
    it("0", () => {
      tester(
        0n,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      )
    })

    it("1", () => {
      tester(
        1n,
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      )
    })

    it("-1", () => {
      tester(
        -1n,
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      )
    })

    it("max", () => {
      tester(
        36028797018963967n,
        "0x000000000000000000000000000000000000000000000000007fffffffffffff",
      )
    })

    it("min", () => {
      tester(
        -36028797018963968n,
        "0xffffffffffffffffffffffffffffffffffffffffffffffffff80000000000000",
      )
    })
  })
  describe("int256", () => {
    const tester = testCodec(int)
    it("max", () => {
      tester(
        57896044618658097711785492504343953926634992332820282019728792003956564819967n,
        "0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      )
    })
    it("min", () => {
      tester(
        -57896044618658097711785492504343953926634992332820282019728792003956564819968n,
        "0x8000000000000000000000000000000000000000000000000000000000000000",
      )
    })
  })
})

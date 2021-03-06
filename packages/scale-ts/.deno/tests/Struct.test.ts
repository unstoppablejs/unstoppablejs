import { Struct, bool, str, u32, Vector, Enum, _void } from "../index.ts"
import { testCodec } from "./test-utils.ts"

describe("Struct", () => {
  it("encodes and decodes complex Objects", () => {
    const tester = testCodec(
      Struct({
        id: u32,
        name: str,
        friendIds: Vector(u32),
        event: Enum({
          _void,
          one: str,
          many: Vector(str),
          allOrNothing: bool,
        }),
      }),
    )

    tester(
      {
        id: 100,
        name: "Some name",
        friendIds: [1, 2, 3],
        event: { tag: "allOrNothing" as const, value: true },
      },
      "0x6400000024536f6d65206e616d650c0100000002000000030000000301",
    )
  })

  it("encodes Objects correctly, even when the key order is different", () => {
    const decoder = Struct({
      id: u32,
      name: str,
      friendIds: Vector(u32),
      event: Enum({
        one: str,
        many: Vector(str),
        allOrNothing: bool,
      }),
    })

    const tester = testCodec(decoder)

    tester(
      {
        event: { tag: "allOrNothing" as const, value: true },
        friendIds: [1, 2, 3],
        name: "Some name",
        id: 100,
      },
      "0x6400000024536f6d65206e616d650c0100000002000000030000000201",
    )
  })
})

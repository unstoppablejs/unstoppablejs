import { utf16StrToUtf8Bytes, utf8BytesToUtf16Str } from "./"

describe("utf16-string <-> utf8-bytes", () => {
  it("encodes utf16 strings to utf8 bytes and it decodes them correctly", () => {
    const input = "a$ยขเคนโฌํ๐๐"
    const output = utf8BytesToUtf16Str(utf16StrToUtf8Bytes(input))
    expect(input).toBe(output)
  })
})

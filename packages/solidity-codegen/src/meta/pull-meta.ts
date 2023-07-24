import { Enum, Struct, bool, u32 } from "scale-ts"
import { client } from "../../client"
import { v14 } from "./v14"

const [, decodeMeta] = Struct({
  magicNumber: u32,
  metadata: Enum({
    v0: bool,
    v1: bool,
    v2: bool,
    v3: bool,
    v4: bool,
    v5: bool,
    v6: bool,
    v7: bool,
    v8: bool,
    v9: bool,
    v10: bool,
    v11: bool,
    v12: bool,
    v13: bool,
    v14,
  }),
})

client.requestReply("state_getMetadata", [], (x) => {
  console.log(JSON.stringify(decodeMeta(x as any), null, 2))
  client.disconnect()
})

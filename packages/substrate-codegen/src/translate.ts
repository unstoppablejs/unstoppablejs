import type { Codec, StringRecord } from "scale-ts"
import { lookup } from "./metadata/lookup"
import { hashType, pallets as palletsCodec } from "./metadata/pallets"

import data from "./latest-metadata.json"

type LookupCodec = typeof lookup
type LookupData = LookupCodec extends Codec<infer V> ? V : unknown
const lookupData: LookupData = (data as any).metadata.value.lookup as any

const getVarName = (idx: number): string => {
  const {
    type: { path },
  } = lookupData[idx]
  if (path.length === 0) return "cdc" + idx
  return "c" + path.map((x) => x[0].toUpperCase() + x.slice(1)).join("")
}

type CodecEntry = {
  id: number
  name: string
} & (
  | { type: "primitive"; value: string }
  | { type: "value"; value: string }
  | { type: "pointer"; value: string; pointer: number }
) &
  (
    | { isCircular: false }
    | {
        isCircular: true
        circularName: string
        circularValue: string
      }
  )
const codecs = new Map<number, CodecEntry>()
const order: Array<{ id: number; circular?: boolean }> = []
const imports = new Set<string>()

const from = new Set<number>()

const withCache = (
  fn: (id: number) =>
    | {
        type: "primitive" | "value"
        value: string
      }
    | { type: "pointer"; value: string; pointer: number },
): ((id: number) => string) => {
  return (id) => {
    let entry = codecs.get(id)

    // first let's deal with circular references
    if (entry?.isCircular && entry.value === "") {
      return entry.circularName
    }

    if (entry) {
      return entry!.type === "value" ? entry!.name : entry!.value
    }

    if (from.has(id)) {
      const name = getVarName(id)
      const circularName = "circular" + name
      const circularValue = `: Codec<
  () => typeof ${name} extends Codec<infer V> ? V : unknown
> = lazy(() => ${name})`
      entry = {
        id,
        isCircular: true,
        name,
        type: "value",
        value: "",
        circularName,
        circularValue,
      }
      codecs.set(id, entry)
      imports.add("lazy")
      imports.add("Codec")

      order.push({ id, circular: true })
      return circularName
    }

    from.add(id)

    const value = fn(id)

    entry = codecs.get(id)
    if (entry?.isCircular) {
      entry = Object.assign(entry, value)
    } else {
      const name = getVarName(id)
      entry = {
        id,
        isCircular: false,
        name,
        ...value,
      }
      codecs.set(id, entry!)
    }
    order.push({ id })

    from.delete(id)

    return entry!.type === "value" ? entry!.name : entry!.value
  }
}

const pointer = (value: string, pointer: bigint | number) => ({
  type: "pointer" as "pointer",
  value,
  pointer: pointer as number,
})

const val = (value: string) => ({
  type: "value" as "value",
  value,
})

const primitive = (value: string) => ({
  type: "primitive" as "primitive",
  value,
})

export const translateValue = withCache((id) => {
  const {
    type: { def },
  } = lookupData[id]

  if (def.tag === "composite") {
    if (def.value.length === 0) {
      imports.add("_void")
      return primitive("_void")
    }

    if (def.value.length === 1) {
      const pointerIdx = def.value[0].type
      const value = translateValue(pointerIdx as number)
      return pointer(value, pointerIdx)
    }

    let allKey = true
    const innerComp = def.value.map((x) => {
      const key = x.name
      allKey = allKey && !!key
      return { key, value: translateValue(x.type as number) }
    })

    if (allKey) {
      imports.add("Struct")
      return val(
        `Struct({${innerComp
          .map(({ key, value }) => `${key}: ${value}`)
          .join(", ")}})`,
      )
    }

    imports.add("Tuple")
    return val(`Tuple(${innerComp.map(({ value }) => value).join(", ")})`)
  }

  if (def.tag === "variant") {
    if (def.value.length === 0) {
      imports.add("_void")
      return primitive("_void")
    }

    const innerVariant = def.value.map((x) => {
      const key = x.name
      if (x.fields.length === 0) {
        imports.add("_void")
        return `${key}: _void`
      }
      if (x.fields.length === 1)
        return `${key}: ${translateValue(x.fields[0].type as number)}`

      let allKey = true
      const inner = x.fields.map((x) => {
        const key = x.name
        allKey = allKey && !!key
        return { key, value: translateValue(x.type as number) }
      })

      if (allKey) {
        imports.add("Struct")
        return `${key}: Struct({${inner
          .map(({ key, value }) => `${key}: ${value}`)
          .join(", ")}})`
      }

      imports.add("Tuple")
      return `${key}: Tuple(${inner.map(({ value }) => value).join(", ")})`
    })

    imports.add("Enum")
    return val(`Enum({${innerVariant.join(", ")}})`)
  }

  if (def.tag === "sequence") {
    const vectorType = translateValue(def.value as number)
    if (vectorType === "u8") {
      imports.add("Bytes")
      return val("Bytes()")
    }

    imports.add("Vector")
    return val(`Vector(${vectorType})`)
  }

  if (def.tag === "array") {
    const vectorType = translateValue(def.value.type as number)
    if (vectorType === "u8") {
      imports.add("Bytes")
      return val(`Bytes(${def.value.len})`)
    }

    imports.add("Vector")
    return val(
      `Vector(${translateValue(def.value.type as number)}, ${def.value.len})`,
    )
  }

  if (def.tag === "tuple") {
    if (def.value.length === 0) {
      imports.add("_void")
      return primitive("_void")
    }
    if (def.value.length === 1) {
      const value = translateValue(def.value[0] as number)
      return pointer(value, def.value[0])
    }

    imports.add("Tuple")
    return val(
      `Tuple(${def.value.map((x) => translateValue(x as number)).join(", ")})`,
    )
  }

  if (def.tag === "primitive") {
    imports.add(def.value.tag)
    return primitive(def.value.tag)
  }

  if (def.tag === "compact") {
    const isBig = Number(translateValue(def.value as number).slice(1)) > 32
    const result = isBig ? "compactBn" : "compactNumber"

    imports.add(result)
    return primitive(result)
  }

  if (def.tag === "bitSequence") {
    imports.add("Bytes")
    return val("Bytes()")
  }
  // historicMetaCompat
  return primitive(def.value)
})

/*
let idx: number | undefined = 0
while (idx !== undefined) {
  translateValue(idx)
  idx = lookupData.find((x) => !codecs.has(x.id as number))?.id as
    | number
    | undefined
}

interface LookupEntry {
  path: Array<string>
  params: StringRecord<string>
  value: string
  docs: string
}

export const lookupEntries: Array<LookupEntry> = lookupData.map((data, idx) => {
  const { path, params } = data.type
  return {
    path,
    params: Object.fromEntries(
      params
        .filter((x) => x.type !== undefined)
        .map((x) => [x.name, translateValue(x.type as number)]),
    ) as StringRecord<string>,
    value: translateValue(data.id as number),
    docs: data.type.docs.join("\n"),
  }
})
*/

type PalletsCodec = typeof palletsCodec
type PalletsData = PalletsCodec extends Codec<infer V> ? V : unknown
const pallets: PalletsData = (data as any).metadata.value.pallets as any

type HashTypeCodec = typeof hashType
type HashType = (HashTypeCodec extends Codec<infer V> ? V : unknown)["tag"]

type StorageEntry = {
  prefix: string
  name: string
  docs: string
  value: string
  keys: Array<{
    hasher: HashType
    codec: string
  }>
}

const getStorageCodecsFromId = (id: number): Array<string> => {
  const {
    type: { def },
  } = lookupData[id]
  if (def.tag === "tuple") {
    translateValue(id)
    return def.value.map((x) => translateValue(x as number))
  } else {
    return [translateValue(id)]
  }
}

const storageData = Object.fromEntries(
  pallets
    .map((p) => p.storage!)
    .filter(Boolean)
    .map((pallet) => [
      pallet.prefix,
      Object.fromEntries(
        pallet.items.map((x) => {
          const valueIdx =
            x.type.tag === "map" ? x.type.value.value : x.type.value
          const value = translateValue(valueIdx)

          const hashers =
            x.type.tag === "map" ? x.type.value.hashers.map((h) => h.tag) : []

          hashers.forEach((h) => imports.add(h))

          const codecs =
            x.type.tag === "map" ? getStorageCodecsFromId(x.type.value.key) : []

          return [
            x.name,
            {
              prefix: pallet.prefix,
              name: x.name,
              docs: x.docs.join("\n"),
              value,
              keys: hashers.map((hasher, idx) => ({
                hasher,
                codec: codecs[idx],
              })),
            },
          ]
        }),
      ) as StringRecord<StorageEntry>,
      ,
    ]),
) as StringRecord<StringRecord<StorageEntry>>
imports.add("Storage")

const seen = new Set<string>()
const result = `import {${[...imports].join(
  ", ",
)}} from "@unstoppablejs/substrate-bindings";

${[...order]
  .map(({ id, circular }) => {
    const entry = codecs.get(id)!
    if (entry.type === "primitive") return ""
    if (entry.type === "pointer" && !entry.isCircular) return ""

    const varName =
      circular && entry.isCircular ? entry.circularName : entry.name
    if (seen.has(varName)) return ""
    seen.add(varName)

    return circular && entry.isCircular
      ? `const ${varName}${entry.circularValue};`
      : `const ${varName} = ${entry.value};`
  })
  .filter(Boolean)
  .join("\n\n")}

${Object.entries(storageData)
  .map(([pallet, items]) => {
    return `export const ${pallet}Storage = Storage('${pallet}');

const ${pallet}StorageEntries = {
${Object.entries(items)
  .map(
    ([name, item]) =>
      `${name}: ${pallet}Storage(
     "${name}",
     ${item.value}[1],
     ${item.keys.map((k) => `[${k.codec}[0], ${k.hasher}]`).join(", ")}
   ),`,
  )
  .join("\n")}
};
`
  })
  .join("\n\n")}

`

console.log(result)

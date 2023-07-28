import type { Codec, StringRecord } from "scale-ts"
import { lookup } from "./metadata/lookup"

export type AstPrimitive = { type: "primitive"; value: string }
export type AstPointer = { type: "pointer"; value: CodecEntry }
export type AstCircular = { type: "circular"; value: Ast }
export type AstTuple = { type: "tuple"; value: CodecEntry[] }
export type AstStruct = { type: "struct"; value: StringRecord<CodecEntry> }
export type AstEnum = {
  type: "enum"
  value: StringRecord<AstTuple | AstStruct | AstPrimitive | CodecEntry>
}
export type AstSequence = { type: "sequence"; value: CodecEntry }
export type AstArray = { type: "array"; value: CodecEntry; len: number }
export type AstCompact = { type: "compact"; isBig: boolean }
export type AstBitSequence = { type: "bitSequence" }

export type Ast =
  | AstPrimitive
  | AstPointer
  | AstTuple
  | AstStruct
  | AstEnum
  | AstCircular
  | AstArray
  | AstSequence
  | AstCompact
  | AstBitSequence

export type CodecEntry = {
  id: number
  name: string
} & Ast

type LookupData = typeof lookup extends Codec<infer V> ? V : unknown

export const getLookupFns = (lookupData: LookupData) => {
  const codecs = new Map<number, CodecEntry>()
  const from = new Set<number>()

  const getVarName = (idx: number): string => {
    const {
      type: { path },
    } = lookupData[idx]
    if (path.length === 0) return "cdc" + idx
    return "c" + path.map((x) => x[0].toUpperCase() + x.slice(1)).join("")
  }

  const withCache = (fn: (id: number) => Ast): ((id: number) => CodecEntry) => {
    return (id) => {
      let entry = codecs.get(id)

      if (entry) return entry

      if (from.has(id)) {
        const entry: CodecEntry = {
          id,
          name: getVarName(id),
          type: "circular",
          value: null as unknown as Ast,
        }

        codecs.set(id, entry)
        return entry
      }

      from.add(id)
      const value = fn(id)

      entry = codecs.get(id)

      if (entry?.type === "circular") {
        entry.value = value
      } else {
        entry = {
          id,
          name: getVarName(id),
          ...value,
        }
        codecs.set(id, entry!)
      }
      from.delete(id)

      return entry
    }
  }

  const translateValue = withCache((id): Ast => {
    const {
      type: { def },
    } = lookupData[id]

    if (def.tag === "composite") {
      if (def.value.length === 0) return { type: "primitive", value: "_void" }

      if (def.value.length === 1) {
        const pointerIdx = def.value[0].type as number
        return { type: "pointer", value: translateValue(pointerIdx as number) }
      }

      let allKey = true
      const innerComp = def.value.map((x) => {
        const key = x.name
        allKey = allKey && !!key
        return { key, value: translateValue(x.type as number) }
      })

      if (allKey) {
        return {
          type: "struct",
          value: Object.fromEntries(innerComp.map((x) => [x.key, x.value])),
        }
      }

      return {
        type: "tuple",
        value: innerComp.map((x) => x.value),
      }
    }

    if (def.tag === "variant") {
      if (def.value.length === 0) return { type: "primitive", value: "_void" }

      const parts = def.value.map(
        (x): [string, AstEnum["value"][keyof AstEnum["value"]]] => {
          const key = x.name
          if (x.fields.length === 0) {
            return [key, { type: "primitive", value: "_void" }]
          }

          if (x.fields.length === 1)
            return [key, translateValue(x.fields[0].type as number)]

          let allKey = true
          const inner = x.fields.map((x) => {
            const key = x.name
            allKey = allKey && !!key
            return { key, value: translateValue(x.type as number) }
          })

          if (allKey) {
            return [
              key,
              {
                type: "struct",
                value: Object.fromEntries(inner.map((x) => [x.key, x.value])),
              },
            ]
          }

          return [key, { type: "tuple", value: inner.map((x) => x.value) }]
        },
      )

      return {
        type: "enum",
        value: Object.fromEntries(parts) as StringRecord<
          AstEnum["value"][keyof AstEnum["value"]]
        >,
      }
    }

    if (def.tag === "sequence") {
      return {
        type: "sequence",
        value: translateValue(def.value as number),
      }
    }

    if (def.tag === "array") {
      return {
        type: "array",
        value: translateValue(def.value.type as number),
        len: def.value.len,
      }
    }

    if (def.tag === "tuple") {
      if (def.value.length === 0) {
        return { type: "primitive", value: "_void" }
      }

      if (def.value.length === 1) {
        return {
          type: "pointer",
          value: translateValue(def.value[0] as number),
        }
      }

      return {
        type: "tuple",
        value: def.value.map((x) => translateValue(x as number)),
      }
    }

    if (def.tag === "primitive") {
      return { type: "primitive", value: def.value.tag }
    }

    if (def.tag === "compact") {
      const translated = translateValue(def.value as number) as AstPrimitive
      const isBig = Number(translated.value.slice(1)) > 32

      return { type: "compact", isBig }
    }

    if (def.tag === "bitSequence") {
      return { type: "bitSequence" }
    }
    // historicMetaCompat
    return { type: "primitive", value: def.value }
  })

  return translateValue
}

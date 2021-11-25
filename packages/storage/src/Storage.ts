import type { Codec, CodecType } from "@unstoppablejs/scale-codec"
import { mergeUint8, toHex, utf16StrToUtf8Bytes } from "@unstoppablejs/utils"
import { InteropObservable } from "./InteropObservable"
import { Client } from "./client"
import { twoX128 } from "./hashes/twoX128"

type ReturnType<A extends Array<any>, C extends Codec<any>> = A extends []
  ? CodecType<C>
  : CodecType<C> | null

const innerStorage = <
  A extends ((x: any) => Uint8Array)[],
  OT extends {
    [K in keyof A]: A[K] extends (x: infer V) => any ? V : unknown
  },
  C extends Codec<any>,
>(
  pallet: string,
  item: string,
  result: C,
  ...valueKeys: [...A]
) => {
  const palledEncoded = twoX128(utf16StrToUtf8Bytes(pallet))
  const mapper = (
    input: string | null,
  ): C extends Codec<infer CC> ? CC : unknown =>
    input && (result[1](input) as any)

  const palletItemEncoded = mergeUint8(
    palledEncoded,
    twoX128(utf16StrToUtf8Bytes(item)),
  )

  const send = (...args: OT): string =>
    toHex(
      mergeUint8(
        palletItemEncoded,
        ...args.map((val, idx) => valueKeys[idx](val)),
      ),
    )

  const observable = (client: Client, ...args: OT) =>
    client.getObservable<ReturnType<A, C>>(
      "state_subscribeStorage",
      "state_unsubscribeStorage",
      [[send(...args)]],
      mapper,
      `${pallet}_${item}_${args.join("_")}`,
    )

  const get = (
    client: Client,
    ...args: [...OT] | [...args: OT, abortSignal: AbortSignal]
  ) => {
    const lastArg = args[args.length - 1]
    const [innerArgs, signal]: [OT, AbortSignal | undefined] = (
      lastArg instanceof AbortSignal
        ? [args.slice(0, -1), lastArg]
        : [args, undefined]
    ) as any

    return client.requestReply<ReturnType<A, C>>(
      "state_getStorage",
      [send(...innerArgs)],
      mapper,
      "state_subscribeStorage",
      signal,
    )
  }

  return { observable, get }
}

export function createStorage(client: Client): (pallet: string) => <
  A extends ((x: any) => Uint8Array)[],
  OT extends {
    [K in keyof A]: A[K] extends (x: infer V) => any ? V : unknown
  },
  C extends Codec<any>,
>(
  item: string,
  result: C,
  ...valueKeys: [...A]
) => {
  observable: (...args: OT) => InteropObservable<ReturnType<A, C>>
  get: (...args: OT) => Promise<ReturnType<A, C>>
}

export function createStorage(client: Client): <
  A extends ((x: any) => Uint8Array)[],
  OT extends {
    [K in keyof A]: A[K] extends (x: infer V) => any ? V : unknown
  },
  C extends Codec<any>,
>(
  pallet: string,
  item: string,
  result: C,
  ...valueKeys: [...A]
) => {
  observable: (...args: OT) => InteropObservable<ReturnType<A, C>>
  get: (...args: OT) => Promise<ReturnType<A, C>>
}

export function createStorage(pallet: string): <
  A extends ((x: any) => Uint8Array)[],
  OT extends {
    [K in keyof A]: A[K] extends (x: infer V) => any ? V : unknown
  },
  C extends Codec<any>,
>(
  item: string,
  result: C,
  ...valueKeys: [...A]
) => {
  observable: (
    client: Client,
    ...args: OT
  ) => InteropObservable<ReturnType<A, C>>
  get: (client: Client, ...args: OT) => Promise<ReturnType<A, C>>
}

export function createStorage<
  A extends ((x: any) => Uint8Array)[],
  OT extends {
    [K in keyof A]: A[K] extends (x: infer V) => any ? V : unknown
  },
  C extends Codec<any>,
>(
  pallet: string,
  item: string,
  result: C,
  ...valueKeys: [...A]
): {
  observable: (
    client: Client,
    ...args: OT
  ) => InteropObservable<ReturnType<A, C>>
  get: (client: Client, ...args: OT) => Promise<ReturnType<A, C>>
}

export function createStorage(...args: any[]): any {
  if (typeof args[0] !== "object") {
    if (args.length > 1)
      return innerStorage(args[0], args[1], args[2], ...args.slice(3))

    const pallet = args[0]
    return (item: string, result: any, ...values: any[]) =>
      innerStorage(pallet, item, result, ...values)
  }

  const client: Client = args[0]
  return (...innerArgs: any[]) => {
    const unCurriedFn = (
      pallet: string,
      item: string,
      result: any,
      ...values: any[]
    ) => {
      const { observable, get } = innerStorage(pallet, item, result, ...values)
      return {
        observable: (...subArgs: any[]) => observable(client, ...subArgs),
        get: (...getArgs: any[]) => get(client, ...getArgs),
      }
    }

    if (innerArgs.length > 1)
      return unCurriedFn(
        innerArgs[0],
        innerArgs[1],
        innerArgs[2],
        ...innerArgs.slice(3),
      )

    const pallet = innerArgs[0]
    return (item: string, result: any, ...values: any[]) =>
      unCurriedFn(pallet, item, result, ...values)
  }
}

import type { Codec, CodecType } from "@unstoppablejs/scale-codec"
import { mergeUint8, toHex, utf16StrToUtf8Bytes } from "@unstoppablejs/utils"
import { ErrorRpc, Client } from "./client"
import { twoX128 } from "./hashes/twoX128"
import { getInteropObservable } from "./InteropObservable"

type ReturnType<A extends Array<any>, C extends Codec<any>> = A extends []
  ? CodecType<C>
  : CodecType<C> | null

export const Storage = (pallet: string, client: Client) => {
  const palledEncoded = twoX128(utf16StrToUtf8Bytes(pallet))
  return <
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

    const onReceive = (
      input: string | null,
    ): C extends Codec<infer CC> ? CC : unknown =>
      input && (result[1](input) as any)

    const observable = (...args: OT) =>
      getInteropObservable<ReturnType<A, C>>((observer) => {
        const subs = client.subscribe<string | null>(
          "state_subscribeStorage",
          "state_unsubscribeStorage",
          [[send(...args)]],
          (data) => {
            try {
              if ((data as any) instanceof ErrorRpc) throw data
              observer.next(onReceive(data))
            } catch (e) {
              subs && subs()
              observer.error(e)
            }
          },
        )
        return subs
      }, `${pallet}_${item}_${args.join("_")}`)

    const get = (...args: [...OT] | [...args: OT, abortSignal: AbortSignal]) =>
      new Promise<ReturnType<A, C>>((res, rej) => {
        const lastArg = args[args.length - 1]
        const [innerArgs, signal]: [OT, AbortSignal | undefined] = (
          lastArg instanceof AbortSignal
            ? [args.slice(0, -1), lastArg]
            : [args, undefined]
        ) as any

        let active = true
        function onAbort() {
          signal!.removeEventListener("abort", onAbort)
          cb()
          rej(new Error("Aborted Promise!"))
        }
        const cb = client.requestReply<string | null>(
          "state_getStorage",
          [send(...innerArgs)],
          (data) => {
            active = false
            signal?.removeEventListener("abort", onAbort)

            try {
              if ((data as any) instanceof ErrorRpc) throw data
              res(onReceive(data))
            } catch (e) {
              cb && cb()
              rej(e)
            }
          },
          "state_subscribeStorage",
        )

        if (signal && active) signal.addEventListener("abort", onAbort)
      })

    return { observable, get }
  }
}

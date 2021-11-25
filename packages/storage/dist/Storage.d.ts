import type { Codec, CodecType } from "@unstoppablejs/scale-codec"
import type { Client } from "./client"
declare type ReturnType<
  A extends Array<any>,
  C extends Codec<any>,
> = A extends [] ? CodecType<C> : CodecType<C> | null
export declare const Storage: (
  pallet: string,
  client: Client,
) => <
  A extends ((x: any) => Uint8Array)[],
  OT extends { [K in keyof A]: A[K] extends (x: infer V) => any ? V : unknown },
  C extends Codec<any>,
>(
  item: string,
  result: C,
  ...valueKeys_0: A
) => {
  observable: (
    ...args: OT
  ) => import("./InteropObservable").InteropObservable<ReturnType<A, C>>
  get: (
    ...args: [...OT] | [...args: OT, abortSignal: AbortSignal]
  ) => Promise<ReturnType<A, C>>
}
export {}

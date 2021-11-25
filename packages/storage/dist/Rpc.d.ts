import type { Client } from "./client"
export declare const Rpc: (
  module: string,
  client: Client,
) => {
  <ARGS extends any[] = [], IT = any, OT = any>(
    method: string,
    mapFn: (x: IT) => OT,
  ): (
    ...args: [...ARGS] | [...args: ARGS, abortSignal: AbortSignal]
  ) => Promise<OT>
  <T, ARGS_1 extends any[] = []>(method: string): (
    ...args: [...ARGS_1] | [...args: ARGS_1, abortSignal: AbortSignal]
  ) => Promise<T>
}

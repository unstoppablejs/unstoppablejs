import { GetProvider } from "@unstoppablejs/provider"
declare type OnData = (data: any) => void
export declare const createMultiplexer: (gProvider: GetProvider) => {
  requestReply: (
    method: string,
    params: Array<any>,
    cb: OnData,
    subs?: string | undefined,
  ) => () => void
  subscribe: (
    subs: string,
    unsubs: string,
    params: Array<any>,
    cb: OnData,
  ) => () => void
  connect: () => void
  disconnect: () => void
}
export {}

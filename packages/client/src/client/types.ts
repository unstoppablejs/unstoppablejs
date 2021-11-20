import { InteropObservable } from "../InteropObservable"

export { GetProvider, Provider, ProviderStatus } from "@unstoppablejs/provider"
export type OnData<T = any> = (data: T) => void
export interface Client {
  request: <T>(
    method: string,
    params: string,
    cb: (result: T) => void,
    unsubscribeMethod?: string,
  ) => () => void
  connect: () => void
  disconnect: () => void
  getObservable: <T>(
    subs: string,
    unsubs: string,
    params: Array<any>,
    mapper?: (data: any) => T,
    namespace?: string,
  ) => InteropObservable<T>
  requestReply: <T>(
    method: string,
    params: Array<any>,
    mapper?: (data: any) => T,
    subs?: string,
    abortSignal?: AbortSignal,
  ) => Promise<T>
}

export interface RpcError {
  code: number
  message: string
  data?: any
}

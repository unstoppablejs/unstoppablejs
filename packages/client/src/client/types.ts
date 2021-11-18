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
  subscribe: <T>(
    subs: string,
    unsubs: string,
    params: Array<any>,
    cb: OnData<T>,
  ) => () => void
  requestReply: <T>(
    method: string,
    params: Array<any>,
    cb: OnData<T>,
    subs?: string,
  ) => () => void
}

export interface RpcError {
  code: number
  message: string
  data?: any
}

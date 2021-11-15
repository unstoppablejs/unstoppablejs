export { GetProvider, Provider, ProviderStatus } from "@unstoppablejs/provider"
export interface Client {
  request: <T>(
    method: string,
    params: string,
    cb: (result: T) => void,
    unsubscribeMethod?: string,
  ) => () => void
  connect: () => void
  disconnect: () => void
}

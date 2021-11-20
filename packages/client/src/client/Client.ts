import {
  Client,
  GetProvider,
  Provider,
  ProviderStatus,
  RpcError,
} from "./types"
import { ErrorRpc } from "./ErrorRpc"

const MAX_TIME = 2_000

class OrfanMessages {
  #messages: Map<string, { expiry: number; message: any }>
  #token: number | NodeJS.Timer | null

  constructor() {
    this.#messages = new Map()
    this.#token = null
  }

  private checkClear(): void {
    if (this.#messages.size > 0) return

    clearInterval(this.#token as any)
    this.#token = null
  }

  set(key: string, message: any): void {
    this.#messages.set(key, { expiry: Date.now() + MAX_TIME, message })

    this.#token =
      this.#token ||
      setInterval(() => {
        const now = Date.now()

        const iterator = this.#messages.entries()
        let tmp = iterator.next()
        while (tmp.done === false && tmp.value[1].expiry <= now) {
          const key = tmp.value[0]
          tmp = iterator.next()
          this.#messages.delete(key)
        }
        this.checkClear()
      }, MAX_TIME)
  }

  upsert<T>(key: string): T | undefined {
    const result = this.#messages.get(key)
    if (!result) return undefined
    this.#messages.delete(key)
    this.checkClear()
    return result.message
  }

  clear() {
    this.#messages.clear()
    this.checkClear()
  }
}

export type RawClient = Omit<Client, "getObservable" | "requestReply">
export const createRawClient = (gProvider: GetProvider): RawClient => {
  let nextId = 1
  const callbacks = new Map<number, (cb: any) => void>()

  const subscriptionToId = new Map<string, number>()
  const idToSubscription = new Map<number, string>()

  const orfanMessages = new OrfanMessages()
  const batchedRequests = new Map<
    number,
    [string, string, (m: any) => void, boolean]
  >()

  let provider: Provider | null = null
  let state: ProviderStatus = ProviderStatus.disconnected

  function onMessage(message: string): void {
    try {
      let id,
        result,
        error: RpcError | undefined,
        params: { subscription: any; result: any; error?: RpcError },
        subscription
      ;({ id, result, error, params } = JSON.parse(message))

      // TODO: if the id is `null` it means that its a server notification,
      // perhaps we should handle them... somehow?
      if (id === null) return

      if (id)
        return callbacks.get(id)?.(result ?? new ErrorRpc(error!))

        // at this point, it means that it should be a subscription
      ;({ subscription, result } = params)
      if (!subscription || !result) throw new Error("Wrong message format")

      id = subscriptionToId.get(subscription)
      if (id) return callbacks.get(id)!(result)

      orfanMessages.set(subscription, result)
    } catch (e) {
      console.error("Error parsing an incomming message", message)
      console.error(e)
    }
  }

  function onStatusChange(e: ProviderStatus) {
    if (e === ProviderStatus.ready) {
      batchedRequests.forEach((args, id) => {
        process(id, ...args)
      })
      batchedRequests.clear()
    }
    state = e
  }

  const connect = () => {
    provider = gProvider(onMessage, onStatusChange)
    provider.open()
  }

  const disconnect = () => {
    provider?.close()
    provider = null
    callbacks.clear()
    subscriptionToId.clear()
    idToSubscription.clear()
    orfanMessages.clear()
    batchedRequests.clear()
  }

  const process = (
    id: number,
    method: string,
    params: string,
    cb: any,
    isSub: boolean,
  ) => {
    callbacks.set(
      id,
      isSub
        ? (result: string) => {
            subscriptionToId.set(result, id)
            idToSubscription.set(id, result)

            const nextCb = (d: any) => {
              cb(d.changes[0][1])
            }

            const orfan = orfanMessages.upsert(result)
            if (orfan) nextCb(orfan)
            callbacks.set(id, nextCb)
          }
        : (message: any) => {
            callbacks.delete(id)
            cb(message)
          },
    )

    const msg = `{"id":${id},"jsonrpc":"2.0","method":"${method}","params":${params}}`
    console.log("sending", msg)
    provider!.send(msg)
  }

  const request = <T>(
    method: string,
    params: string,
    cb: (result: T) => void,
    unsucribeMethod?: string,
  ): (() => void) => {
    if (!provider) throw new Error("Not connected")
    const id = nextId++

    const isSub = !!unsucribeMethod
    const cleanup = (): void => {
      if (batchedRequests.has(id)) {
        batchedRequests.delete(id)
        return
      }

      callbacks.delete(id)
      if (!idToSubscription.has(id)) return

      const subId = idToSubscription.get(id)!
      subscriptionToId.delete(subId)
      idToSubscription.delete(id)

      provider!.send(
        JSON.stringify({
          id: nextId++,
          jsonrpc: "2.0",
          method: unsucribeMethod,
          params: [subId],
        }),
      )
    }

    if (state === ProviderStatus.ready) {
      process(id, method, params, cb, isSub)
    } else {
      batchedRequests.set(id, [method, params, cb as any, isSub])
    }

    return cleanup
  }

  return {
    request,
    connect,
    disconnect,
  }
}

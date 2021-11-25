import { GetProvider } from "@unstoppablejs/provider"
import type { Client, InteropObservable } from "../types"
import { createRawClient } from "./RawClient"
import { ErrorRpc } from "./ErrorRpc"
import { getInteropObservable } from "../utils/InteropObservable"

type OnData<T = any> = (data: T) => void

interface CacheItem {
  listerners: Set<OnData>
  close: () => void
}

const finalize =
  (id: string, cb: OnData, map: Map<string, CacheItem>) => () => {
    const val = map.get(id)
    if (val) {
      val.listerners.delete(cb)
      if (val.listerners.size === 0) {
        val.close()
        val.listerners.clear()
        map.delete(id)
      }
    }
  }

const identity = <T>(x: T) => x

export const createClient = (gProvider: GetProvider): Client => {
  const client = createRawClient(gProvider)

  const subscriptions = new Map<string, CacheItem & { lastVal?: any }>()
  const requestReplies = new Map<string, CacheItem>()

  const getObservable = <I, O = I>(
    subs: string,
    unsubs: string,
    params: Array<any>,
    mapper: (i: I) => O = identity as any,
    namespace?: string,
  ): InteropObservable<O> => {
    const parametersStr = JSON.stringify(params)
    const id = `${subs}.${parametersStr}`

    return getInteropObservable<O>(({ next, error }) => {
      const cb = (data: any) => {
        try {
          if (data instanceof ErrorRpc) throw data
          next(mapper(data))
        } catch (e) {
          cleanup && cleanup()
          error(e)
        }
      }

      if (!subscriptions.has(id)) {
        const sub: Partial<CacheItem & { lastVal?: any }> = {
          listerners: new Set([cb]),
        }
        subscriptions.set(id, sub as CacheItem)
        sub.close = client.request<I>(
          subs,
          parametersStr,
          (result) => {
            subscriptions.get(id)?.listerners.forEach((icb) => {
              sub.lastVal = result
              icb(result)
            })
          },
          unsubs,
        )
      } else {
        subscriptions.get(id)!.listerners.add(cb)
      }

      const cleanup = finalize(id, cb, subscriptions)
      return cleanup
    }, namespace ?? `${id}_${parametersStr}`)
  }

  const requestReply = <I, O = I>(
    method: string,
    params: Array<any>,
    mapper: (data: I) => O = (x: I) => x as unknown as O,
    subs?: string,
    abortSignal?: AbortSignal,
  ): Promise<O> =>
    new Promise<O>((res, rej) => {
      const parametersStr = JSON.stringify(params)
      const subId = `${subs}.${parametersStr}`
      const sub = subscriptions.get(subId)
      let teardown: (() => void) | null = null
      let active = true

      function onAbort() {
        abortSignal!.removeEventListener("abort", onAbort)
        active && rej(new Error("Aborted Promise!"))
        teardown?.()
      }

      const cb = (data: I): void => {
        active = false
        abortSignal?.removeEventListener("abort", onAbort)
        try {
          if (data instanceof ErrorRpc) throw data
          res(mapper(data))
        } catch (e) {
          rej(e)
        } finally {
          teardown?.()
        }
      }

      if (sub) {
        if (sub.hasOwnProperty("lastVal")) {
          return cb(sub.lastVal)
        } else {
          teardown = finalize(subId, cb, subscriptions)
          sub.listerners.add(cb)
        }
      }

      const id = `${method}.${parametersStr}`
      const requestReply = requestReplies.get(id)

      if (requestReply) {
        requestReply.listerners.add(cb)
      } else {
        const replyObj: Partial<CacheItem> = {
          listerners: new Set([cb]),
        }
        requestReplies.set(id, replyObj as CacheItem)
        replyObj.close = client.request<I>(method, parametersStr, (val) => {
          replyObj.listerners!.forEach((icb) => {
            icb(val)
          })
          replyObj.listerners!.clear()
          requestReplies.delete(id)
        })
      }

      teardown = finalize(id, cb, requestReplies)
      if (abortSignal && active) abortSignal.addEventListener("abort", onAbort)
    })

  return {
    ...client,
    requestReply,
    getObservable,
  }
}

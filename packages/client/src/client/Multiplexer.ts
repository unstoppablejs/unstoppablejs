import { GetProvider } from "@unstoppablejs/provider"
import { getInteropObservable, InteropObservable } from "../InteropObservable"
import { createRawClient } from "./Client"
import { ErrorRpc } from "./ErrorRpc"
import type { Client, OnData } from "./types"

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

export const createClient = (gProvider: GetProvider): Client => {
  const client = createRawClient(gProvider)

  const subscriptions = new Map<string, CacheItem & { lastVal?: any }>()
  const requestReplies = new Map<string, CacheItem>()

  const getObservable = <T>(
    subs: string,
    unsubs: string,
    params: Array<any>,
    mapper?: (i: any) => T,
    namespace?: string,
  ): InteropObservable<T> => {
    const parametersStr = JSON.stringify(params)
    const id = `${subs}.${parametersStr}`

    return getInteropObservable<T>(({ next, error }) => {
      const cb = (data: any) => {
        try {
          if (data instanceof ErrorRpc) throw data
          next(mapper ? mapper(data) : data)
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
        sub.close = client.request(
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

  const requestReply = <T>(
    method: string,
    params: Array<any>,
    mapper: (data: any) => T = (x) => x,
    subs?: string,
    abortSignal?: AbortSignal,
  ): Promise<T> =>
    new Promise<T>((res, rej) => {
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

      const cb = (data: any): void => {
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
        replyObj.close = client.request(method, parametersStr, (val) => {
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

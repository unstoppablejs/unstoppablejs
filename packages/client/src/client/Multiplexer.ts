import { GetProvider } from "@unstoppablejs/provider"
import { createRawClient } from "./Client"
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

  const subscribe = <T>(
    subs: string,
    unsubs: string,
    params: Array<any>,
    cb: OnData<T>,
  ): (() => void) => {
    const parametersStr = JSON.stringify(params)
    const id = `${subs}.${parametersStr}`

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

    return finalize(id, cb, subscriptions)
  }

  const requestReply = <T>(
    method: string,
    params: Array<any>,
    cb: OnData<T>,
    subs?: string,
  ): (() => void) => {
    const parametersStr = JSON.stringify(params)
    const subId = `${subs}.${parametersStr}`
    const sub = subscriptions.get(subId)
    if (sub) {
      if (sub.hasOwnProperty("lastVal")) {
        cb(sub.lastVal)
        return () => {}
      } else {
        const eCb: OnData = (data) => {
          cb(data)
          teardown()
        }
        const teardown = finalize(subId, eCb, subscriptions)
        sub.listerners.add(eCb)
        return teardown
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

    return finalize(id, cb, requestReplies)
  }

  return {
    ...client,
    requestReply,
    subscribe,
  }
}

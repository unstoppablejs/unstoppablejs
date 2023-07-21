import { abortablePromiseFn } from "../utils/abortablePromiseFn"
import type { ClientRequestCb, ClientRequest } from "../client"
import type { UnsubscribeFn } from "../common-types"
import type { StorageEvent, StorageItemInput, StorageResponse } from "./types"

export const createStorageFn = (
  request: <T, TT>(
    method: string,
    params: Array<any>,
    cb: ClientRequestCb<T, TT>,
  ) => UnsubscribeFn,
  clientRequest: ClientRequest,
) =>
  abortablePromiseFn(
    (
      hash: string,
      items: Array<StorageItemInput>,
      childTrie: string | null,
      res: (output: StorageResponse) => void,
      rej: (e: any) => void,
    ) => {
      const queries: Record<StorageItemInput["type"], Set<string>> = {
        value: new Set(),
        hash: new Set(),
        "closest-descendant-merkle-value": new Set(),
        "descendants-values": new Set(),
        "descendants-hashes": new Set(),
      }

      items.forEach(({ key, type }) => {
        queries[type].add(key)
      })

      const unSub = request<string, StorageEvent>(
        "chainHead_unstable_storage",
        [hash, items, childTrie],
        (id, followSubscription) => {
          const result: StorageResponse = {
            values: {},
            hashes: {},
            closests: {},
            descendantsHashes: {},
            descendantsValues: {},
          }

          followSubscription(
            (e, done) => {
              if (e.event === "items") {
                e.items.forEach((item) => {
                  if (item.value) {
                    if (queries.value.has(item.key)) {
                      result.values[item.key] = item.value
                    } else {
                      // there could be many matching ones, we want to take the longest one
                      const queriedKey = [...queries["descendants-values"]]
                        .filter((key) => item.key.startsWith(key))
                        .sort((a, b) => b.length - a.length)[0]

                      const values = result.descendantsValues[queriedKey] ?? []
                      values.push({
                        key: item.key,
                        value: item.value,
                      })
                      result.descendantsValues[queriedKey] = values
                    }
                    return
                  }

                  if (item.hash) {
                    if (queries.hash.has(item.key)) {
                      result.hashes[item.key] = item.hash
                    } else {
                      // there could be many matching ones, we want to take the longest one
                      const queriedKey = [...queries["descendants-hashes"]]
                        .filter((key) => item.key.startsWith(key))
                        .sort((a, b) => b.length - a.length)[0]

                      const hashes = result.descendantsHashes[queriedKey] ?? []
                      hashes.push({
                        key: item.key,
                        hash: item.hash,
                      })
                      result.descendantsHashes[queriedKey] = hashes
                    }
                    return
                  }

                  if (
                    item["closest-descendant-merkle-value"] &&
                    queries["closest-descendant-merkle-value"].has(item.key)
                  ) {
                    result.closests[item.key] =
                      item["closest-descendant-merkle-value"]
                  }
                })

                return
              }

              if (e.event === "waiting-for-continue") {
                return clientRequest(
                  "chainHead_unstable_storageContinue",
                  [id],
                  () => {},
                )
              }

              done()

              if (e.event === "done") return res(result)
              rej(new Error(e.event === "error" ? e.error : e.event))
            },
            id,
            "chainHead_unstable_stopStorage",
          )
        },
      )
      return unSub
    },
  )

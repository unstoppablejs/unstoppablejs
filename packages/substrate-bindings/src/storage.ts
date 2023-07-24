import type { Client } from "../../substrate-client/dist"
import { mergeUint8, toHex, utf16StrToUtf8Bytes } from "@unstoppablejs/utils"
import { Observable } from "rxjs"
import { Decoder, Encoder } from "scale-ts"
import { Twox128 } from "./hashes"

type EncoderWithHash<T> = [Encoder<T>, (input: Uint8Array) => Uint8Array]

export const Storage = (pallet: string) => {
  const palledEncoded = Twox128(utf16StrToUtf8Bytes(pallet))
  return <
    T,
    A extends Array<EncoderWithHash<any>>,
    OT extends {
      [K in keyof A]: A[K] extends EncoderWithHash<infer V> ? V : unknown
    },
  >(
    name: string,
    dec: Decoder<T>,
    ...encoders: [...A]
  ): {
    enc: (...args: OT) => string
    dec: Decoder<T>
  } => {
    const palletItemEncoded = mergeUint8(
      palledEncoded,
      Twox128(utf16StrToUtf8Bytes(name)),
    )
    const fns = encoders.map(
      ([enc, hash]) =>
        (val: any) =>
          hash(enc(val)),
    )

    const enc = (...args: OT): string =>
      toHex(
        mergeUint8(palletItemEncoded, ...args.map((val, idx) => fns[idx](val))),
      )

    return {
      enc,
      dec,
    }
  }
}

export const storageLegacyClient = (
  client: Client,
  batchMaxSize = 500,
  batchMaxTime = 50,
) => {
  const queryStorageAt = (keys: string[]) =>
    client.requestReply<[{ changes: Array<[string, string]> }]>(
      "state_queryStorageAt",
      [keys],
    )

  const currentBatch: Map<
    string,
    Array<{
      mapper: (x: string) => any
      res: (x: string | null) => void
      rej: (e: any) => void
    }>
  > = new Map()

  const flush = () => {
    const waiters = new Map([...currentBatch.entries()])
    currentBatch.clear()

    queryStorageAt([...waiters.keys()])
      .then((value) => {
        value[0].changes.forEach(([key, val]) => {
          waiters.get(key)!.forEach(({ res, mapper }) => {
            res(val !== null ? mapper(val) : val)
          })
        })
      })
      .catch((e) => {
        ;[...waiters.values()].forEach((c) => c.forEach((cc) => cc.rej(e)))
      })
  }

  let token = 0
  const tick = () => {
    clearTimeout(token)
    if (currentBatch.size >= batchMaxSize) {
      flush()
    } else {
      token = setTimeout(flush, batchMaxTime) as any
    }
  }

  const getFromStorage = <T>(
    key: string,
    mapper: (value: string) => T,
  ): Promise<T | null> => {
    const result = new Promise<T | null>((res, rej) => {
      const entry = { res: res as any, rej, mapper }
      if (currentBatch.has(key)) {
        currentBatch.get(key)!.push(entry)
      } else {
        currentBatch.set(key, [entry])
      }
    })
    tick()
    return result
  }

  const getKeysPaged = (from: string, to: string, limit: number) => {
    return client.requestReply<string[]>("state_getKeysPaged", [
      from,
      limit,
      to,
    ])
  }

  const getKeys = (
    rootKey: string,
    limit: number = 400,
  ): Observable<string[]> => {
    return new Observable((observer) => {
      const pull = (lastOne: string) =>
        getKeysPaged(rootKey, lastOne, limit).then(
          (x) => {
            if (observer.closed) return
            observer.next(x)
            if (x.length >= limit) pull(x[x.length - 1])
            else observer.complete()
          },
          (e) => {
            if (observer.closed) return
            observer.error(e)
          },
        )

      pull(rootKey)
    })
  }
  return { getFromStorage, getKeys }
}

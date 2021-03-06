import { SolidityFn } from "../descriptors/fn"

interface BatchedCall {
  fn: SolidityFn<any, any, any, any>
  args: any[]
  res: (a: any) => void
  rej: (a: any) => void
}

export const batcher = (
  base: (fn: SolidityFn<any, any, any, any>) => (...args: any) => Promise<any>,
  getGroupKey: (args: any[], fn: SolidityFn<any, any, any, any>) => string,
  handler: (calls: Array<BatchedCall>, key: string) => void,
) => {
  let batched = new Map<string, Array<BatchedCall>>()
  let worker: Promise<void> | null = null

  return (fn: SolidityFn<any, any, any, any>) =>
    (...args: any[]): Promise<any> => {
      const key = getGroupKey(args, fn)
      if (!batched.has(key)) batched.set(key, [])

      const result = new Promise((res, rej) => {
        batched.get(key)!.push({
          fn,
          args,
          res,
          rej,
        })
      })

      if (!worker) {
        worker = Promise.resolve().then(() => {
          const reBatched = batched
          batched = new Map()
          worker = null
          reBatched.forEach((calls, key) => {
            if (calls.length > 1) {
              handler(calls, key)
            } else {
              const [{ fn, args, res, rej }] = calls
              base(fn)(...args).then(res, rej)
            }
          })
        })
      }

      return result
    }
}

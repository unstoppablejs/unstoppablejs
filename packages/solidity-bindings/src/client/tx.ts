import type { UnionToIntersection, InnerCodecs } from "../utils"
import type { SolidityFn } from "../descriptors"
import { getTrackingId, logResponse, withOverload } from "../internal"

export type SolidityTxFunctions<
  A extends Array<SolidityFn<any, any, any, any>>,
> = UnionToIntersection<
  {
    [K in keyof A]: A[K] extends SolidityFn<any, infer V, any, infer Mutability>
      ? Mutability extends 2 | 3
        ? (
            contractAddress: string,
            fromAddress: string,
            overload: K,
            ...args: InnerCodecs<V>
          ) => Promise<string>
        : never
      : never
  }[keyof A & number]
>
export type SolidityTxOverload = <
  F extends Array<SolidityFn<any, any, any, any>>,
>(
  overloaded: F,
) => SolidityTxFunctions<F>

export type SolidityTxFunction<F extends SolidityFn<any, any, any, 2 | 3>> =
  F extends SolidityFn<any, infer I, any, 2 | 3>
    ? (
        contractAddress: string,
        fromAddress: string,
        ...args: InnerCodecs<I>
      ) => Promise<string>
    : never

export type SolidityTxSingle = <F extends SolidityFn<any, any, any, 2 | 3>>(
  fn: F,
) => SolidityTxFunction<F>

export const getTx = (
  request: <T = any>(method: string, args: Array<any>, meta: any) => Promise<T>,
  logger?: (msg: any) => void,
): SolidityTxSingle & SolidityTxOverload =>
  withOverload(
    2,
    (fn: SolidityFn<any, any, any, 2 | 3>) =>
      (
        contractAddress: string,
        fromAddress: string,
        ...args: any[]
      ): Promise<string> => {
        const type = "eth_sendTransaction"
        const trackingId = getTrackingId()
        const meta: any = logger && {
          type,
          fn: fn.name,
          args,
          trackingId,
        }
        return request(
          type,
          [
            {
              to: contractAddress,
              from: fromAddress,
              data: fn.encoder.asHex(...args),
            },
          ],
          meta,
        ).then(...logResponse(meta, logger))
      },
  )

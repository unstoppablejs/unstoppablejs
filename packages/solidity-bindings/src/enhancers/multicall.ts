import type { SolidityClient, SolidityPullClient } from "../client"
import { Vector, address, bytes, Struct, bool, Tuple } from "solidity-codecs"
import { solidityFn } from "../descriptors"
import { batcher, getTrackingId, withOverload } from "../internal"
import { toHex } from "@unstoppablejs/utils"

const calls = Vector(Struct({ target: address, callData: bytes }))
const aggregate = solidityFn(
  "tryAggregate",
  [bool, calls] as [requireSuccess: typeof bool, calls: typeof calls],
  Tuple(Vector(Tuple(bool, bytes))),
  2,
)

export const withMulticall = <
  T extends Pick<SolidityPullClient, "call" | "getError"> & {
    logger?: (meta: any) => void
  },
>(
  multicallAddress: () => string,
  scheduler: (onFlush: () => void) => () => void,
  client: T,
): T => {
  const batchedCall = client.call(aggregate)
  const { logger } = client

  const call = withOverload(
    1,
    batcher(
      client.call,
      (args, fn) =>
        args.length - 1 > fn.encoder.size ? args[args.length - 1] : "latest",
      (calls, blockNumber) => {
        const trackingId = getTrackingId()
        const type = "multicall_tryAggregate"
        const meta: any = {
          type,
          trackingId,
          calls: [],
        }

        const data = calls.map(({ args, fn }) => {
          const [target, ...otherArgs] = args
          const actualArgs =
            otherArgs.length > fn.encoder.size
              ? otherArgs.slice(0, -1)
              : otherArgs
          if (logger) {
            meta.calls.push({
              fn: fn.name,
              args: actualArgs,
              target,
            })
          }
          return { target, callData: fn.encoder(...actualArgs) }
        })

        const actualBlock: any = Number.isNaN(parseInt(blockNumber))
          ? blockNumber
          : parseInt(blockNumber)

        logger?.(meta)
        batchedCall(multicallAddress(), false, data, actualBlock).then(
          (result) => {
            const metaReponse = logger
              ? {
                  ...meta,
                  calls: meta.calls.map((x: any) => ({ ...x })),
                  type: meta.type + "_responses",
                }
              : {}

            calls.forEach(({ res, rej, fn, errorReader }, idx) => {
              let [success, returnData] = result[idx]
              const rawResponse = toHex(returnData)
              let response = returnData
              if (success) {
                try {
                  res((response = fn.decoder(returnData)))
                } catch (e: any) {
                  success = false
                  rej((response = e))
                }
              } else {
                const error = errorReader(rawResponse)
                if (error) {
                  response = {
                    ok: false,
                    error,
                  } as any
                  res(response)
                } else {
                  const unhandledError = client.getError(rawResponse)
                  response =
                    unhandledError ??
                    ({
                      type: "unrecognizedError",
                      error: rawResponse,
                    } as any)
                  rej(response)
                }
                rej(response)
              }
              if (logger)
                Object.assign(metaReponse.calls[idx], {
                  success,
                  response,
                  rawResponse,
                })
            })
            logger?.(metaReponse)
          },
          (error) => {
            calls.forEach(({ rej }) => {
              rej(error)
            })
            logger?.({
              type: meta.type + "_error",
              trackingId: meta.trackingId,
              error,
            })
          },
        )
      },
      scheduler,
    ),
  ) as SolidityClient["call"]

  return { ...client, call }
}

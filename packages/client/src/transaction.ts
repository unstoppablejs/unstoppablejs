import type { ClientRequest } from "./client"

export interface TxValidated {
  event: "validated"
}

export interface TxBroadcasted {
  event: "broadcasted"
  numPeers: number
}

export interface TxBestChainBlockIncluded {
  event: "bestChainBlockIncluded"
  block: {
    hash: string
    index: number
  } | null
}

export interface TxFinalized {
  event: "finalized"
  block: {
    hash: string
    index: number
  }
}

export interface TxInvalid {
  event: "invalid"
  error: string
}

export interface TxDropped {
  event: "dropped"
  broadcasted: boolean
  error: string
}

export type TxEvent =
  | TxValidated
  | TxBroadcasted
  | TxBestChainBlockIncluded
  | TxFinalized
  | TxInvalid
  | TxDropped

const finalEvents = new Set(["dropped", "invalid", "finalized"])

export const transaction = (
  request: ClientRequest<string, TxEvent>,
  tx: string,
  cb: (event: TxEvent) => void,
) =>
  request(
    "transaction_unstable_submitAndWatch",
    [tx],
    (result: string, follow) => {
      follow(
        (event, done) => {
          if (finalEvents.has(event.event)) done()
          cb(event)
        },
        result,
        "transaction_unstable_unwatch",
      )
    },
  )

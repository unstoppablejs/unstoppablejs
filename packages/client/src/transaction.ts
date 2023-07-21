import type { ClientRequest } from "./client"

export interface Validated {
  event: "validated"
}

export interface Broadcasted {
  event: "broadcasted"
  numPeers: number
}

export interface BestChainBlockIncluded {
  event: "bestChainBlockIncluded"
  block: {
    hash: string
    index: number
  } | null
}

export interface Finalized {
  event: "finalized"
  block: {
    hash: string
    index: number
  }
}

export interface Invalid {
  event: "invalid"
  error: string
}

export interface Dropped {
  event: "dropped"
  broadcasted: boolean
  error: string
}

export type TransactionEvent =
  | Validated
  | Broadcasted
  | BestChainBlockIncluded
  | Finalized
  | Invalid
  | Dropped

const finalEvents = new Set(["dropped", "invalid", "finalized"])

export const transaction = (
  request: ClientRequest<string, TransactionEvent>,
  tx: string,
  cb: (event: TransactionEvent) => void,
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

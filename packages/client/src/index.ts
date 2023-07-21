export * from "./common-types"
export * from "./transaction/types"
export * from "./chainhead/types"

import { transaction } from "./transaction/transaction"
import { follow } from "./chainhead/follow"
import { ClientRequest, createClient as createRawClient } from "./client"
import { GetProvider } from "@unstoppablejs/provider"

export const createClient = (provider: GetProvider) => {
  const client = createRawClient(provider)
  return {
    transaction: transaction(client.request as ClientRequest<any, any>),
    chainHead: follow(client.request as ClientRequest<any, any>),
  }
}

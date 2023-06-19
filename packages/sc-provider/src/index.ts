import {
  Chain,
  WellKnownChain,
  createScClient,
  Config,
} from "@substrate/connect"
import { Provider, ProviderStatus, GetProvider } from "@unstoppablejs/provider"

const wellKnownChains = new Set(Object.values(WellKnownChain))

export const ScProvider = (
  input: WellKnownChain | string,
  config?: Config,
): GetProvider => {
  const client = createScClient(config)

  return (onMessage, onStatus): Provider => {
    let chain: Chain

    const open = () => {
      ;(wellKnownChains.has(input as any)
        ? client.addWellKnownChain(input as WellKnownChain, onMessage)
        : client.addChain(input, onMessage)
      ).then((_chain) => {
        chain = _chain
        onStatus(ProviderStatus.ready)
      })
    }

    const close = () => {
      chain?.remove()
    }

    const send = (msg: string) => {
      chain.sendJsonRpc(msg)
    }

    return { open, close, send }
  }
}

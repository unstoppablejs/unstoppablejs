import { GetProvider, Provider, ProviderStatus } from "@unstoppablejs/provider"
import {
  startWithBytecode,
  AddChainOptions,
  Chain,
} from "smoldot/dist/mjs/no-auto-bytecode-browser"

export const ScProvider = (
  smWorker: Worker,
  options: AddChainOptions,
): GetProvider => {
  const bytecodePromise = new Promise((resolve) => {
    smWorker.onmessage = (event) => resolve(event.data)
  })

  return (onMessage, onStatus): Provider => {
    let chain: Chain | undefined = undefined

    const open = () => {
      const { port1, port2 } = new MessageChannel()
      smWorker.postMessage(port1, [port1])
      bytecodePromise
        .then((bytecode: any) => {
          const client = startWithBytecode({
            bytecode,
            portToWorker: port2,
          })
          return client.addChain(options)
        })
        .then(async (_chain) => {
          chain = _chain
          onStatus(ProviderStatus.ready)
          try {
            while (true) {
              const response = await chain.nextJsonRpcResponse()
              onMessage(response)
            }
          } catch (e) {
            console.error(e)
            onStatus(ProviderStatus.halt)
          }
        })
    }

    const close = () => {
      chain?.remove()
      chain = undefined
    }

    const send = (msg: string) => {
      chain!.sendJsonRpc(msg)
    }

    return { open, close, send }
  }
}

export const WorkerProvider = (): GetProvider => {
  return (onMessage, onStatus): Provider => {
    function onMsg(msg: MessageEvent<any>) {}
    const open = () => {
      globalThis.addEventListener("message", onMsg)
    }
    const close = () => {}

    const send = (msg: string) => {
      postMessage(msg)
    }

    return { open, close, send }
  }
}

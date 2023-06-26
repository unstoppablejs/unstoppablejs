const createUnstoppableWorker = <
  Data,
  Ports extends Record<string, MessagePort>,
>(
  getExternalPorts: (data: Data) => Ports,
): {
  externalPorts: Promise<Ports>
  createFunction: any
} => {
  let resExternalPorts: (p: Ports) => void
  let rejExternalPorts: (e: any) => void
  const externalPorts = new Promise<Ports>((_res, _rej) => {
    resExternalPorts = _res
    rejExternalPorts = _rej
  })

  const appChannel = new MessageChannel()
  const appPort = appChannel.port2

  self.addEventListener(
    "message",
    (msg) => {
      try {
        const _ports = getExternalPorts(msg.data)
        if (typeof _ports !== "object")
          throw new Error("ports should be an Object")
        if (!Object.values(_ports).every((x) => x instanceof MessagePort))
          throw new Error("ports Object contains invalid data")
        resExternalPorts(_ports)
        self.postMessage(appChannel.port1, "/", [appChannel.port1])
      } catch (e) {
        rejExternalPorts(e)
      }
    },
    {
      once: true,
    },
  )

  const createRequestReplyFn = (
    fn: <A extends Array<any>, T>(...args: A) => Promise<T>,
  ) => {}

  return { externalPorts, createFunction: {} }
}

const MessagePortProvider = (port: Promise<MessagePort>): GetProvider => {
  let innerPort: MessagePort | null = null

  return (onMessage, onStatus) => {
    const onPortMessage = (e: MessageEvent) => {
      onMessage(e.data)
    }

    const onHalt = () => {
      onStatus(ProviderStatus.halt)
    }

    const open = () => {
      ;(async () => {
        try {
          innerPort = await port
          innerPort.onmessage = onPortMessage
          self.addEventListener("message", onHalt, {
            once: true,
          })
          onStatus(ProviderStatus.ready)
        } catch (_) {
          onStatus(ProviderStatus.halt)
        }
      })()
    }

    const close = () => {
      self.removeEventListener("message", onHalt)
      innerPort?.removeEventListener("message", onPortMessage)
      innerPort = null
    }

    const send = (msg: string) => {
      innerPort?.postMessage(msg)
    }

    return { open, close, send }
  }
}

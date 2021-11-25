import { GetProvider, ProviderStatus } from "@unstoppablejs/provider"
import { ErrorRpc } from "./client/ErrorRpc"
import { createClient } from "./client/MultiplexedClient"

const getMockProvider = () => {
  const sent: string[] = []
  let _onMessage: (message: string) => void = () => {}

  const getProvider: GetProvider = (onMessage, onStatusChange) => {
    _onMessage = onMessage
    const send = (message: string): void => {
      sent.push(message)
    }
    const open = () => {
      onStatusChange(ProviderStatus.ready)
    }
    const close = () => {
      sent.splice(0)
    }

    return { send, open, close }
  }
  return { getProvider, sent, onMessage: () => _onMessage }
}

describe("RPC Client", () => {
  describe("request/reply", () => {
    it("receives the reply to a request", async () => {
      const { getProvider, sent, onMessage } = getMockProvider()
      const client = createClient(getProvider)
      client.connect()

      expect(sent.length === 0)

      const method = "getData"
      const params = ["foo", "bar"]
      const request = client.requestReply<{ foo: string }>(method, params)

      expect(sent.map((x) => JSON.parse(x))).toEqual([
        {
          id: 1,
          jsonrpc: "2.0",
          method,
          params,
        },
      ])
      const result = { foo: "foo" }

      onMessage()(
        JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          result,
        }),
      )

      const response = await request
      expect(response).toEqual(result)
    })

    it("multiplexes ongoing requests", async () => {
      const { getProvider, sent, onMessage } = getMockProvider()
      const client = createClient(getProvider)
      client.connect()

      expect(sent.length === 0)

      const method = "getData"
      const params = ["foo", "bar"]
      const request1 = client.requestReply<{ foo: string }>(method, params)
      const request2 = client.requestReply<{ foo: string }>(method, params)
      const request3 = client.requestReply<{ foo: string }>(method, params)
      const request4 = client.requestReply<{ foo: string }>(method, params)

      expect(sent.map((x) => JSON.parse(x))).toEqual([
        {
          id: 1,
          jsonrpc: "2.0",
          method,
          params,
        },
      ])
      const result = { foo: "foo" }

      onMessage()(
        JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          result,
        }),
      )

      const responses = await Promise.all([
        request1,
        request2,
        request3,
        request4,
      ])
      expect(responses).toEqual(responses.map(() => result))
    })

    it("propagates RPC errors", async () => {
      const { getProvider, sent, onMessage } = getMockProvider()
      const client = createClient(getProvider)
      client.connect()

      expect(sent.length === 0)

      const method = "getData"
      const params = ["foo", "bar"]
      const request = client.requestReply<{ foo: string }>(method, params)

      expect(sent.map((x) => JSON.parse(x))).toEqual([
        {
          id: 1,
          jsonrpc: "2.0",
          method,
          params,
        },
      ])

      onMessage()(
        JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          error: {
            code: 1,
            message: "ko",
            data: "data",
          },
        }),
      )

      let error
      try {
        await request
      } catch (e) {
        error = e
      }
      expect(error).toEqual(
        new ErrorRpc({
          code: 1,
          message: "ko",
          data: "data",
        }),
      )
    })
  })

  describe("observe", () => {
    it("observes values from subscription endpoints", () => {
      const { getProvider, sent, onMessage } = getMockProvider()
      const client = createClient(getProvider)
      client.connect()

      const subsMethod = "subscribeToData"
      const unsubMethod = "unsubscribeToData"
      const params = ["foo"]

      const observable = client.getObservable(
        subsMethod,
        unsubMethod,
        params,
        ({ foo }: { foo: string }) => foo,
      )

      expect(sent.length === 0)

      const receivedValues: string[] = []
      const errors: any[] = []
      observable.subscribe(
        (value) => {
          receivedValues.push(value)
        },
        (e) => {
          errors.push(e)
        },
      )

      expect(sent.map((x) => JSON.parse(x))).toEqual([
        {
          id: 1,
          jsonrpc: "2.0",
          method: subsMethod,
          params,
        },
      ])
      expect(receivedValues).toEqual([])
      expect(errors).toEqual([])

      const subscription = "opaqueId"

      onMessage()(
        JSON.stringify({
          jsonrpc: "2.0",
          params: {
            result: { foo: "foo" },
            subscription,
          },
        }),
      )

      expect(receivedValues).toEqual([])
      expect(errors).toEqual([])

      onMessage()(
        JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          result: subscription,
        }),
      )

      expect(receivedValues).toEqual(["foo"])
      expect(errors).toEqual([])

      onMessage()(
        JSON.stringify({
          jsonrpc: "2.0",
          params: {
            result: { foo: "bar" },
            subscription,
          },
        }),
      )

      expect(receivedValues).toEqual(["foo", "bar"])
      expect(errors).toEqual([])

      expect(sent.length).toBe(1)

      onMessage()(
        JSON.stringify({
          jsonrpc: "2.0",
          params: {
            error: {
              code: 1,
              message: "ko",
              data: "data",
            },
            subscription,
          },
        }),
      )

      expect(receivedValues).toEqual(["foo", "bar"])
      expect(errors).toEqual([
        new ErrorRpc({
          code: 1,
          message: "ko",
          data: "data",
        }),
      ])
      expect(sent.length).toBe(2)
      expect(sent.slice(1).map((x) => JSON.parse(x))).toEqual([
        {
          id: 2,
          jsonrpc: "2.0",
          method: unsubMethod,
          params: [subscription],
        },
      ])
    })

    it("propagates RPC errors", () => {
      const { getProvider, sent, onMessage } = getMockProvider()
      const client = createClient(getProvider)
      client.connect()

      const subsMethod = "subscribeToData"
      const unsubMethod = "unsubscribeToData"
      const params = ["foo"]

      const observable = client.getObservable(
        subsMethod,
        unsubMethod,
        params,
        ({ foo }: { foo: string }) => foo,
      )

      expect(sent.length === 0)

      const receivedValues: string[] = []
      const unsubscribe = observable.subscribe((value) => {
        receivedValues.push(value)
      })

      expect(sent.map((x) => JSON.parse(x))).toEqual([
        {
          id: 1,
          jsonrpc: "2.0",
          method: subsMethod,
          params,
        },
      ])
      expect(receivedValues).toEqual([])

      const subscription = "opaqueId"

      onMessage()(
        JSON.stringify({
          jsonrpc: "2.0",
          params: {
            result: { foo: "foo" },
            subscription,
          },
        }),
      )

      expect(receivedValues).toEqual([])

      onMessage()(
        JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          result: subscription,
        }),
      )

      expect(receivedValues).toEqual(["foo"])

      onMessage()(
        JSON.stringify({
          jsonrpc: "2.0",
          params: {
            result: { foo: "bar" },
            subscription,
          },
        }),
      )

      expect(receivedValues).toEqual(["foo", "bar"])

      expect(sent.length).toBe(1)

      unsubscribe()

      expect(sent.slice(1).map((x) => JSON.parse(x))).toEqual([
        {
          id: 2,
          jsonrpc: "2.0",
          method: unsubMethod,
          params: [subscription],
        },
      ])
    })

    it("recicles the latest value of an active subscription for a request/reply", async () => {
      const { getProvider, sent, onMessage } = getMockProvider()
      const client = createClient(getProvider)
      client.connect()

      const subsMethod = "subscribeToData"
      const unsubMethod = "unsubscribeToData"
      const params = ["foo"]

      const observable = client.getObservable(
        subsMethod,
        unsubMethod,
        params,
        ({ foo }: { foo: string }) => foo,
      )

      expect(sent.length === 0)

      const receivedValues: string[] = []
      const unsubscribe = observable.subscribe((value) => {
        receivedValues.push(value)
      })

      expect(sent.map((x) => JSON.parse(x))).toEqual([
        {
          id: 1,
          jsonrpc: "2.0",
          method: subsMethod,
          params,
        },
      ])
      expect(receivedValues).toEqual([])

      const subscription = "opaqueId"

      onMessage()(
        JSON.stringify({
          jsonrpc: "2.0",
          params: {
            result: { foo: "foo" },
            subscription,
          },
        }),
      )

      expect(receivedValues).toEqual([])

      onMessage()(
        JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          result: subscription,
        }),
      )

      expect(receivedValues).toEqual(["foo"])

      onMessage()(
        JSON.stringify({
          jsonrpc: "2.0",
          params: {
            result: { foo: "bar" },
            subscription,
          },
        }),
      )

      expect(receivedValues).toEqual(["foo", "bar"])

      expect(sent.length).toBe(1)

      const response = await client.requestReply(
        "getData",
        params,
        undefined,
        subsMethod,
      )

      expect(sent.length).toBe(1)
      expect(response).toEqual({ foo: "bar" })

      unsubscribe()

      expect(sent.length).toBe(2)

      client.requestReply("getData", params, undefined, subsMethod)

      expect(sent.length).toBe(3)
    })
  })
})

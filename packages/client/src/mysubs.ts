import Websocket from "ws"
import { WsProvider } from "@unstoppablejs/ws-provider"
import { createClient } from "./client"
;(globalThis as any).WebSocket = Websocket

const wsProvider = WsProvider("wss://adz-rpc.parity.io/")

const client = createClient(wsProvider)
client.connect()

const obs = client.getObservable(
  "state_subscribeRuntimeVersion",
  "state_unsubscribeRuntimeVersion",
  [],
)

obs.subscribe(
  (x) => {
    console.log("got data", x)
  },
  (e) => {
    console.log("got error", e)
  },
)

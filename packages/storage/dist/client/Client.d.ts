import { Client, GetProvider } from "./types"
interface RpcError {
  code: number
  message: string
  data?: any
}
export declare class ErrorRpc extends Error implements RpcError {
  code: number
  data?: any
  constructor(e: RpcError)
}
export declare const createClient: (gProvider: GetProvider) => Client
export {}

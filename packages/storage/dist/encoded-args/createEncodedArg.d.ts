import { EncodedArgument } from "./types"
export declare const createEncodedArgument: (
  fn: (x: Uint8Array) => Uint8Array,
) => EncodedArgument

import { bool, str, uint } from "solidity-codecs"
import { overloadedFn, SolidityFn, solidityFn } from "../../descriptors/fn"
import { providerCtx, ProviderContext } from "../provider"
import type { Codec } from "solidity-codecs"
import type { UnionToIntersection, Untuple, InnerCodecs } from "../../utils"

type InnerCodecsOrBlock<A extends Array<Codec<any>>> =
  | InnerCodecs<A>
  | [
      ...args: InnerCodecs<A>,
      blockNumber: number | "latest" | "earliest" | "pending",
    ]

type SolidityCallFunctions<A extends Array<SolidityFn<any, any, any, any>>> =
  UnionToIntersection<
    {
      [K in keyof A]: A[K] extends SolidityFn<any, infer V, infer O, any>
        ? (overload: K, ...args: InnerCodecsOrBlock<V>) => Promise<Untuple<O>>
        : never
    }[keyof A & number]
  >

export const contractCtx = (
  providerContext: ProviderContext,
  getContractAddress: () => string,
) => {
  const withoutContract = <
    F extends SolidityFn<any, any, any, any>,
    O extends Array<any>,
    T,
  >(
    arg: (fn: F) => (contractAddress: string, ...other: O) => T,
  ): ((fn: F) => (...other: O) => T) => {
    return (fn: F) => {
      const fnn = arg(fn)
      return (...args: O) => fnn(getContractAddress(), ...args)
    }
  }

  const call: (<I extends Array<Codec<any>>, O>(
    fn: SolidityFn<any, I, O, any>,
  ) => (...args: InnerCodecsOrBlock<I>) => Promise<Untuple<O>>) &
    (<F extends Array<SolidityFn<any, any, any, any>>>(
      overloaded: F,
    ) => SolidityCallFunctions<F>) = withoutContract(provider.call) as any

  return { call }
}

const provider = providerCtx((() => {}) as any)
const fn1 = solidityFn("asd", [str] as [foo: typeof str], uint, 0)
const fn2 = solidityFn(
  "asd",
  [str, bool] as [foo: typeof str, bar: typeof bool],
  uint,
  0,
)
const fn = overloadedFn(fn1, fn2)

const contract = contractCtx(provider, () => "asd")

const res = contract.call(fn2)

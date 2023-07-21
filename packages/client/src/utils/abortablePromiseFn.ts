class AbortError extends Error {
  constructor() {
    super("Aborted by AbortSignal")
    this.name = "AbortError"
  }
}

type WithAbortSignal<T extends Array<any>> = [
  ...args: T,
  abortSignal?: AbortSignal,
]

export type AbortablePromiseFn<A extends Array<any>, T> = (
  ...args: WithAbortSignal<A>
) => Promise<T>

export const abortablePromiseFn =
  <T, A extends Array<any>>(
    fn: (
      ...args: [...A, ...[res: (x: T) => void, rej: (e: any) => void]]
    ) => () => void,
  ): AbortablePromiseFn<A, T> =>
  (...args: WithAbortSignal<A>): Promise<T> =>
    new Promise((res, rej) => {
      const [actualArgs, abortSignal] =
        args[args.length - 1] instanceof AbortSignal
          ? ([args.slice(0, args.length - 1), args[args.length - 1]] as [
              A,
              AbortSignal,
            ])
          : ([args] as unknown as [A])

      const onAbort = () => {
        cancel()
        rej(new AbortError())
      }

      abortSignal?.addEventListener("abort", onAbort, { once: true })

      const removeAbortListener =
        <T>(fn: (x: T) => void): ((x: T) => void) =>
        (x) => {
          abortSignal?.removeEventListener("abort", onAbort)
          fn(x)
        }

      const cancel = fn(
        ...[...actualArgs, removeAbortListener(res), removeAbortListener(rej)],
      )
    })

declare global {
  interface SymbolConstructor {
    readonly observable: symbol
  }
}

if (!Symbol["observable"]) {
  Object.defineProperty(Symbol, "observable", {
    value: Symbol("observable"),
  })
}

export interface Observer<T> {
  next: (value: T) => void
  error: (err: any) => void
  complete: () => void
}

export interface Unsubscribable {
  unsubscribe(): void
}
export interface Subscribable<T> {
  subscribe(observer: Partial<Observer<T>>): Unsubscribable
}
export interface InteropObservable<T> {
  [Symbol.observable]: () => Subscribable<T>
  subscribe: (
    next: (value: T) => void,
    error?: (e: unknown) => void,
  ) => () => void
}

export const getInteropObservable = <T>(
  fn: (observer: {
    next: (value: T) => void
    error: (e: unknown) => void
  }) => () => void,
  namespace: string,
): InteropObservable<T> => {
  const defaultOnError = (e: unknown) => {
    console.log(`An uncaught error ocurred on ${namespace}!`)
    console.error(e)
  }

  const realSubscribe = (
    next: (value: T) => void,
    error: (e: unknown) => void = defaultOnError,
  ): (() => void) => fn({ next, error })

  return {
    subscribe: realSubscribe,
    [Symbol.observable]() {
      return {
        subscribe(
          nextOrObserver: any,
          error: any = Function.prototype,
          complete: any = Function.prototype,
        ) {
          const observer =
            typeof nextOrObserver === "function"
              ? { next: nextOrObserver, error, complete }
              : nextOrObserver

          const unsubscribe = realSubscribe(
            observer.next.bind(observer),
            observer.error.bind(observer),
          )

          return { unsubscribe }
        },
      }
    },
  }
}

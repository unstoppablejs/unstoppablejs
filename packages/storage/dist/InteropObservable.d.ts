declare global {
  interface SymbolConstructor {
    readonly observable: symbol
  }
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
export declare const getInteropObservable: <T>(
  fn: (observer: {
    next: (value: T) => void
    error: (e: unknown) => void
  }) => () => void,
  namespace: string,
) => InteropObservable<T>

import type { UnsubscribeFn, ClientRequestCb } from "../client"

export const createHeaderFn =
  (
    request: <T, TT>(
      method: string,
      params: Array<any>,
      cb: ClientRequestCb<T, TT>,
    ) => UnsubscribeFn,
  ) =>
  (hash: string) =>
    new Promise<string>((res, rej) => {
      request<string | null, unknown>(
        "chainHead_unstable_header",
        [hash],
        (response: string | null) => {
          if (typeof response == "string") return res(response)
          rej(new Error("followSubscription is Invalid"))
        },
      )
    })

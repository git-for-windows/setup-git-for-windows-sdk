// Type definitions for node-fetch 1.1.0
// Project: https://github.com/adobe/node-fetch-retry

/// <reference types="node" />

declare module '@adobe/node-fetch-retry' {
  import {RequestInfo, RequestInit, Response} from 'node-fetch'

  interface RequestInitWithRetry extends RequestInit {
    retryOptions?: {
      retryMaxDuration?: number
      retryInitialDelay?: number
      retryBackoff?: number
      retryOnHttpResponse?: (response: Response) => boolean
      socketTimeout?: number
      forceSocketTimeout?: boolean
    }
  }

  function fetch(
    url: RequestInfo,
    init?: RequestInitWithRetry
  ): Promise<Response>

  export default fetch
}

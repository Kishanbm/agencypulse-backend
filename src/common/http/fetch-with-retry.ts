import { fetchWithTimeout } from './fetch-with-timeout';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRY_AFTER_MS = 30_000;

/**
 * Wraps fetchWithTimeout with 429 retry + Retry-After header support.
 * All other status codes are returned immediately without retry.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  maxRetries = 3,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  let attempt = 0;

  while (true) {
    const resp = await fetchWithTimeout(url, init, timeoutMs);

    if (resp.status !== 429 || attempt >= maxRetries) {
      return resp;
    }

    const retryAfterHeader = resp.headers.get('Retry-After');
    let delayMs: number;

    if (retryAfterHeader) {
      const seconds = parseInt(retryAfterHeader, 10);
      delayMs = isNaN(seconds) ? 2000 * Math.pow(2, attempt) : Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
    } else {
      delayMs = 2000 * Math.pow(2, attempt);
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    attempt++;
  }
}

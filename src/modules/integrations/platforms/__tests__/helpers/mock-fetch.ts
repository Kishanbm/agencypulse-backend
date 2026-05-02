// Queues fake HTTP responses for the next fetchWithRetry / fetchWithTimeout call.
// Both modules are mocked via jest.mock so service files that import either one
// will use these helpers automatically.

const responseQueue: Array<{
  body: unknown;
  status: number;
  headers?: Record<string, string>;
}> = [];

// Queue a single fake response for the next call.
// body can be any JSON-serializable value. status defaults to 200.
export function mockFetchResponse(
  body: unknown,
  status = 200,
  headers?: Record<string, string>,
): void {
  responseQueue.push({ body, status, headers });
}

// Queue multiple responses for multi-page pagination tests.
// They will be consumed in order, one per fetch call.
export function mockFetchSequence(
  responses: Array<{ body: unknown; status: number }>,
): void {
  responseQueue.push(...responses);
}

// Clears the queue and resets jest mocks.
export function clearFetchMocks(): void {
  responseQueue.splice(0, responseQueue.length);
}

jest.mock('../../../../../common/http/fetch-with-retry', () => ({
  fetchWithRetry: jest.fn().mockImplementation(async () => {
    const item = responseQueue.shift() ?? { body: {}, status: 200 };
    // If body is already a string (e.g. raw CSV or text response), pass it through directly.
    // Otherwise JSON-serialize objects/arrays so resp.json() works on the other end.
    const bodyStr = typeof item.body === 'string' ? item.body : JSON.stringify(item.body);
    return new Response(bodyStr, {
      status: item.status,
      headers: { 'Content-Type': 'application/json', ...(item.headers ?? {}) },
    });
  }),
}));

jest.mock('../../../../../common/http/fetch-with-timeout', () => ({
  fetchWithTimeout: jest.fn().mockImplementation(async () => {
    const item = responseQueue.shift() ?? { body: {}, status: 200 };
    const bodyStr = typeof item.body === 'string' ? item.body : JSON.stringify(item.body);
    return new Response(bodyStr, {
      status: item.status,
      headers: { 'Content-Type': 'application/json', ...(item.headers ?? {}) },
    });
  }),
}));

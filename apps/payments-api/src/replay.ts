import { z } from 'zod'
import { createApi } from './api.ts'
import type { Store } from './store.ts'

export const replayRequest = z.object({
  method: z.enum(['GET', 'POST']),
  path: z.string().startsWith('/v1/'),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.unknown().optional(),
})

export type ReplayRequest = z.input<typeof replayRequest>

// Safe replay: run one request against a throwaway copy of the seed state.
// The copy carries every account's pinned version, ids and clock, so the
// same request always gets the same answer and nothing shared ever changes.
export async function replay(seed: Store, request: ReplayRequest) {
  const { method, path, headers, body } = replayRequest.parse(request)
  const api = createApi(structuredClone(seed))
  const response = await api.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return {
    status: response.status,
    apiVersion: response.headers.get('Api-Version'),
    requestId: response.headers.get('Request-Id'),
    body: await response.json(),
  }
}

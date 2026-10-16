import { Hono } from 'hono'
import { createApi } from './api.ts'
import { replay, replayRequest } from './replay.ts'
import type { Store } from './store.ts'

// The API plus the lab's own endpoints, which the real API wouldn't have:
// the request log, safe replay and a reset back to the seed state.
export function createLab(seed: Store) {
  const store = structuredClone(seed)
  const lab = new Hono()

  lab.get('/lab/requests', c => {
    const { status, account } = c.req.query()
    const requests = store.requests.filter(
      request =>
        (!account || request.account === account) &&
        (!status || (status === 'failed') === request.status >= 400)
    )
    return c.json({ data: requests.toReversed() })
  })

  lab.get('/lab/requests/:id', c => {
    const request = store.requests.find(({ id }) => id === c.req.param('id'))
    return request ? c.json(request) : c.notFound()
  })

  lab.post('/lab/replay', async c => {
    const request = replayRequest.safeParse(await c.req.json())
    if (!request.success) return c.json({ error: request.error.issues }, 400)
    return c.json(await replay(seed, request.data))
  })

  lab.post('/lab/reset', c => {
    Object.assign(store, structuredClone(seed))
    return c.json({ reset: true })
  })

  lab.route('/', createApi(store))
  return lab
}

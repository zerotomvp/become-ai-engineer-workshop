import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { models } from './call-model.ts'
import { explain } from './explain.ts'

const port = Number(process.env.EXPLAINER_PORT ?? 4243)
const app = new Hono()

app.get('/api/models', c => c.json(models))

app.post('/api/explain', async c => {
  const { requestId, model } = await c.req.json()
  return c.json(await explain(requestId, { model }))
})

serve({ fetch: app.fetch, port }, () => {
  console.log(`Explainer on http://localhost:${port}`)
})

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { models } from './call-model.ts'
import { explain } from './explain.ts'

const port = Number(process.env.EXPLAINER_PORT ?? 4243)
const app = new Hono()

app.get('/api/models', c => c.json(models))

// If explain() throws, the error goes to this terminal and its message to the
// dashboard, as an `error`.
app.post('/api/explain', async c => {
  const { requestId, model } = await c.req.json()
  try {
    return c.json(await explain(requestId, { model }))
  } catch (error) {
    console.error(error)
    // As `SyntaxError: …`: the error's name and message.
    return c.json({ type: 'error', message: String(error) }, 500)
  }
})

serve({ fetch: app.fetch, port }, () => {
  console.log(`Explainer on http://localhost:${port}`)
})

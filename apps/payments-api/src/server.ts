import { serve } from '@hono/node-server'
import { createLab } from './lab.ts'
import { loadStore } from './store.ts'

const port = Number(process.env.PAYMENTS_API_PORT ?? 4242)
const seed = loadStore(new URL('../fixtures/seed.json', import.meta.url))

serve({ fetch: createLab(seed).fetch, port }, () => {
  console.log(`Payments API on http://localhost:${port}`)
})

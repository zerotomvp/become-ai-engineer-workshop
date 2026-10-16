import { createLab } from '../src/lab.ts'
import { loadStore } from '../src/store.ts'

export const loadSeed = () =>
  loadStore(new URL('../fixtures/seed.json', import.meta.url))

// A fresh lab over the seed fixture, with a small client for its API.
export function startLab() {
  const lab = createLab(loadSeed())
  async function send(
    key: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ) {
    const response = await lab.request(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${key}`, ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return {
      status: response.status,
      headers: response.headers,
      body: await response.json(),
    }
  }
  return { lab, send }
}

export const deposit = {
  amount: 12000,
  currency: 'eur',
  paymentMethod: 'pm_card_visa',
}

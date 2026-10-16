import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createLab, loadStore } from 'payments-api'
import { explain, parseAnswer } from '../src/explain.ts'

const apiUrl = 'http://payments.test'
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

// Serves the payments API in-process and answers model calls with `answer`,
// recording what was sent to OpenRouter.
function stubFetch(answer: string) {
  const lab = createLab(
    loadStore(new URL('../../payments-api/fixtures/seed.json', import.meta.url))
  )
  const modelCalls: { url: string; init: RequestInit }[] = []
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url.startsWith(apiUrl)) return lab.request(url.slice(apiUrl.length))
    modelCalls.push({ url, init: init! })
    return Response.json({
      choices: [{ message: { role: 'assistant', content: answer } }],
    })
  }
  return modelCalls
}

const incidentAnswer = `Outcome: fix

The account requires manual capture. Set captureMode to "manual".

\`\`\`json
{ "amount": 15000, "currency": "eur", "paymentMethod": "pm_card_visa", "captureMode": "manual" }
\`\`\``

test('explain sends the failed request and the docs to OpenRouter', async () => {
  const key = 'sk-or-test'
  process.env.OPENROUTER_API_KEY = key
  const modelCalls = stubFetch(incidentAnswer)
  const explanation = await explain('req_0004', { apiUrl })

  assert.equal(modelCalls.length, 1)
  const [{ url, init }] = modelCalls
  assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions')
  assert.equal(
    (init.headers as Record<string, string>).Authorization,
    `Bearer ${key}`
  )
  const { model, messages } = JSON.parse(String(init.body))
  assert.equal(model, 'openai/gpt-6-luna')
  const prompt = messages.at(-1).content
  assert.match(prompt, /POST \/v1\/payments/)
  assert.match(prompt, /manual_capture_setting_missing/)
  assert.match(prompt, /Booking HB-1044 deposit/)

  assert.equal(explanation.model, 'openai/gpt-6-luna')
  assert.equal(explanation.outcome, 'fix')
  assert.equal((explanation.correctedBody as any).captureMode, 'manual')
  assert.match(explanation.text, /requires manual capture/)
})

test('the docs are always the latest version, whatever the account uses', async () => {
  const modelCalls = stubFetch(incidentAnswer)
  await explain('req_0004', { apiUrl }) // Harbour Hotels, pinned to 2025-03
  const prompt = JSON.parse(String(modelCalls[0].init.body)).messages.at(
    -1
  ).content
  assert.match(prompt, /Payments \(version 2025-09\)/)
  assert.doesNotMatch(prompt, /version 2025-03/)
})

test('explain uses the model it is given', async () => {
  const modelCalls = stubFetch(incidentAnswer)
  const explanation = await explain('req_0004', {
    model: 'qwen/qwen3.7-flash',
    apiUrl,
  })
  assert.equal(
    JSON.parse(String(modelCalls[0].init.body)).model,
    'qwen/qwen3.7-flash'
  )
  assert.equal(explanation.model, 'qwen/qwen3.7-flash')
})

test('the answer is parsed from prose', () => {
  const parsed = parseAnswer(
    'Outcome: needs-context\n\nWe need the order total for LB-325.'
  )
  assert.deepEqual(parsed, {
    outcome: 'needs-context',
    correctedBody: undefined,
    text: 'We need the order total for LB-325.',
  })
})

test('prose that breaks the expected format breaks the parser', () => {
  assert.throws(() => parseAnswer('The request failed because...'))
  assert.throws(() =>
    parseAnswer('Outcome: fix\n```json\n{ amount: 2499, }\n```')
  )
})

import { callModel, models } from './call-model.ts'
import { getJson, retrieveDocs } from './docs.ts'

export const paymentsApiUrl =
  process.env.PAYMENTS_API_URL ?? 'http://localhost:4242'

export interface Explanation {
  model: string
  outcome: string
  correctedBody?: unknown
  text: string
}

// The feature: explain why a request in the log failed and how to fix it.
export async function explain(
  requestId: string,
  { model = models[0], apiUrl = paymentsApiUrl } = {}
): Promise<Explanation> {
  const request = await getJson(`${apiUrl}/lab/requests/${requestId}`)
  const docs = await retrieveDocs(apiUrl)

  const answer = await callModel(
    [
      {
        role: 'system',
        content:
          'You are an expert on our payments API. You explain failed API requests to developers.',
      },
      {
        role: 'user',
        content: `This request to the payments API failed:

${request.method} ${request.path}
Headers: ${JSON.stringify(request.headers)}
Body: ${JSON.stringify(request.body)}

Response (${request.status}): ${JSON.stringify(request.response)}

API documentation:

${docs}

Explain why the request failed and how to fix it. Start your answer with
"Outcome: fix", "Outcome: needs-context", "Outcome: cannot-reproduce" or
"Outcome: escalate". If there is a fix, include the corrected request body
in a \`\`\`json code block.`,
      },
    ],
    model
  )
  return { model, ...parseAnswer(answer) }
}

export function parseAnswer(answer: string): Omit<Explanation, 'model'> {
  const outcome = answer.match(/Outcome:\s*([a-z-]+)/i)![1]
  const json = answer.match(/```json\s*([\s\S]*?)```/)
  return {
    outcome,
    correctedBody: json ? JSON.parse(json[1]) : undefined,
    text: answer
      .replace(/Outcome:.*\n?/i, '')
      .replace(/```json[\s\S]*?```/, '')
      .trim(),
  }
}

// One call to a model through OpenRouter's OpenAI-compatible API. This is
// everything that goes over the wire: no SDK in between.
// Tools that do this job for you: the Vercel AI SDK, the OpenAI SDK, LangChain.

// The models the dashboard lets you pick from. The first is the default.
export const models = [
  'openai/gpt-6-luna',
  'ibm-granite/granite-4.2-8b',
  'qwen/qwen3.7-flash',
]

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function callModel(
  messages: Message[],
  model = models[0]
): Promise<string> {
  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'AI Engineer workshop',
      },
      body: JSON.stringify({ model, messages }),
    }
  )
  if (!response.ok) {
    throw new Error(`OpenRouter ${response.status}: ${await response.text()}`)
  }
  const completion: any = await response.json()
  return completion.choices[0].message.content
}

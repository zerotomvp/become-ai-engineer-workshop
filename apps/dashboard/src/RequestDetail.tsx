import { useState } from 'react'
import type { Explanation, LoggedRequest } from './types.ts'

interface Props {
  request: LoggedRequest
  models: string[]
  model?: string
  onModelChange: (model: string) => void
}

export function RequestDetail({
  request,
  models,
  model,
  onModelChange,
}: Props) {
  const [explanation, setExplanation] = useState<Explanation>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)

  async function explain() {
    setLoading(true)
    setError(undefined)
    const response = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: request.id, model }),
    })
    if (response.ok) setExplanation(await response.json())
    else setError(`${response.status} ${await response.text()}`)
    setLoading(false)
  }

  return (
    <section className="detail">
      <h2>
        {request.method} {request.path}
      </h2>
      <p>{request.response.error?.message}</p>
      <h3>Request</h3>
      <pre>{JSON.stringify(request.body, null, 2)}</pre>
      <h3>Response {request.status}</h3>
      <pre>{JSON.stringify(request.response, null, 2)}</pre>

      <div className="actions">
        <button onClick={explain} disabled={loading}>
          {loading ? 'Explaining…' : 'Explain this failure'}
        </button>
        <label>
          Model{' '}
          <select
            value={model}
            onChange={event => onModelChange(event.target.value)}
          >
            {models.map(model => (
              <option key={model}>{model}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {explanation && (
        <article className="explanation">
          <span className={`outcome ${explanation.outcome}`}>
            {explanation.outcome}
          </span>{' '}
          <small>{explanation.model}</small>
          <p>{explanation.text}</p>
          {explanation.correctedBody !== undefined && (
            <>
              <h3>Corrected request</h3>
              <pre>{JSON.stringify(explanation.correctedBody, null, 2)}</pre>
            </>
          )}
        </article>
      )}
    </section>
  )
}

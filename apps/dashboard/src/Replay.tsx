import { useState } from 'react'
import type { LoggedRequest } from './types.ts'

// What POST /lab/replay returns.
interface ReplayResult {
  status: number
  apiVersion: string | null
  body: unknown
}

// Sends a request, as logged or as corrected, to the lab's safe replay: a
// throwaway copy of the seed state, so nothing shared ever changes.
export function Replay({ request }: { request: LoggedRequest }) {
  const { method, path, headers, body } = request
  const [draft, setDraft] = useState(
    JSON.stringify({ method, path, headers, body }, null, 2)
  )
  const [result, setResult] = useState<ReplayResult>()
  const [error, setError] = useState<string>()

  async function replay() {
    setResult(undefined)
    setError(undefined)
    let parsed: unknown
    try {
      parsed = JSON.parse(draft)
    } catch {
      setError('Not valid JSON, so nothing was sent.')
      return
    }
    const response = await fetch('/lab/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    })
    if (response.ok) setResult(await response.json())
    else setError(`${response.status} ${await response.text()}`)
  }

  return (
    <div className="replay">
      <h3>Replay</h3>
      <p>
        Replay the logged request to see whether it still fails today, or paste
        in a corrected request to see whether it works.
      </p>
      <textarea
        value={draft}
        onChange={event => setDraft(event.target.value)}
        rows={draft.split('\n').length}
        spellCheck={false}
      />
      <div className="actions">
        <button onClick={replay}>Replay</button>
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <>
          <p>
            Replayed under {result.apiVersion ?? 'no version'}:{' '}
            <strong>{result.status}</strong>
          </p>
          <pre>{JSON.stringify(result.body, null, 2)}</pre>
        </>
      )}
    </div>
  )
}

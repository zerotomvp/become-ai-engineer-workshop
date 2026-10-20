import { useEffect, useState } from 'react'
import { RequestDetail } from './RequestDetail.tsx'
import type { LoggedRequest } from './types.ts'

export function App() {
  const [requests, setRequests] = useState<LoggedRequest[]>([])
  const [selected, setSelected] = useState<LoggedRequest>()
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState<string>()

  useEffect(() => {
    fetch('/lab/requests?status=failed')
      .then(response => response.json())
      // By id, as facilitators and the walkthroughs refer to them; the log
      // itself lists the newest first.
      .then(({ data }: { data: LoggedRequest[] }) =>
        setRequests(data.toSorted((a, b) => a.id.localeCompare(b.id)))
      )
    fetch('/api/models')
      .then(response => response.json())
      .then(models => {
        setModels(models)
        setModel(models[0])
      })
  }, [])

  return (
    <main>
      <section className="log">
        <h1>Failed requests</h1>
        <ul>
          {requests.map(request => (
            <li key={request.id}>
              <button
                className={request.id === selected?.id ? 'selected' : ''}
                onClick={() => setSelected(request)}
              >
                <span className="id">{request.id}</span>
                <code>{request.response.error?.code}</code>
                <small>
                  <span className="status">{request.status}</span>{' '}
                  {request.method} {request.path} ·{' '}
                  {request.account ?? 'no account'}
                </small>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {selected ? (
        <RequestDetail
          key={selected.id}
          request={selected}
          models={models}
          model={model}
          onModelChange={setModel}
        />
      ) : (
        <p className="empty">Select a failed request.</p>
      )}
    </main>
  )
}

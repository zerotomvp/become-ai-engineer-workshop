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
      .then(({ data }) => setRequests(data))
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
                <span className="status">{request.status}</span>
                <span>
                  {request.method} {request.path}
                </span>
                <code>{request.response.error?.code}</code>
                <small>
                  {request.id} · {request.account ?? 'no account'} ·{' '}
                  {request.created.slice(0, 16).replace('T', ' ')}
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

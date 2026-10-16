// A request from the payments API's log, as GET /lab/requests returns it.
export interface LoggedRequest {
  id: string
  account?: string
  mode?: string
  apiVersion?: string
  method: string
  path: string
  headers: Record<string, string>
  body?: unknown
  status: number
  response: { error?: { code: string; message: string } }
  created: string
}

// What the explainer returns for a failed request.
export interface Explanation {
  model: string
  outcome: string
  correctedBody?: unknown
  text: string
}

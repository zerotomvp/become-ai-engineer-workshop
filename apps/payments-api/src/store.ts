import { readFileSync } from 'node:fs'

export type ApiVersion = '2025-03' | '2025-09'
export type Mode = 'test' | 'live'
export type CaptureMode = 'automatic' | 'manual'
export type Permission =
  'payments:read' | 'payments:write' | 'refunds:read' | 'refunds:write'

export interface Account {
  id: string
  name: string
  apiVersion: ApiVersion
  requiresManualCapture: boolean
  liveEnabled: boolean
  currencies: string[]
}

export interface ApiKey {
  key: string
  account: string
  mode: Mode
  // Secret keys (sk_) may do everything; restricted keys (rk_) list what they may do.
  permissions: 'all' | Permission[]
}

export interface Payment {
  id: string
  account: string
  mode: Mode
  amount: number
  currency: string
  captureMode: CaptureMode
  status: 'requires_capture' | 'succeeded' | 'canceled'
  amountCaptured: number
  amountRefunded: number
  paymentMethod: string
  description?: string
  metadata?: Record<string, string>
  created: string
}

export interface Refund {
  id: string
  account: string
  mode: Mode
  payment: string
  amount: number
  currency: string
  reason?: string
  status: 'succeeded'
  created: string
}

export interface LoggedRequest {
  id: string
  account?: string
  mode?: Mode
  apiVersion?: ApiVersion
  method: string
  path: string
  headers: Record<string, string>
  body?: unknown
  status: number
  response: unknown
  created: string
}

export interface IdempotencyRecord {
  fingerprint: string
  status: number
  body: unknown
}

// The whole state of the mock API. Plain data, so a copy is one structuredClone.
export interface Store {
  now: string
  counters: Record<string, number>
  accounts: Record<string, Account>
  keys: Record<string, ApiKey>
  payments: Record<string, Payment>
  refunds: Record<string, Refund>
  idempotency: Record<string, IdempotencyRecord>
  requests: LoggedRequest[]
}

export function loadStore(path: string | URL): Store {
  return JSON.parse(readFileSync(path, 'utf8'))
}

// Ids and timestamps come from counters, never from randomness or the wall
// clock, so the same requests against the same state give the same results.
export function nextId(store: Store, prefix: string) {
  const count = (store.counters[prefix] ?? 0) + 1
  store.counters[prefix] = count
  return `${prefix}_${String(count).padStart(4, '0')}`
}

export function tick(store: Store) {
  store.now = new Date(Date.parse(store.now) + 1000).toISOString()
  return store.now
}

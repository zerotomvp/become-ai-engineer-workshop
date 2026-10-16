import { z } from 'zod'
import type { ApiVersion, CaptureMode, Payment } from './store.ts'

// Each API version has its own request schemas and its own shape for the
// payment object. Internally there is one model; versions translate at the edge.
// Schemas are strict: a parameter a version doesn't know is an error.

const paymentFields = {
  amount: z.int().positive(),
  currency: z.string().length(3),
  paymentMethod: z.string(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
}

const shared = {
  capturePayment: z.strictObject({
    amountToCapture: z.int().positive().optional(),
  }),
  cancelPayment: z.strictObject({}),
  createRefund: z.strictObject({
    payment: z.string(),
    amount: z.int().positive().optional(),
    reason: z
      .enum(['duplicate', 'fraudulent', 'requested_by_customer'])
      .optional(),
  }),
}

const v2025_03 = {
  ...shared,
  // `capture: false` asks for manual capture.
  createPayment: z.strictObject({
    ...paymentFields,
    capture: z.boolean().optional(),
  }),
}

const v2025_09 = {
  ...shared,
  // 2025-09 replaced `capture` with `captureMode`.
  createPayment: z.strictObject({
    ...paymentFields,
    captureMode: z.enum(['automatic', 'manual']).optional(),
  }),
}

export const schemas = { '2025-03': v2025_03, '2025-09': v2025_09 }
export const apiVersions = Object.keys(schemas) as ApiVersion[]
export const latestVersion: ApiVersion = '2025-09'

export type CreatePaymentInput = z.infer<
  (typeof schemas)[ApiVersion]['createPayment']
>

// The capture setting the request asked for, or undefined when it didn't say.
export function requestedCaptureMode(
  input: CreatePaymentInput
): CaptureMode | undefined {
  if ('captureMode' in input) return input.captureMode
  if ('capture' in input && input.capture !== undefined) {
    return input.capture ? 'automatic' : 'manual'
  }
  return undefined
}

export function presentPayment(payment: Payment, version: ApiVersion) {
  const { id, account, mode, captureMode, ...fields } = payment
  const capture =
    version === '2025-03'
      ? { capture: captureMode === 'automatic' }
      : { captureMode }
  return {
    id,
    object: 'payment',
    ...fields,
    ...capture,
    livemode: mode === 'live',
  }
}

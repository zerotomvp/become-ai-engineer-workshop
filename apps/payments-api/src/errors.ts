// Every error the API returns has a stable `code`. Clients and the lab's
// explainer key off the code; the message is for humans and may change.
export const errorCodes = {
  invalid_api_key: { status: 401, type: 'authentication_error' },
  permission_denied: { status: 403, type: 'permission_error' },
  live_mode_not_enabled: { status: 403, type: 'permission_error' },
  resource_missing: { status: 404, type: 'invalid_request_error' },
  parameter_missing: { status: 400, type: 'invalid_request_error' },
  parameter_invalid: { status: 400, type: 'invalid_request_error' },
  unknown_parameter: { status: 400, type: 'invalid_request_error' },
  manual_capture_setting_missing: {
    status: 400,
    type: 'invalid_request_error',
  },
  currency_not_supported: { status: 400, type: 'invalid_request_error' },
  amount_too_small: { status: 400, type: 'invalid_request_error' },
  amount_too_large: { status: 400, type: 'invalid_request_error' },
  payment_unexpected_state: { status: 400, type: 'invalid_request_error' },
  payment_already_refunded: { status: 400, type: 'invalid_request_error' },
  card_declined: { status: 402, type: 'card_error' },
  idempotency_key_reused: { status: 400, type: 'idempotency_error' },
} as const

export type ErrorCode = keyof typeof errorCodes

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly param: string | undefined

  constructor(code: ErrorCode, message: string, param?: string) {
    super(message)
    this.code = code
    this.param = param
  }

  get status() {
    return errorCodes[this.code].status
  }

  toBody(apiVersion: string) {
    return {
      error: {
        type: errorCodes[this.code].type,
        code: this.code,
        message: this.message,
        param: this.param,
        docUrl: `/docs/${apiVersion}/errors#${this.code}`,
      },
    }
  }
}

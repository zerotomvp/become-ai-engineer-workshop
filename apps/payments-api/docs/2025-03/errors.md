# Errors (version 2025-03)

Failed requests return an HTTP status and an error object. Rely on `code`; the
message may change.

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "parameter_missing",
    "message": "Missing required parameter: amount",
    "param": "amount",
    "docUrl": "/docs/2025-03/errors#parameter_missing"
  }
}
```

| Code                             | Status | Meaning                                                                                          |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `invalid_api_key`                | 401    | The API key is missing or unknown.                                                               |
| `permission_denied`              | 403    | A restricted key lacks the permission this request needs.                                        |
| `live_mode_not_enabled`          | 403    | A live key was used before the account was enabled for live mode.                                |
| `resource_missing`               | 404    | No such object for this account and mode, or no such test payment method.                        |
| `parameter_missing`              | 400    | A required parameter is missing. `param` names it.                                               |
| `parameter_invalid`              | 400    | A parameter has the wrong type or value, or the body isn't JSON.                                 |
| `unknown_parameter`              | 400    | A parameter this API version doesn't accept. `param` names it.                                   |
| `manual_capture_setting_missing` | 400    | The account requires manual capture and the payment didn't ask for it. Set `capture` to `false`. |
| `currency_not_supported`         | 400    | The account doesn't accept this currency.                                                        |
| `amount_too_small`               | 400    | The amount is below 50.                                                                          |
| `amount_too_large`               | 400    | Capturing or refunding more than is available.                                                   |
| `payment_unexpected_state`       | 400    | The payment's status doesn't allow this action.                                                  |
| `payment_already_refunded`       | 400    | Nothing is left to refund.                                                                       |
| `card_declined`                  | 402    | The payment method was declined.                                                                 |
| `idempotency_key_reused`         | 400    | The Idempotency-Key was used before with a different body.                                       |

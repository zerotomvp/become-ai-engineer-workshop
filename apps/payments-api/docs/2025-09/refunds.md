# Refunds (version 2025-09)

## Create a refund

`POST /v1/refunds`

| Parameter | Type             | Description                                                |
| --------- | ---------------- | ---------------------------------------------------------- |
| `payment` | string, required | The payment to refund.                                     |
| `amount`  | integer          | Amount to refund. Defaults to everything not yet refunded. |
| `reason`  | string           | `duplicate`, `fraudulent` or `requested_by_customer`.      |

Only payments with status `succeeded` can be refunded, up to the captured
amount minus earlier refunds. A payment can be refunded in several parts.

Errors: `payment_unexpected_state` when the payment isn't `succeeded`,
`amount_too_large` when the amount exceeds what is left, and
`payment_already_refunded` when nothing is left.

## Retrieve a refund

`GET /v1/refunds/:id` returns the refund object:

```json
{
  "id": "re_0001",
  "object": "refund",
  "payment": "pay_0003",
  "amount": 900,
  "currency": "eur",
  "reason": "requested_by_customer",
  "status": "succeeded",
  "created": "2026-10-01T09:00:06.000Z",
  "livemode": false
}
```

# Payments (version 2025-03)

A payment charges a payment method. It is either captured at once (automatic
capture) or authorized now and captured later (manual capture), for example
to hold a hotel deposit until check-in.

## Payment states

| Status             | Meaning                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `requires_capture` | Authorized with manual capture; waiting to be captured or canceled. |
| `succeeded`        | Captured. Can be refunded.                                          |
| `canceled`         | Canceled before capture. Final.                                     |

`requires_capture` → `succeeded` by capturing, or → `canceled` by canceling.
Any other transition fails with `payment_unexpected_state`.

## Create a payment

`POST /v1/payments`

| Parameter       | Type              | Description                                                                                      |
| --------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `amount`        | integer, required | At least 50, in the smallest currency unit.                                                      |
| `currency`      | string, required  | A currency the account accepts, such as `eur`.                                                   |
| `paymentMethod` | string, required  | In test mode: `pm_card_visa`, `pm_card_mastercard`, or `pm_card_declined` to simulate a decline. |
| `capture`       | boolean           | Defaults to `true`, capturing at once. Set `false` for manual capture.                           |
| `description`   | string            | Up to 500 characters.                                                                            |
| `metadata`      | object            | String keys and values for your own reference.                                                   |

Some accounts, such as hotels holding deposits, require manual capture on every
payment. On those accounts a payment without manual capture fails with
`manual_capture_setting_missing`. To create it, set `capture` to `false`:

```json
{
  "amount": 12000,
  "currency": "eur",
  "paymentMethod": "pm_card_visa",
  "capture": false
}
```

## Retrieve a payment

`GET /v1/payments/:id`

## Capture a payment

`POST /v1/payments/:id/capture`

| Parameter         | Type    | Description                                                |
| ----------------- | ------- | ---------------------------------------------------------- |
| `amountToCapture` | integer | Capture less than authorized. Defaults to the full amount. |

The payment must be `requires_capture`. Capturing more than was authorized
fails with `amount_too_large`.

## Cancel a payment

`POST /v1/payments/:id/cancel` releases an uncaptured authorization. The
payment must be `requires_capture`.

## The payment object

```json
{
  "id": "pay_0001",
  "object": "payment",
  "amount": 12000,
  "currency": "eur",
  "status": "requires_capture",
  "amountCaptured": 0,
  "amountRefunded": 0,
  "paymentMethod": "pm_card_visa",
  "description": "Booking HB-1042 deposit",
  "created": "2026-10-01T09:00:01.000Z",
  "capture": false,
  "livemode": false
}
```

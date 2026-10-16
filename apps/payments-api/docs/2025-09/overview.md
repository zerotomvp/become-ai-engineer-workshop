# Payments API overview (version 2025-09)

This is the documentation for API version `2025-09`. Every account is pinned to
one API version, and all of its requests use that version. The `Api-Version`
response header shows which version handled a request.

## Authentication

Send your API key as a bearer token:

```http
Authorization: Bearer sk_test_...
```

- `sk_test_` and `sk_live_` secret keys can do everything.
- `rk_test_` and `rk_live_` restricted keys can do only what they were
  granted, such as `payments:read`. Anything else fails with
  `permission_denied`.
- An unknown key fails with `invalid_api_key`.

## Test and live mode

The key's prefix selects the mode. Test and live objects are separate: a test
key cannot see live payments, and the reverse. Live keys work only once the
account is enabled for live mode; until then they fail with
`live_mode_not_enabled`.

## Requests and responses

Request bodies are JSON with camelCase parameters. Amounts are integers in the
smallest currency unit (cents), and currencies are lowercase ISO codes such as
`eur`. Unknown parameters are rejected with `unknown_parameter`.

Every response carries a `Request-Id` header.

## Idempotency

Send an `Idempotency-Key` header on a POST to make it safe to retry. A retry
with the same key and the same body returns the original response with
`Idempotent-Replayed: true` instead of acting twice. Reusing a key with a
different body fails with `idempotency_key_reused`. A request rejected as
invalid is not saved under its key, so you can correct it and retry with the
same key. Keys are scoped to the account and mode.

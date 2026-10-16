# Payments API (mock)

A small, Stripe-shaped payments API that the lab's feature explains failures
from. You use it; the workshop doesn't teach it. `pnpm dev` at the repository
root starts it on <http://localhost:4242> (set `PAYMENTS_API_PORT` to change
the port). It runs offline, keeps its state in memory and starts from
`fixtures/seed.json`: a week of traffic from two accounts, Harbour Hotels and
Lumen Books, including the failed requests the lab explains.

## What it does

- **Payments and refunds:** `POST /v1/payments`, `GET /v1/payments/:id`,
  `POST /v1/payments/:id/capture`, `POST /v1/payments/:id/cancel`,
  `POST /v1/refunds`, `GET /v1/refunds/:id`.
- **Two API versions.** Each account is pinned to one. `2025-03` asks for
  manual capture with `capture: false`; `2025-09` replaced it with
  `captureMode: "manual"`. Every response says which version handled it in
  the `Api-Version` header.
- **Keys and modes:** `Authorization: Bearer sk_test_…`. Test and live objects
  are separate; restricted `rk_` keys only do what they were granted.
- **Idempotency:** an `Idempotency-Key` header makes a POST safe to retry.
- **Stable error codes**, such as `manual_capture_setting_missing` and
  `unknown_parameter`, listed in each version's `errors` doc.
- **Docs per version** in `docs/<version>/`, also served at
  `/docs/<version>/<topic>`.

## Lab endpoints

A real payments API wouldn't have these; the lab needs them.

- `GET /lab/requests` lists every request, newest first. Filter with
  `?status=failed` or `?account=acct_…`. `GET /lab/requests/:id` returns one.
- `POST /lab/replay` with `{ method, path, headers, body }` runs a request
  against a throwaway copy of the seed state and returns
  `{ status, apiVersion, requestId, body }`. It never changes shared state, and
  the same request always gets the same answer. Code can call `replay()`
  directly, without the server.
- `POST /lab/reset` puts the shared state back to the seed.

## Code map

`src/api.ts` holds the routes, `src/versions.ts` each version's schemas, and
`src/replay.ts` safe replay. Hono serves it. The same app answers in-process
calls, which is how replay and the tests work.

Tools that do this job for real Stripe integrations: Stripe's own test mode,
and `stripe-mock`, which serves Stripe's API from its OpenAPI spec.

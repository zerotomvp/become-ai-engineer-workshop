# Explainer

The feature: pick a failed request from the payments API's log and explain
why it failed and how to fix it. `pnpm dev` at the repository root serves it
on <http://localhost:4243> (`EXPLAINER_PORT` changes the port) behind the
dashboard.

- `src/explain.ts` gathers the request and the API docs, asks the model, and
  parses the answer.
- `src/call-model.ts` calls a model through OpenRouter with plain `fetch`,
  using `OPENROUTER_API_KEY` from the repository's `.env`. Its `models` list
  is what the dashboard's model picker offers.
- `src/docs.ts` retrieves the documentation.

It works in the demo. Your job today is to find out how it fails.

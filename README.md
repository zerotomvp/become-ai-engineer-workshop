# How to Become an AI Engineer

Building Reliable AI Features in TypeScript

## Abstract

> At some point in the next year, a ticket with your name on it will say "add AI to this". The tutorial takes an afternoon; the SDKs really are that good. "AI engineer" is the industry's name for everything the afternoon won't cover: the schema that refuses malformed output, the eval suite that runs before any prompt change ships, the grading that holds up across ten thousand answers, the routing that keeps cost and latency in check, the trace you pull up when a user screenshots a wrong answer.
>
> The role, as the people who coined it define it, has no machine-learning prerequisite: it begins where the model becomes an API. And it no longer belongs to Python: the models, the SDKs, and the tooling are all first-class in JavaScript. What the role does demand is a new discipline, because every dependency we ever shipped was deterministic, and this one is probabilistic: priced per token, updated without notice, and often confidently wrong.
>
> In this hands-on workshop we build that discipline in TypeScript, layer by layer, on a feature that works in the demo and fails like production. Contracts first: typed, schema-validated outputs instead of parsed prose. Then evals: a golden set, hard assertions, automated grading you verify by hand before you rely on it, and the same suite run across competing models to settle which one the feature actually needs. Then context engineering: what earns a place in the window, and what it costs. Then the production layer: model routing, tracing, drift monitoring, and a release gate that stops a bad change from shipping.
>
> You'll know how to build the feature long before the ticket lands. Becoming an AI engineer turns out to be a decision: hold the model's output to the standard you already hold your own code to.

## Syllabus

**Module 0 — What an AI engineer is (30 min).** What "AI engineer" means at the application layer: consuming models as APIs, no training involved; the three subtypes (AI-enhanced engineer, engineer building AI products, autonomous agents) and which one this day trains. The maturity ladder: demo → feature → product, and why the industry pays for the last step. Where this sits at this conference: the agentic-coding workshop covers AI writing your code; the Genkit workshop covers your first AI feature; this one covers engineering the AI inside the product.

**Module 1 — The model as a dependency: failure modes.** The model as an engineering dependency with properties your stack has never had: non-deterministic, priced per token, silently updated by the provider, and wrong with full confidence. Failure taxonomy on real examples: malformed output, hallucination, refusal, format drift, prompt injection. Lab: break the seeded feature on purpose and catalog every distinct way it fails.

**Module 2 — Structured outputs: schemas, validation, typed streaming.** Structured outputs as the data contract: Zod schemas, tool calls instead of parsed prose, fail-closed validation, bounded retries. Typed streaming into components. Lab: wrap the feature's output in a schema and watch malformed answers get rejected instead of rendered.

**Module 3 — Evals: golden sets, assertions, LLM-as-judge, CI.** A golden set drawn from real traffic; deterministic assertions before any judge; LLM-as-judge with a written rubric, calibrated against human labels instead of trusted on vibes; counter-examples that guard against over-fires; evals wired into CI so a prompt change cannot ship unmeasured. The suite doubles as a model-selection harness: behind a provider gateway (OpenRouter, or the AI SDK's provider abstraction), the same golden set runs against several models and returns quality, cost, and latency as one table, which ends the leaderboard argument. Lab: build a 30-case eval for the feature, make an "innocent" prompt change and catch the regression it causes, then run the suite across three models and pick one on evidence.

**Module 4 — Context engineering: retrieval, compaction, cost.** What earns a place in the window: retrieval as one tool among several, compaction, memory, structured context. Cost and latency budgeted per request, not discovered on the invoice. (Fundamentals taught under the current label: the field's flagship conference has moved past intro-RAG framing, but the techniques still start here.)

**Module 5 — Production: routing, tracing, guardrails.** The model matrix from Module 3 becomes routing policy: cheapest adequate model per task, escalation when quality demands it, all behind one provider interface so swapping models is a config change with an eval run, never a rewrite; tracing every call (input, output, cost, latency) so an incident is a lookup, not an archaeology dig; monitoring for drift when the provider ships a new snapshot; injection defenses. The incident walk: from user complaint to trace to new eval case.

**Capstone — the full loop end to end.** The feature passes a release gate: schema-valid, eval green, cost inside budget, every call traced. The arc of the day in one artifact: the thing you would demo on Friday becomes the thing you could defend on Monday.

## Learning outcomes

- Treat the model as an engineering dependency: name its failure modes and design around them
- Replace parsed prose with typed, schema-validated outputs that fail closed
- Build an eval suite (golden set, assertions, a calibrated LLM judge) and wire it into CI so prompt changes can't ship on vibes
- Engineer the context window deliberately: retrieval, compaction, and per-request cost budgets
- Choose models on evidence (one eval suite, many models through one gateway), route work by cost and capability, and trace every call so production incidents are debuggable

## Audience and prerequisites

- **Audience:** TypeScript developers who have called a model API, or are about to be asked to, and need AI features they can change without guessing.
- **Prerequisites:** comfortable with TypeScript and model APIs; no machine-learning background needed.

## Repository status

The workspace is being prepared for CityJS Athens on 21 October 2026. The workshop application is not built yet.

Requires Node.js 22+, Git, and pnpm 10.34.7. Run `pnpm install --frozen-lockfile` and `pnpm check` to check the workspace scaffold.

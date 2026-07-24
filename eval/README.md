# eval

Behavioral eval suite for the chat orchestrator (`apps/web/lib/bot/orchestrator.ts`). Each scenario scripts a real conversation against a real, ephemeral company/service created just for that run, drives it straight through `orchestrate()` (no HTTP round-trip, no running server needed), then grades it two ways:

- **Deterministic assertions**, declared right in the scenario JSON: substrings the reply must/must not contain, the ticket's status after a turn, how many confirmed bookings exist at the end, which staff member a booking landed on, or that a specific guardrail (`OrchestratorBlockedError`) fired.
- **An LLM judge** (Gemini — see below) grading the full transcript against a natural-language `successCriteria`, for things too fuzzy for a substring check (e.g. "did it correctly explain the conflict without silently reassigning the customer").

## Running

```bash
pnpm eval                # every scenario
pnpm eval booking         # only scenarios whose name contains "booking"
```

Needs `GEMINI_API_KEY` and a reachable `DATABASE_URL` in the environment — same as running `apps/web` itself, since this drives the same orchestrator against the same database.

## Scenarios

`scenarios/*.json` — one array of scenario objects per file, loaded and merged. Current coverage:

- `support-flows.json` — booking a service end to end, rescheduling an existing booking, staff conflict rejection + auto-allocation, cancellation-policy questions, FAQ vs. services priority.
- `guardrails.json` — escalation (and the bot continuing to help until an actual human joins, not just once escalated), prompt-injection blocking, refusing to hallucinate a confirmation for a booking that was never made.

Each scenario can seed a `service`, `faqs`, and an existing `seedBooking` before the scripted `turns` run. See `runner.ts`'s `Scenario`/`ScenarioTurn` types for the full field list — it's the source of truth for what's declarable.

## On the judge

The original phase-1 plan here was "Claude-as-judge," but this project has no `ANTHROPIC_API_KEY` configured (Gemini is the model actually running the bot) — so the judge is Gemini grading Gemini's own output. That's a real limitation (less independent than a different model would be), but it still reliably catches concrete, objective failures: wrong price quoted, a false "confirmed" with no booking created, a made-up cancellation policy. Swap `getJudgeClient()` in `runner.ts` for an Anthropic client if that key ever gets added.

## Adding a scenario

Add an object to either JSON file (or a new file — every `*.json` in `scenarios/` is picked up automatically). No code changes needed unless the scenario needs an assertion type that doesn't exist yet.

# Contracts (single vocabulary for every step)

If a step needs something not defined here, add it here first, then use it.

## Data formats
- JSON field names: snake_case everywhere (matches PayPal). Enum values: UPPER_SNAKE.
- Money: object with `value` (decimal string, two places for USD, never a number) and `currency_code` (three uppercase letters, matching PayPal's own shape). Only USD is supported; other currencies are excluded from sums.
- Time: ISO 8601 in UTC with `Z`. Naive times are rejected. Deadlines are inclusive: an action at exactly the due time is allowed.
- Ids: PayPal ids are opaque strings. Our ids are UUIDs. Approval tokens are at least 32 random bytes, URL-safe, stored hashed. Order codes are 10 random characters.
- Pagination: `limit` and `cursor` in, `items` and `next_cursor` out.

## Error envelope
`{ "error": { "code", "message", "correlation_id", "fields": [ { "path", "message" } ] } }`
Codes and HTTP status: VALIDATION_FAILED 422, NOT_FOUND 404, CONFLICT_STALE 409, CONFLICT_VERSION 409, RATE_LIMITED 429, FROZEN 503, TOKEN_INVALID 404, UPSTREAM_UNAVAILABLE 503, INTERNAL 500. Messages are plain sentences for people; never raw exceptions.

## Vocabulary
- Verdict: ALLOW, NEEDS_APPROVAL, DENY.
- Action type: PROVIDE_EVIDENCE, SEND_MESSAGE, MAKE_OFFER, ACCEPT_CLAIM, ESCALATE, APPEAL.
- Rule ids: `G<step>-<nn>` from `plan/03-gate-spec.md`; approved edits use `A-01`; execution outcomes use `EXEC-STALE`, `EXEC-FAILED`.
- Dispute reasons: the ten PayPal reasons in the handoff. Supported subset: not received plus the step 22 choice. Others are "unsupported".
- Timeline event kinds: WEBHOOK_RECEIVED, DISPUTE_SYNCED, RUN_STARTED, EVIDENCE_BUILT, PLAN_PROPOSED, GATE_DECIDED, APPROVAL_REQUESTED, APPROVAL_RESOLVED, EXECUTION_INTENDED, EXECUTION_SENT, EXECUTION_CONFIRMED, EXECUTION_FAILED, INJECTION_FLAGGED, NO_ACTION, RUN_FAILED.
- Job kinds: sync_dispute, run_agent, execute_decision, reconcile, expire_approvals.
- Scenario ids: A, B, C, D, E.
- LLM mode: live, cached, unavailable.
- Evidence strength label: low, medium, high (never "probability" or "win").

## Dispute fingerprint inputs
Included: status, dispute_state, life-cycle stage, reason, disputed amount, due date, evidence types and sources, allowed response option sets, offer count, message count. Excluded: link URLs, create and update timestamps, ordering of lists.

## Environment and hosts
Host variables: `PUBLIC_SIGNOFF_URL`, `PUBLIC_SHOP_URL`, `PUBLIC_API_URL`. Other names come from `.env.example`; add new names there and in `docs/env-matrix.md` in the same commit.

## Frontend routes
Signoff web: `/`, `/guide`, `/app`, `/app/disputes`, `/app/disputes/:id`, `/app/charter`, `/app/demo`, `/approve/:token`.
Shop: `/`, `/product/:sku`, `/cart`, `/checkout`, `/confirmation/:code`, `/orders`, `/orders/:code`, `/orders/:code/dispute`.

## Demo session
Cookie `demo_session` set by the API, secure, not readable by scripts, shared across subdomains. Every demo-created order and dispute stores the session id. Dashboard defaults to "my session" with an "all" toggle.

## Test conventions
- Test ids are kebab-case `area-element`, for example `approval-approve-button`. Prefer accessible roles and labels first, test ids second.
- Branch names `step-NN-slug`. Commit types: feat, fix, test, docs, chore.

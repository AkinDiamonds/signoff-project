# Resilience

Goal: no outcome where money moves without an ALLOW, and no outcome where a single failure silently loses a dispute.

## Failure modes
| Failure | Detection | Behavior | Test |
|---|---|---|---|
| Duplicate webhook | unique `event_id`/transmission id | Ack 200, no second job | replay same payload twice |
| Webhook missed or delayed | reconciliation poller (every N min: list open disputes, diff vs cache) | Enqueue job for any dispute whose fingerprint changed | drop webhook in test, assert poller catches it |
| Out-of-order events | compare fingerprint, not event order | Always re-fetch dispute; plan against fresh state | deliver UPDATED before CREATED |
| Invalid signature | verify before parse | 400/401, log, drop | tampered body |
| PayPal 5xx / 429 / timeout | httpx timeout + status | GET: bounded retry with jitter. Mutating: no blind retry (see protocol) | respx failures |
| OAuth token expiry | 401 | Refresh once, retry once, then fail the job | expired token fixture |
| LLM timeout / invalid JSON / refusal | timeout, schema validation | One repair attempt, then route to approval ("agent unavailable") | stub LLM failures |
| LLM provider down or over budget | error / budget cap | Use labeled scenario cache or route to approval; never silent | budget cap test |
| Worker crash mid-job | job lease expiry | Another worker re-claims; steps are idempotent | kill worker mid-run |
| Crash after PayPal call, before ledger write | execution row stuck in `INTENDED` | Reconciler re-fetches dispute and settles the row to `CONFIRMED` or `FAILED` | crash-injection test |
| Stale state at execution | fingerprint mismatch | Executor aborts, case re-planned | mutate dispute between gate and execute |
| Approval pending as deadline nears | deadline radar | Alert only; limits never relaxed | n/a (asserted in gate spec) |
| Prompt injection in buyer message | screener + schema + gate | No mutating action; `G5-02` / schema rejection logged | injection suite |
| Hosted instance sleeping / cold start | PayPal webhook retry, health checks | Always-on instance for the demo window; poller as backup | rehearsal checks |
| Demo abuse / cost blowup | per-IP and daily quotas | 429 with message; `DEMO_FROZEN` kill switch | quota tests |
| AG Studio watermark | Watermark and console error appear without a licence key (expected, ADR-015) | Keep plain-React detail pages independent of Studio; the approval page never depends on it |

## Executor write-ahead protocol
1. Receive `GateDecision(ALLOW)`; verify it is the gate's type and `action_hash` matches.
2. Re-fetch the dispute; compare `state_fingerprint`. Mismatch → abort (`EXEC-STALE`).
3. In one DB transaction: insert `executions(decision_id UNIQUE, status=INTENDED, request_hash)`. Unique violation → already handled, stop.
4. Call PayPal (mutating client) once. Record debug id and HTTP status.
5. On success: set `SENT`. Re-fetch dispute to confirm state change; set `CONFIRMED` and store the confirmed snapshot.
6. On ambiguous failure (timeout, 5xx): leave `INTENDED`/`SENT`; reconciler decides by re-fetching dispute state, never by re-sending.
7. Ledger entry written for every transition. `decisions` and `executions` history is append-only (DB trigger blocks UPDATE/DELETE on `decisions`).
(VERIFY, register V-19: whether dispute endpoints honor a request-id idempotency header; the protocol must work even if they don't.)

## Observability
- Structured JSON logs; correlation keys: `dispute_id`, `run_id`, `decision_id`, `paypal_debug_id`.
- `/healthz` (process up), `/readyz` (DB + queue reachable), `/api/status` (queue depth, last webhook time, last reconcile time, LLM mode: live/cached).
- Dashboard shows an "agent health" strip so judges see state, not silence.

## Principles
Fail closed · idempotent steps · write-ahead intent · reconcile by observing PayPal, not by retrying · timeouts everywhere · webhook receipt never depends on the agent (bulkhead: receive and enqueue even if the LLM is down).

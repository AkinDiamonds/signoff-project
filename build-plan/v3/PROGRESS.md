# Signoff implementation progress

This is the progress board. Verified outcomes are in EXECUTION-LOG.md; product choices are in 02-owner-decisions.md. Code being pushed to a checkpoint branch does not mean Render has deployed it.

| Step | State | Visible outcome |
|---|---|---|
| T00 audit | PARTIAL | 39 deployed page/viewport observations recorded; hosted order/valid approval/provider diagnostics still unobserved. |
| T01 engineering baseline | PASS locally | 489 backend + 169 frontend tests; lint/types/import contracts/parity/builds pass. |
| T02 owner access and readiness | PASS locally and on Render desktop Chromium | Owner login/session/reload, Secure/HttpOnly/Partitioned cookie, CSRF rejection, logout/denied access and fresh worker heartbeat verified. Physical Android remains pending. [Deployed evidence](evidence/release-2026-10-31/README.md). |
| T03 commerce | IMPLEMENTED; hosted proof pending | Durable IDs/intents, exact capture/payee validation, stable request IDs, concurrent/restart recovery and shared resolver. Merchant/demo scope and canonical alias checks complete in 618ed19; real hosted purchase proof stays open. |
| T04 simulated fulfilment | PASS locally; release observation pending | Persistent automatic/manual stages, pauses, safe timestamps, scoped owner controls and reload/concurrency checks. |
| T05 evidence | NEXT | Inspectable snapshots/provenance and merchant missing-evidence policy. |
| T06–T08 agent and approvals | TODO | Reliable plans, verified execution, durable phone approvals. |
| T09–T10 notifications | TODO | Toasts, inbox and Android web push. |
| T11–T13 product/mobile validation | TODO | Accurate dashboard, coherent mobile flows and complete regression suite. |
| T14–T17 Render release and proof | INITIAL RELEASE OBSERVED; full journey pending | Main auto-deploy used. Deployed owner access, worker presence, PayPal-only buyer handoff and 390px shop layout observed. Fresh actual purchase/dispute/model/execution and physical-phone proof remain. |

Checkpoint branch: `codex/signoff-v3`. The owner has requested commits/pushes at verified milestones. Keep checkpoint SHA/push/CI status in EXECUTION-LOG.md. Show browser screenshots as user-facing features become available, and label local versus deployed evidence.

Pushed product checkpoints: T01 `07f1d7b`; T02 code `20f24fb`; prior handoff `d491e61`. GitHub CI for both T02 code and prior handoff is confirmed successful. Earlier local results have not been rerun in the fresh workspace.

Latest: 600 backend / 185 frontend tests, lint/types/import/parity/client freshness and both builds PASS. Native local HTTPS shipping controls PASS; phone viewport only. Earlier owner access on Render is verified; fresh shipping deployment observation is tracked in EXECUTION-LOG.md. See [shipping evidence](evidence/t04/README.md).

Next: release/observe shipping increment, T05 evidence and policy, fresh sandbox purchase → PayPal Resolution Center dispute → webhook proof. Physical Android and later product steps remain pending.

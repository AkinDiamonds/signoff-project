# Signoff v3 progress

Status as of 2026-11-02. Details and verification evidence are in [EXECUTION-LOG.md](EXECUTION-LOG.md); the [execution plan](00-execution-plan.md) defines each exit criterion. Implementation or local tests alone do not complete a task that also requires deployed proof.

Latest application `3222069` is deployed on all four services; main CI and 14-case E2E pass. Start the next session with [NEXT-SESSION.md](NEXT-SESSION.md). The active blocker is physical push: FCM accepts tests, but the owner sees no notification even with Chrome open. No whole-product completion claim.

## Completed checkpoints

- **T01 engineering baseline:** local lint, types, tests, import contracts, parity and builds passed. These checks must continue to pass for subsequent changes.
- **T02 owner access and readiness:** owner session, CSRF protection and readiness were verified locally and on Render with desktop Chromium. Physical Android verification is outstanding.
- **T03–T04 implementation:** payment identity and recovery, scoped order resolution, and persistent simulated shipping were implemented and locally tested. Shipping surfaces were observed on Render; a fresh hosted purchase and shipment progression remain unproven.
- **T05 increments:** immutable model-run evidence snapshots and the merchant's missing-delivery policy are implemented and deployed. The default is human review; the optional settlement path remains gated.
- **T06–T08 increments:** model evidence grounding and stricter output validation, a signing-policy freshness guard, and durable owner access to pending approvals are implemented. A real provider returned valid plans for two fictional local cases; this was not a hosted worker or PayPal execution test.
- **T08–T10 increments:** approval identity/history/outcome fixes, shared toasts, deadline reminders, recipient isolation, leased push delivery/retries, subscription APIs, VAPID setup, manifest/PNG icons and worker v2 are deployed. Latest main CI records 680 backend tests and 14 E2E cases pass. Physical display/click-through/opt-out acceptance is not proven; owner reports no alert.

## Remaining work, in plan order

1. **T00 audit:** complete the unobserved hosted order, approval and provider diagnostics and the remaining page/control evidence.
2. **T03–T04 hosted proof:** purchase a fresh sandbox order, confirm its durable PayPal capture correlation, and demonstrate persistent simulated shipping on that order.
3. **T05 evidence:** pre-model review snapshots and an owner-triggered evidence-only refresh are implemented in the checkpoint branch. Verify deployed history and source handling; a refresh deliberately does not rerun the agent. Existing runs must not acquire invented historic evidence.
4. **T06 provider reliability:** finish failure-task UX and output truthfulness, and prove valid uncached plans for multiple fictional states through the hosted provider. Preserve bounded repair and human review on failure.
5. **T07 workflow and execution:** prove webhook deduplication and catch-up, fresh PayPal state and policy checks, lease/restart recovery and uncertain-write reconciliation. Verify actual supported sandbox actions independently in PayPal.
6. **T08 approvals:** complete concurrency, expiry, stale-state, restart and phone-refresh verification, including a real permitted phone approval and at-most-once action.
7. **T09 notifications:** implementation deployed; finish hosted deadline/retry/restart acceptance. Demo items are deliberately excluded from the owner inbox/destinations; no public demo recipient capability is claimed.
8. **T10 web push:** implementation/configuration deployed; diagnose missing physical display, then prove background delivery, correct click-through and opt-out. Use the local-device display versus remote-arrival distinction in NEXT-SESSION before more blind retries.
9. **T11 dashboard and audit:** reconcile current dispute, agent, approval and execution states; verify KPIs and chronological history against source records.
10. **T12 mobile and copy:** finish the audited pages and controls, accessible interaction and honest copy; verify 320px/390px layouts, keyboard and phone journeys.
11. **T13 acceptance suite:** consolidate the acceptance matrix, populated-schema migration, process separation, security, accessibility and CI checks. Preserve failures and do not weaken assertions.
12. **T14–T15 release:** prepare and verify the exact compatible release, migrations, backup, service revisions and rollback; deploy through the existing authorized Render auto-deploy flow.
13. **T16 hosted journey:** prove the fresh buyer checkout → PayPal Resolution Center dispute → webhook/sync → evidence → gated action or approval → PayPal result, with dated sanitized evidence and phone push.
14. **T17 handoff:** update the judge journey, access instructions, claims, troubleshooting and rollback, and prepare the competition demonstration using only proven behavior.

## Current release and limits

GitHub `main` was observed at `2497e607e10c6745a6636aa0f14f88e59dc1a5a6`; checkpoint branch `codex/signoff-v3` was observed at `02f6c4917b4eaaa05973514b106d72278ca92d65`. The latter adds release documentation. The inbox API and merchant bundle were observed on Render; the worker's exact revision was not independently verified. See the latest execution-log entries for dates, commands, CI and evidence.

The full v3 definition of done remains open. In particular, no fresh deployed end-to-end PayPal action or physical Android push has been proven. The supplied competition deadline is November 12, 2026 at 21:00 Africa/Lagos; the remaining scope and external/device proof require careful scheduling.

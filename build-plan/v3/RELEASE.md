# Incremental merchant release — 2026-10-31

This release reached the existing Render services through authorized fast-forward pushes to `main` (latest confirmed checkpoint 1c772d7). Owner authentication, worker presence, separate shop PayPal handoff and narrow layout were observed live; [safe evidence](evidence/release-2026-10-31/README.md). It is not a claim that T04–T17 or the full product journey is complete. The owner installed login variables securely before the source rollout.

## Product journey

Separate shop → official PayPal-hosted sandbox checkout → buyer independently opens a dispute in PayPal Resolution Center → verified webhook → merchant evidence/planning/policy gate → execution or explicit approval.

The public shop's old dispute URLs show an external PayPal handoff, with no dispute/reply form. Buyer-dispute API fixtures are unavailable outside APP_ENV=test/PAYPAL_ENV=stub. Direct capture/demo shortcuts require explicit local development stub mode and cannot appear in production bundles. Production disputes never wait for a judge's demo-pool claim; the signing gate still decides every action.

## Source and compatibility

- Keep commits/checkpoints on `codex/signoff-v3`; after source checks and CI pass, fast-forward `main` to the tested release. Do not reset or force-push. Existing Render auto-deploy supplies API, worker, merchant and separate shop builds.
- Maintain existing database, PayPal sandbox credentials, signing secret, allowed origins and service URLs. Do not republish cloud configuration or recreate services.
- MERCHANT_EMAIL/MERCHANT_PASSWORD_HASH protect owner access. They were generated outside Git and installed by the owner. No credential belongs in this release document, source, logs or screenshots.

## Forward migration

Production API and worker prepare schema before accepting traffic/jobs, using the same PostgreSQL advisory lock. Alembic receives the already-locked connection, upgrades to head and releases it. Lock/statement waits are bounded; failure prevents the new process from starting.

- `d18e6c2a9001`: owner sessions, failed sign-in attempts, integration observations.
- `e42b7d910002`: nullable explicit PayPal order/capture IDs and durable capture-attempt timestamp. No guessed legacy backfill or new uniqueness constraint. Ambiguous legacy mappings remain unmodified and fail closed.
- `f53c8ea20003`: expand ledger CHECK constraint to permit existing domain value DISPUTE_POOLED. No financial history update/delete; append-only triggers preserved.

Capture reserves one durable attempt before remote I/O. Callbacks/restarts after uncertainty use GET reconciliation rather than blind recapture. Payment validation checks order/capture completion, IDs, exact amount/currency and returned merchant identity when available. Final payment/tracking recording has one transactional winner across sessions. Stable PayPal request IDs separate create/capture operations.

## Rollout verification

Observe CI and auto-deployment; a successful Git push does not prove Render is live. Verify API readiness, configured owner session, anonymous redirect, login/session/reload/cookie flags, logout/denied access, and the separate shop's external PayPal handoff. Never expose session values or passwords in saved evidence.

The complete real sandbox purchase → PayPal Resolution Center → verified webhook → valid live model plan → gate → confirmed execution/phone approval journey remains a distinct deployed T16 proof. Local stub tests do not replace it. Android physical-device push and notifications are still pending.

## Rollback

Keep existing data and signing secret. Roll back application code to a compatible tested revision if necessary; do not downgrade/reset the database or rewrite ledger history. Nullable columns and expanded enum constraint remain compatible with older code. Secure owner-access checkpoint `077af41` is compatible with the expanded schema, but restoring it also restores its older buyer UI; preserve the PayPal-only buyer boundary when preparing any code revert. Prefer a focused corrective commit on main to replaying an unsafe older public interface.

Check the actual serving revision/behavior after rollback and account for existing PayPal/queue operations. A source rollback cannot undo a capture or financial action.

## Local browser-suite limits

The first full local attempt was interrupted after diagnosing inherited demo hold configuration and a missing migrated enum value. Both were corrected with isolation/regression tests and a forward migration. The second completed with 8/12 passing: public PayPal handoff, injection, repeat-disputer approval, webhook deduplication, poller catch-up, kill switch and security tests passed; four failures exposed missing/hidden test hooks and a stale $64 fixture against a $24 order.

Visible hooks and the fixture amount were corrected without removing assertions. Local full browser retries stopped under the repository two-failure rule. Those corrected browser cases need an observed CI/deployed result; do not describe them as locally passed. Full backend/frontend/lint/type/build outcomes are recorded in EXECUTION-LOG.md.

Remote follow-up: all 12 browser tests passed at fac224f, including the edited merchant phone approval and PayPal buyer handoff. The workflow cleanup then failed because setup-python requested an unused pip cache directory; removed that obsolete setting in 1c772d7. **Final 1c772d7 standard CI and full E2E workflows both completed/success** (runs 41233591393 and 41233591407). Local browser retry limits/failure history remain accurately recorded.

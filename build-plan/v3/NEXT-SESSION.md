# Next session — 2 November 2026 checkpoint

## Start here

Continue `codex/signoff-v3` from the documentation checkpoint containing this file (also pushed to main). Application source `3222069f690359f632b8158b0effdb7144b1284e` is deployed. Read applicable AGENTS instructions, this file, latest EXECUTION-LOG entries, STATUS, WEB-PUSH.md and the relevant execution-plan section. Earlier START-HERE/PROGRESS entries are historical where superseded here.

Do not routinely repeat full suites. Explain a necessary check first and use the narrowest relevant verification. Preserve failure evidence. Network-enabled execution is required for local sockets/Docker/Git in this environment. Use the mandated `.venv/Scripts/python.exe` interpreter. No resets/force pushes or unsolicited delegation.

## Authorized work and boundaries

- Owner authorizes compatible tested main promotion and existing Render auto-deploy. Workspace `tea-d4mp0am3jp1c73a3o9eg` was explicitly confirmed. Existing services must be retained.
- Owner explicitly paused new PayPal executor confirmation changes. Keep that pause. A successful GET/arbitrary fingerprint change is still not independent action-specific proof. Do not silently reopen T07 semantics.
- Do not replay or requeue either historical approval for `PP-R-KIU-10195895`. Fresh read-only PayPal checks matched their fingerprint, but both remain approved against old NEEDS_APPROVAL decisions with zero execution records. Retain approved-but-not-executed history.
- VAPID is already securely configured on Render API and worker using one matching pair/contact. Do not regenerate keys, expose values, request another server key, or require a Firebase project. Owner authorized the agent to generate/configure this pair. No frontend private key exists.
- Owner supplied an available Render PITR checkpoint: 2 Nov 2026 11:42:53 WAT / 10:42:53 UTC. No restore/clone was started. Retain schema/history on application rollback.

## Proven checkpoint

- Application `3222069` live on API, worker, merchant and shop. Main CI `41438273810` success: 680 backend tests plus lint/types/contracts/frontend/build checks. Main E2E `41438273843` success: 14 browser cases.
- Render deploys: API `dep-dbk7bs7avr4c73cqk0n0`; worker `dep-dbk7bs7avr4c73cqk17g`; merchant `dep-dbk7bs7avr4c73cqk1o0`; shop `dep-dbk7bs7avr4c73cqk1u0`.
- Hosted schema `e08b3df70008`, healthy API, current worker heartbeat. Push configuration requires owner access; served bundle includes controls, worker v2 has JavaScript MIME, manifest is valid, actual PNG icons are 192/512 pixels.
- Approval decision identity/cross-decision duplicate protection, durable owner history/refresh, expiry/stale/CSRF guards, and saved-versus-executed presentation are implemented. Consumed bearer URLs are not refetched after resolution. The two affected isolated stub approval browser cases pass. No real PayPal mutation was used for this verification.
- T09 shared feedback, deadline reminders, owner/demo recipient isolation, per-destination leased delivery/retries, expired-subscription cleanup and obsolete-reminder cancellation are implemented/deployed. No private response cache or approval/payment fetch handler exists in the worker.
- T10 opt-in, safe phone-test endpoint, stable VAPID, trusted push hosts/public DNS/no redirects, generic encrypted messages, high urgency and duplicate topics, worker updates, install icons and opt-out code are deployed.

## Active blocker: physical phone never displayed the alert

Device reported by owner: Hot 30i, Android 12, standalone Chrome. Owner found Chrome's global Allow notifications switch ON. Website permission should be checked from the new Settings label; per-site Android channel status is not independently confirmed.

Several owner-initiated phone tests were accepted by FCM on the first attempt (delivery rows record delivered with no transport error). An active FCM subscription is present. **That is push-service acceptance, not proof of device receipt/display.** Do not report T10 complete.

Owner reports:

1. Installation failed and no alert appeared after background/lock.
2. After the compatibility/high-urgency release, still no alert.
3. Still no alert with Chrome foreground and screen awake, despite the queued confirmation.

Therefore background battery restriction alone does not explain the observed failure. Do not keep asking for blind retries or assume the phone is at fault.

Additional software check: exact served worker bytes matched source. In an isolated full Chromium context with notification permission granted, a protocol-injected push created one native browser notification with correct generic text and case path, no worker errors. This bypassed FCM/encrypted transport and was not a physical Android test. An initial headless-shell permission override was denied; full Chromium with a proper grant passed. Do not present either as phone proof.

## Next concrete work

1. Add a clearly labeled, explicit-tap **local device display test** using the active registration's `showNotification`, with safe error feedback and a `getNotifications` check. It must not touch PayPal, approvals or server delivery state. This distinguishes local display/permission/channel issues from remote push arrival/decryption.
2. Inspect the actual client registration/update/controller state, browser permission and subscription/public-key consistency without exposing endpoint URLs or keys. If local display works but remote push does not, add scoped safe client receipt/diagnostic evidence or another focused transport check before further guesses. A receipt must never authorize business actions or expose private data.
3. Verify Android per-site notification channel and browser version, then background/battery/data restrictions only as evidence warrants. Android Chrome does not require installation for web push. Verify installation separately using the fresh PNG manifest.
4. After actual receipt, prove correct authenticated click-through, explicit opt-out (server subscription inactive/key cleanup) and no subsequent delivery. Physical restart/stale-subscription acceptance remains open. Record device/browser/time and release SHA; never call FCM 201 a phone display acknowledgement.
5. Finish T08 hosted fresh approval/provider proof without replaying the two historical actions; preserve paused executor semantics. T09 hosted deadline/retry/restart acceptance is not fully demonstrated by local tests alone.

## Other remaining v3 work

T06 real hosted multi-state provider proof/message truthfulness; T07 fresh-state/uncertain-write recovery and confirmation question (paused); T11 dashboard/audit reconciliation; T12 remaining mobile/copy/accessibility; T13 acceptance consolidation; T14–T16 complete hosted buyer purchase → real PayPal dispute → provider/gate/action journey and recovery evidence; T17 truthful handoff/judge demonstration. T03–T05 still need the fresh hosted correlation/shipping/evidence journey. See PROGRESS and the master matrix; no whole-product completion claim.

Raw work/ logs, local test databases and Chromium cache are ignored intermediates, not durable evidence and not safe to publish blindly. No private keys/passwords/subscription URLs belong in commits or chat.

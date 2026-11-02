# Phone notifications and approval continuation

## Current release

Approval checkpoint `6866a37` is on main and Render API/worker/merchant/shop report that exact revision live. Main CI `41430660487` and E2E `41430660537` passed. API readiness reports database connected. This deploy contains the previously reviewed approval identity/idempotency fix, not the subsequent history/toast/push work described below.

Executor confirmation changes remain paused by owner instruction. A recorded CONFIRMED status is not independent proof of an action-specific PayPal receipt. Do not replay uncertain or historical approved actions to test deployment.

## Implemented feature checkpoint (not yet deployed)

- Owner-authenticated approval history survives resolved/expired card refreshes. Server time and execution/job state are separate from approval resolution. Original expiring bearer access and resolve locks/checks remain unchanged.
- Shared accessible, dismissible, deduplicated toasts for policy, approval, shipping, checkout, evidence refresh, connection checks and copying an authenticated dispute link. Pending submission is never described as confirmed execution.
- Deadline reminders use the actual server deadline, deduplicate per deadline and 24-hour/one-hour window, and exclude resolved, overdue and demo-session cases. Delivery rechecks current relevance and cancels obsolete queued/retrying reminders immediately before sending.
- Existing owner inbox remains durable. Demo-session notifications never fan out to owner devices. This is the agreed single-owner product; it is not a multi-tenant notification service or a public demo notification capability.
- Durable per-device delivery attempts use leases, bounded retries and safe errors; delivery is recorded only after a successful push-service response. 404/410 erase and deactivate the destination; 429/5xx/transport errors retry at most five times. Other responses are permanent failures. Settings reports pending/failed delivery counts.
- Push subscriptions require owner authentication and CSRF. Exact trusted push-service hosts, public DNS checks, no redirects, validated keys, generic payloads and short request timeouts bound the transport. Endpoints, private keys, raw responses and buyer content are not logged.
- Opt-in happens only on an explicit tap. Opt-out revokes the server destination before browser unsubscribe, including after local browser storage was cleared. No private API/offline response caching is installed. Click opens an authenticated case without calling any approval/payment API.
- An owner-only, rate-limited phone test can target an existing non-demo dispute and this opted-in device. It creates only an explicitly labeled test notification. It does not run the agent, change the dispute or enqueue execution. A queued test or push-service receipt is not physical-phone proof.

## Render configuration

The owner explicitly asked the agent to configure Render. A fresh P-256 VAPID pair was generated securely, validated for library compatibility, and the same values were merged into both `signoff-api` and `signoff-worker` in the confirmed workspace. Existing variables were preserved. Private key material was not displayed or written into source/Git. VAPID subject uses the configured owner contact from the existing owner-session metadata.

Required keys (values deliberately omitted):

| Key | Where |
|---|---|
| `WEB_PUSH_VAPID_PUBLIC_KEY` | API and worker; API exposes only the public key after authentication |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | API and worker, server only |
| `WEB_PUSH_VAPID_SUBJECT` | Same `mailto:` or HTTPS contact on both |

Do not regenerate the pair at startup or on deploy. Rotation requires browser re-subscription. No frontend VITE secret is needed. Configuration being saved does not prove the new push code is deployed or a phone has received a message.

## Release and rollback

Migration `e08b3df70008` adds subscription/delivery tables and permits a null notification source event for scheduled reminders/tests. It does not rewrite old inbox, approval, decision or execution records. A populated local upgrade and repeated upgrade preserve existing notification/source/outbox identities.

Before promoting this feature checkpoint to main: require its CI, verify a recoverable hosted database backup/PITR checkpoint, then use the existing migration/Render rollout. The owner supplied the Render PITR form showing an available checkpoint on 2 November 2026 at 11:42:53 WAT (10:42:53 UTC). This establishes an available pre-migration recovery point, not a completed restore drill; no recovery/clone was started. Alembic CLI predeploy and API/worker startup share the same migration lock, so concurrent deployment processes cannot apply the migration simultaneously.

Previous application code can ignore the added tables and read the inbox. Roll back compatible application code while retaining the new tables and history; the migration refuses a hosted downgrade. Only the existing schema round-trip check on a validated local disposable `signoff_test*` database in test mode may tear down the new tables. Do not replay PayPal actions during rollback.

## Physical Android acceptance — BLOCKED until actual device use

1. After the feature release is live, sign in on Android Chrome over HTTPS and open Settings.
2. Tap Enable phone notifications; grant permission deliberately. Do not infer permission from desktop tests.
3. Enter a real existing sandbox dispute ID in the phone-check field; tap Send phone test once. Background the app/lock the phone.
4. Verify the deployed worker sends a real notification and the physical phone receives it. Record release SHA, device/browser, time and delivery ID without endpoints/keys.
5. Tap it and verify the correct authenticated case opens. No approval/payment should happen.
6. Disable notifications, create another qualifying test/update safely, and verify no new delivery to this device. Confirm stale-subscription cleanup and pending-delivery restart recovery separately.

iOS/iPadOS 16.4+ requires a Home Screen web app and explicit permission from that app. Neither physical Android nor iOS proof is claimed here. The agent has no physical Android phone available.

## Two historical approvals

Fresh sandbox GET again reports `PP-R-KIU-10195895` WAITING_FOR_SELLER_RESPONSE and a fingerprint matching both original decisions. Read-only Render SQL still reports APPROVE attached to NEEDS_APPROVAL and zero execution rows for both PROVIDE_EVIDENCE and SEND_MESSAGE.

Decision: retain these as approved-but-not-executed history. Do not automatically repair, requeue or resend them. A future explicit evaluation/action must use then-current PayPal state and evidence, the corrected approval path and the unchanged gate. Existing messages/offers do not prove either proposed action was submitted.

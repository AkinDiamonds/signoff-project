# Missing tracking refund approvals

The merchant reports that a $300 dispute with withheld simulated tracking still
shows review required without an actionable approval after the previous fix.

1. Reproduce with both missing-delivery settings and PayPal's supported refund
   actions, including a case that permits a refund offer but not accept-claim.
2. Prepare a full-refund approval when missing delivery plus the unchanged gate
   requires merchant approval. Prefer accept-claim when permitted; otherwise use
   a permitted refund offer. Do not queue execution before approval, override hard
   denials, or change within-limit/default-review behavior.
3. Verify the durable card through dispute details, the attention list, and owner
   approval resolution. Preserve duplicate-run protection and denial/history.
4. Run backend/frontend lint, types, architecture checks, regression suites and
   browser checks with fictional data and isolated local databases. The user's
   explicit regression request authorizes the full checks for this repair.

Gate rules and executor semantics remain unchanged. Hosted behavior is only
verified if the tested revision is deployed and observed separately.

## Implementation and checks

- Both missing-delivery settings now prepare a full-refund card before model
  planning when the existing gate requires waivable merchant approval.
- Accept-claim is preferred; only a PayPal-permission denial permits trying a
  refund offer instead. Hard denials never cause that fallback. Prior confirmed
  decisions include their fingerprints so the gate can enforce idempotency.
- Six API cases exercise both settings and accept/offer/both permissions,
  persistent card links, attention discovery, duplicate runs and approval queueing.
  Ten hard-denial cases and four within-limit/boundary cases preserve safeguards
  and the merchant's automatic-settlement choice.
- Final `make check`: 723 backend tests, 239 frontend tests, Ruff, strict mypy,
  ESLint, TypeScript, three import contracts, enum parity and API freshness pass.
- New phone-viewport browser cases use a $300 shop purchase, actual simulated
  shipment withholding, dispute sync, card reload, approval and one stub refund.
  Both passed. The existing model-failure browser check needed navigation to
  Activity/Technical details; its no-action and error assertions are retained.
- Final full cross-app Chromium run: **16 passed**, including both new mobile
  refund flows and existing evidence, offers/edits, notifications, injection,
  duplicate-webhook, model-failure, kill-switch and buyer-boundary scenarios.
  Used the installed `/usr/bin/chromium` via an ignored local config; first-run
  browser failure evidence is retained under ignored `work/`.
- Hosted deployment, live PayPal submission and recovery of an existing hosted
  dispute have not been performed. No historical approval was replayed.

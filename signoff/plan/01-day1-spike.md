# Day-1 spike: go / no-go

**Rule:** no feature code until the results table below is filled in and the decision is written. Timebox: target 8h, hard stop at 12h, then reassess.
**Output of the spike is also test material:** save every raw PayPal request/response (scrub tokens and emails) as `fixtures/paypal/<step>-<name>.json`, and keep the scripts in `scripts/spike/`. These become the recorded fixtures the real client is tested against.

## Required (steps 1-7 decide go/no-go)

| # | Step | How | Pass criteria |
|---|---|---|---|
| S1 | Sandbox accounts | Create a Business (merchant) and a Personal (buyer) sandbox account. | Both can log in; credentials stored in a password manager, not the repo. |
| S2 | REST app | Create a sandbox REST app, enable **Disputes** in feature options (and Transaction search if you will run the boilerplate's transactions page). | `client_credentials` token obtained by script. |
| S3 | Test transaction | Orders v2: create order (merchant app) → buyer approves in browser → capture. Take the **capture/transaction ID from the capture response**, not from Transaction Search (search can lag up to ~3 hours per the boilerplate README). | You have a transaction ID owned by the merchant. |
| S4 | Buyer-side consent | Per the Disputes set-up docs: enable Log in with PayPal for the buyer with scope `https://uri.paypal.com/services/disputes/create` (and `.../update-buyer` if you want to change reasons), then build the JWT for the `PayPal-Auth-Assertion` header exactly as documented. | A buyer-side identity you can use in API calls. |
| S5 | Create dispute by API | `POST /v1/customer/disputes` with the assertion header, reason `MERCHANDISE_OR_SERVICE_NOT_RECEIVED`. Then `GET` it as the merchant. | Dispute exists. **Record** `status`, `seller_response_due_date`, `allowed_response_options`, `links`. |
| S6 | Webhook | Subscribe to `CUSTOMER.DISPUTE.CREATED/UPDATED/RESOLVED` via tunnel. Receive the event for S5. Verify the signature with the verify-webhook-signature API. Save the raw headers and body. Re-deliver the same event and confirm you can dedupe it. | Verified event captured; dedupe key identified. |
| S7 | Provide evidence | `POST .../provide-evidence` with `PROOF_OF_FULFILLMENT` (carrier + tracking number). Re-`GET`. | Dispute shows the evidence/state change; request and response saved. |

## Answers needed by Oct 10 (each has a fallback)

| # | Question | Fallback if the answer is bad |
|---|---|---|
| S8 | Can you drive a dispute to a resolved state in sandbox (the docs mention sandbox-only update-status / settle / **adjudicate**)? Can you force "seller wins" for Scenario A? | Show resolution via recorded payload and say so in the README. |
| S9 | After `make-offer` (partial), what state results? The API docs note buyer acceptance is needed for partial offers. How do you simulate that in sandbox? | End Scenario C at "offer sent, awaiting buyer" and be transparent. |
| S10 | Can a transaction host a second dispute after the first is settled? How many transactions do 5 scenarios + judge-generated tests need? | Seed a pool (20-30) via a script; cap judge-generated disputes per day. |
| S11 | Boilerplate: does it run (Node 20.9+), is AG Studio actually wired (its README describes simple tables), which versions are in `package.json`? | Start `web/` from the AG Studio quick start; record in ADR-005. |
| S12 | `paypal-agent-toolkit` (Python ≥3.11): how does it authenticate, which version installs, do `list_disputes` / `get_dispute` work in sandbox? | Own httpx read client only; keep toolkit out of the dependency graph. |
| S13 | Which `reason` besides not-received has the simplest evidence flow (CREDIT_NOT_PROCESSED + PROOF_OF_REFUND, or UNAUTHORISED)? File type/size limits? | Cut the second reason (cut list item 3). |
| S14 | Hello-world FastAPI + Postgres on Render: reachable webhook URL, cold-start behavior, plan limits. | Pick an always-on instance type before the demo. |

## Decision rule
- **GO:** S1-S7 pass. Write ADRs for S8-S14 answers. Proceed to week 2.
- **GO with fallback:** S5 or S6 fails but `simulate-event` + recorded payloads work. Proceed, label simulated parts in README (ADR required).
- **NO-GO:** S5 and S6 both fail after the timebox. Stop. Reassess with the builder before writing more code.

## Results (fill in; paste evidence links or fixture filenames)

| Step | Result (PASS/FAIL/PARTIAL) | Evidence | Time spent | Notes / surprises |
|---|---|---|---|---|
| S1 | | | | |
| S2 | | | | |
| S3 | | | | |
| S4 | | | | |
| S5 | | | | |
| S6 | | | | |
| S7 | | | | |
| S8 | | | | |
| S9 | | | | |
| S10 | | | | |
| S11 | | | | |
| S12 | | | | |
| S13 | | | | |
| S14 | | | | |

**Decision:** _GO / GO with fallback / NO-GO — date — one paragraph._

# Build plan

Step-by-step implementation plan from the repo and license to the point where both sides (buyer storefront and merchant dashboard) can be tested end to end, **right before deployment**. Deployment is a separate plan, seeded by step 36.

## What gets built
| Host (placeholders) | Package | Audience |
|---|---|---|
| `signoff.<domain>` | `web/` | Merchant: product site, judge guide, AG Studio dashboard, dispute detail, charter, demo panel, phone approval pages |
| `shop.<domain>` | `shop/` | Buyer: fictional candle shop, sandbox checkout, order tracking, report a problem, buyer replies |
| `api.<domain>` | `agent/` | FastAPI service, worker, gate, executor, ledger, webhook receiver |

All three stay under one registrable domain so the demo session cookie is same-site. Shared code: `packages/api-client` (generated types) and `packages/ui` (tokens and components).

## How to work one step (for you and any agent)
1. Read in this order: `plan/STATUS.md`, `CONVENTIONS.md`, `build-plan/contracts.md`, the step file. For tests also read `types-testing.md` or `e2e-playwright.md` when the step names them.
2. Before editing, write down in the session notes the files you will touch. They must match the step's Files list. Do not touch other files except to read.
3. Write the tests first for the listed edge cases, watch them fail, then implement.
4. No new dependency unless the step says so; if one seems necessary, stop and add a question to `plan/STATUS.md`.
5. Do not change test expectations to match output. If an expectation looks wrong, write it in the review log and ask.
6. If the same test fails three times after changes, stop. Paste the failing output into STATUS blockers.
7. Run `make check` (R1) plus any re-run items named in the step. Tick every Done-when item truthfully.
8. Report in this format: files changed; tests added (count and names of edge-case groups); commands run with pass or fail; edge cases not covered and why; things not verified.
9. Commit once with the step's commit message. One step per commit, so a bad step reverts cleanly.

## Regression ladder
- **R0 (every commit):** lint, type check, unit tests, type tests.
- **R1 (every step):** the whole agent and web suites plus type tests plus import contracts. Tests are never deleted or skipped to get green; any skip needs a review-log line.
- **R2 (steps 24 onward):** Playwright smoke subset.
- **R3 (steps 34 to 36 and before any recording):** full Playwright suite plus `make rehearse` on the real sandbox.

## Code review loop
You review the commit, write findings in the step's Code review log, the agent fixes them in a follow-up commit (`fix(review): step NN ...`), re-runs the stated level, and you tick the row. A step is closed when its review log has no open rows.

## Schedule targets (today is Oct 6; freeze Nov 8)
P0 Foundation and P1 Ingestion: Oct 7-12 · P2 Policy: Oct 13-17 · P3 Agent: Oct 18-23 · P4 Simulation: Oct 24-26 · P5 Merchant UI: Oct 27-Nov 1 · P6 Client-facing: Nov 2-5 · P7 Integration: Nov 6-8 · Nov 9 record. The estimate below includes about 22 hours the original handoff did not budget (storefront, buyer portal, stub server, hardening). Update targets in `plan/STATUS.md` if you slip.

## Cut list (extends `plan/02-roadmap.md`)
In order: step 29 widgets beyond two, the assistant part of step 28, step 22 (second reason and repeat flag), landing polish in step 33 (keep the guide), step 35 fuzzing. Never cut: the gate and ledger (11-14), injection suite (18), approvals (19, 26), storefront and buyer dispute path (30-32), e2e smoke (34), predeploy gate (36), the video, the README.

## Steps
| Step | Title | Phase | Depends on | Est |
|---|---|---|---|---|
| [00](steps/00-spike-record.md) | Record spike results and lock decisions | P0 Foundation | - | 1h |
| [01](steps/01-repo-license-ci.md) | Repo, license and CI skeleton | P0 Foundation | 00 | 2h |
| [02](steps/02-agent-skeleton.md) | Agent service skeleton | P0 Foundation | 01 | 2h |
| [03](steps/03-database.md) | Database schema and migrations | P0 Foundation | 02 | 2h |
| [04](steps/04-web-workspaces-types.md) | Web workspaces, generated client, type-test harness | P0 Foundation | 02 | 3h |
| [05](steps/05-paypal-models.md) | PayPal models and fixture contract tests | P1 Ingestion | 03 | 2h |
| [06](steps/06-paypal-read-client.md) | PayPal read client and token cache | P1 Ingestion | 05 | 2h |
| [07](steps/07-webhook-receiver.md) | Webhook receiver | P1 Ingestion | 03,05,06 | 3h |
| [08](steps/08-job-queue.md) | Job queue and worker | P1 Ingestion | 07 | 2h |
| [09](steps/09-dispute-sync.md) | Dispute sync and reconciliation poller | P1 Ingestion | 06,08 | 2h |
| [10](steps/10-charter.md) | Authority Charter model, versions and API | P2 Policy | 03 | 2h |
| [11](steps/11-gate-core.md) | Gate part 1: types, aggregation, PayPal and time rules | P2 Policy | 05,10 | 3h |
| [12](steps/12-gate-rest.md) | Gate part 2: amount, reason, history, idempotency, approval | P2 Policy | 11 | 3h |
| [13](steps/13-executor.md) | Mutating client, executor and architecture guard | P2 Policy | 12 | 4h |
| [14](steps/14-ledger.md) | Decision ledger and timeline API | P2 Policy | 13 | 2h |
| [15](steps/15-mock-store-evidence.md) | Mock store, evidence builder, evidence strength | P3 Agent | 14 | 2h |
| [16](steps/16-llm-interface.md) | LLM interface, cache and budget | P3 Agent | 02 | 2h |
| [17](steps/17-agent-loop.md) | Agent loop and plan schema | P3 Agent | 09,12,13,15,16 | 3h |
| [18](steps/18-injection.md) | Injection screening and adversarial suite | P3 Agent | 17 | 2h |
| [19](steps/19-approvals-backend.md) | Approvals backend | P3 Agent | 12,13,17 | 3h |
| [20](steps/20-paypal-stub.md) | PayPal stub server for deterministic tests | P4 Simulation | 05,07,13 | 3h |
| [21](steps/21-walking-path.md) | End-to-end backend path for scenarios A and B, KPIs | P4 Simulation | 14,17,18,19,20 | 3h |
| [22](steps/22-second-reason.md) | Second dispute reason and repeat-disputer flag | P4 Simulation | 21 | 2h |
| [23](steps/23-demo-generator.md) | Test-dispute generator, pool and quotas | P4 Simulation | 20,21 | 3h |
| [24](steps/24-web-shell.md) | Signoff web shell, design system, state components | P5 Merchant UI | 04,21 | 3h |
| [25](steps/25-disputes-ui.md) | Dispute list, detail and Decision Timeline | P5 Merchant UI | 24,14,21 | 3h |
| [26](steps/26-approval-ui.md) | Approval page (mobile first) | P5 Merchant UI | 24,19 | 3h |
| [27](steps/27-charter-demo-ui.md) | Charter page and demo panel | P5 Merchant UI | 24,10,23 | 2h |
| [28](steps/28-studio-dashboard.md) | AG Studio dashboard and read-only assistant | P5 Merchant UI | 25,21,16 | 4h |
| [29](steps/29-widgets.md) | Custom widgets | P5 Merchant UI | 28 | 3h |
| [30](steps/30-shop-backend.md) | Storefront backend: catalog, orders, checkout | P6 Client-facing | 21,23 | 3h |
| [31](steps/31-shop-frontend.md) | Storefront frontend | P6 Client-facing | 30,24 | 3h |
| [32](steps/32-buyer-portal.md) | Buyer portal: orders, tracking, dispute, messages | P6 Client-facing | 31,23,19 | 4h |
| [33](steps/33-product-site.md) | Signoff product site and judge guide | P6 Client-facing | 31,32 | 2h |
| [34](steps/34-e2e.md) | Cross-app Playwright scenarios A to E | P7 Integration | 21 to 33 | 4h |
| [35](steps/35-hardening.md) | Hardening and security | P7 Integration | 34 | 3h |
| [36](steps/36-predeploy.md) | Pre-deploy readiness gate | P7 Integration | 35 | 2h |

Total estimate: 97h of agent-assisted work plus your review time.

Supporting files: `contracts.md` (shared vocabulary), `types-testing.md`, `e2e-playwright.md`, `_apply-to-existing-plans.md` (small edits to the existing plan files).

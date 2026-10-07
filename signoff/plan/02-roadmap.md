# Roadmap

Today: **Oct 6, 2026**. Deadline: **Nov 12, 12:00 PT (20:00 UTC)**. Submit target: Nov 10. Budget about 150h; at 15h/week apply the cut list from the start.

**Strategy: walking skeleton first.** By Oct 18 a crude path must run end-to-end: webhook → job → *scripted* plan (no LLM yet) → gate → executor → ledger → one dashboard row. Then replace pieces with real ones. This keeps something demoable at every point.

## Gates
| Date | Gate | If missed |
|---|---|---|
| Oct 10 | Spike passes (`01-day1-spike.md`) | Fallback or stop per decision rule |
| Oct 18 | Skeleton deployed on Render; first reason works end-to-end | Cut second reason and repeat-disputer flag now |
| Oct 24 | Core works + 20h spare? Decide buyer-side stretch | Default: skip the stretch |
| Nov 1 | UI complete (dashboard, approvals, simulator button) | Cut widgets beyond two, then NL queries |
| Nov 8 | **Feature freeze** | Only fixes after this |
| Nov 9 | Record video | Backup recording kept |
| Nov 10 | Submit | Nov 11-12 are buffer, not plan |

## Weeks
**Week 1 (Oct 5-11) — spike and foundations**
- [ ] First-day actions (account, Devpost, Discord, public repo + license)
- [ ] Spike S1-S14, fixtures saved
- [ ] ADRs for spike answers; ADR-005 (web framework) and ADR-008 (LLM) decided
- [ ] Repo CI skeleton: ruff, mypy, pytest, import-linter, eslint, tsc, gitleaks

**Week 2 (Oct 12-18) — skeleton**
- [ ] Postgres schema + Alembic; webhook receiver (verify, dedupe, enqueue); job worker
- [ ] `read_client` and `mutating_client` split; fixtures-based tests
- [ ] Gate v1 (rules G1-G6) with matrix tests; charter model
- [ ] Executor with write-ahead protocol; ledger
- [ ] Scripted planner → first reason end-to-end; first Render deploy

**Week 3 (Oct 19-25) — agent and approvals**
- [ ] LLM interface + real planner with schema validation; evidence builder; mock store
- [ ] Approval flow (token, card, approve/deny/edit → re-gate)
- [ ] Second reason; repeat-disputer flag
- [ ] Reconciliation poller; injection suite v1
- [ ] Oct 24 stretch decision

**Week 4 (Oct 26-Nov 1) — dashboard**
- [ ] OpenAPI → typed client; dashboard shell in AG Studio with real data
- [ ] KPIs, dispute grid, dispute detail + Decision Timeline
- [ ] Demo panel (scenarios A-E, reset); Studio assistant with read-only tools
- [ ] Deadline Radar, Authority Meter; theme

**Week 5 (Nov 2-8) — hardening**
- [ ] Demo rehearsal script green against sandbox; rate limits; kill switch
- [ ] README complete, claims-ledger reviewed; hosted-demo checks logged out
- [ ] Feature freeze Nov 8

**Nov 9-12:** record, submit, buffer. Keep demo and repo up through Dec 15.

## Hour budget (from handoff)
Setup+spike 12 · webhooks/client/ledger 18 · gate+charter 15 · agent+evidence+mock store 25 · approvals UI 10 · dashboard 25 · simulator+seeding 8 · deploy/README/tests/security 12 · video+Devpost 15 · buffer 10. **The dashboard line is the least certain** (new AG Studio APIs, licence, agent adapter).

## Cut list (in order)
Stretch features → repeat-disputer flag → second reason → widgets beyond two → natural-language queries.
**Never cut:** the gate, decision log, demo scenarios, video, README.

## Dates to know (UTC; PDT until Nov 1, PST after)
Webinars: Oct 6 16:00 · Oct 7 16:00 · Oct 12 14:00 · Oct 13 08:00. Deadline Nov 12 20:00.

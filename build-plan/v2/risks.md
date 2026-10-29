# Risks, tripwires and the cut list

## Calendar

Stages 1-10 total about 38 hours. Ten days at 5 hours a day is 50. That leaves roughly two days of slack inside the build window, and the video and submission sit outside it on 6-7 and 10 November. Spend the slack on Stage 6, never on a new feature.

| Date | What must be true by the end of it |
|---|---|
| 27 Oct | Stages 1 and 2 done. Stage 3 half done |
| 28 Oct | Stage 3 done: grid resolved or documented, AI panel in. Stage 4 started |
| 29 Oct | Stage 4 done: API healthy, worker running, both sites reachable |
| 30 Oct | Stage 5 done: a real sandbox dispute through webhook, sync, gate, approval |
| 31 Oct | Stage 6 parts A and B: store API and the adapter behind contract tests |
| 1 Nov | Stage 6 parts C and D: orders bound to real transactions; hold and claim working |
| 2 Nov | Stage 6 parts E, F, G: pool page, approval link, replay |
| 3 Nov | Stage 7 done: tokens, shell, four components |
| 4 Nov | Stage 8 done: all seven seller screens match the reference |
| 5 Nov | Stages 9 and 10 done. **Freeze.** Tag `freeze-2026-11-05` |
| 6 Nov | Video recorded and edited |
| 7 Nov | Video published, README and guide final |
| 8 Nov | Pool refreshed, dry run as a stranger |
| 9 Nov | Dry run on a phone on mobile data; fix blockers only |
| 10 Nov | Submitted |
| 12 Nov | 12:00 PT hard deadline; final sweep |
| 1 Dec | Judging opens: refresh pool, confirm services up |
| 15 Dec | Judging closes: services stay up |

## Tripwires

A tripwire is a check you run on a date that tells you to change plan, before it is too late.

| Date | Check | If it fails |
|---|---|---|
| 28 Oct | Did the AG Studio grid resolve or get documented within its 2-hour box? | Stop there. Fall back to value widgets and move to the deploy. |
| 29 Oct | Is the API healthy on Render and is the worker running? | Drop everything else. Nothing else matters until it is. |
| 30 Oct | Did a real sandbox dispute reach the deployed agent? | Cut Stage 6 G (replay) and E2 (start-over). Keep the judge path. |
| 2 Nov | Can a stranger claim and watch a dispute? | Skip Stage 10, go straight to the video with the guide as-is. |
| 4 Nov | Do the seller screens look like the reference? | Freeze the design at whatever is done. Do not carry styling into video week. |
| 5 Nov | Is the freeze tag pushed? | Stop adding features. Record with what exists. |
| 7 Nov | Is the video public and under 3:00? | Submit with a shorter video. Do not miss the deadline for polish. |

## The cut list, in order

Cut from the top. Stop as soon as you are back on schedule.

1. Stage 13, Shopify bonus — always first
2. Stage 6 Part G, replay
3. Stage 8 disclosures and the Dashboard tools section
4. Stage 10 numbers block
5. Stage 9 product page
6. Stage 3 native AI panel — fall back to the existing panel and record why
7. Stage 8 charter history list
8. Stage 6 Start-over button
9. The worker as a separate service — fold it into the API process (saves a service, loses clean separation)
10. Stage 7 mobile slide-over nav

## Never cut

- The deployment
- Stage 5, the real PayPal loop
- The judge path: claim, watch, approve
- The approval card working on a phone
- The injection block being visible
- The video
- The submission form
- Keeping services alive until 15 Dec

## Named risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| PayPal sandbox dispute windows expire before judging | High | Judge sees no live dispute | Pool refreshed 8 Nov and 1 Dec; replay view covers an empty pool; guide explains the real flow |
| AG Studio grid never renders | Medium | Weaker AG Grid prize claim | Time-boxed to 2h in Stage 3; fall back to value widgets; document honestly |
| Claude/Sonnet usage limits stall a stage | Medium | A day lost | Each stage file is self-sufficient; the prompts are short |
| Render credit runs out before 15 Dec | Medium | Judges hit a dead link | Check the plan's monthly price at Stage 4; two reminders to check billing |
| LLM provider outage during the video | Low | Cached reasoning on camera | Check `llm_mode` is `LIVE` immediately before recording; UI labels cache hits |
| Two copies of ag-grid in the dev bundle confuse the diagnosis | Medium | Hours lost | Stage 3 tests a production build first |
| A secret leaks into a commit | Low | Disqualification risk | Stage 1 and Stage 12 both run a secrets scan; `.env` is gitignored and never committed |
| The judge path depends on your laptop | Low | Fails without you | Stage 4 and Stage 6 exist to remove that dependency; Stage 12 Step 2 proves it |

## When something is behind

1. Check the tripwire for today.
2. Cut from the top of the cut list until you are on schedule.
3. Write the cut into `decision-log.md` with the date.
4. If the cut removes a claim, change the claim the same day.
5. Never quietly carry a broken stage forward. A documented cut scores; a half-finished stage does not.

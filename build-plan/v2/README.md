# Signoff — completion plan (v2)

Written 27 Oct 2026. Supersedes `build-plan/steps/Signoff launch plan Oct 26 to Nov 10.md`.

Read this file once, then work top to bottom through the numbered files. Every stage has a **Done when** check. Do not start the next stage until the current one passes it.

---

## What changed from your v1 plan, and why

| v1 | v2 | Why |
|---|---|---|
| S3/S4 build Luminary: separate app, own database, own Render service, 7h + 5h + manual dispute filing | No Luminary service. A thin `StoreAdapter` over the existing shop, about 4h | You already have a working shop with orders and tracking. Luminary adds an architecture diagram, a second deploy and a fleet of disputes that can lapse. The Shopify answer survives with the adapter interface. |
| Judges file their own disputes, pool of 15 pre-filed | Pool of 5 pre-filed, held until claimed, plus a replay view | Real PayPal sandbox and stub cannot run in one deployment (`APP_ENV=prod` forbids `PAYPAL_ENV=stub`). Deployed = real sandbox. Stub demo stays local for your own testing and runs with one Docker command. |
| UI implied | Three dedicated UI stages with a named reference product (Shopify admin) and concrete things to copy | Design is 20% of the score and you have no design stage. |
| Video on Nov 6-7 | Video on Nov 5-6, immediately after freeze | Making the video is what shows you what is missing. Ten days of buffer is better than two. |
| Shopify clip optional, S8 | Stage 13, explicitly a bonus after everything else | Your call. Nothing depends on it. |

---

## Locked decisions

These were decided on 27 Oct 2026 and the files assume them. Do not re-open without writing a new entry in `decision-log.md`.

1. **Store integration is a thin `StoreAdapter`**, not a separate Luminary service.
2. **One deployment, real PayPal sandbox.** Stub demo is local only, documented in the README.
3. **Judges reach a dispute through a pre-filed pool** that is held, claimed, then processed live.
4. **Approval cards are reachable from the demo workspace** through a link surfaced on the dispute page. Tokens stay hashed at rest.
5. **The AG Studio dashboard gets Studio's native AI panel**, not just your custom "Ask the dashboard" box.
6. **UI reference is Shopify admin**: card-based, plain language, green accent, built for small merchants.
7. **Shopify real-store clip is a bonus**, stage 13, only if stages 1-12 are done.
8. **Drawer: AG Grid sponsor prize.** Keep whatever works; do not let it block other stages.
9. **Freeze 5 Nov. Video 5-6 Nov. Submit 10 Nov.** Hard deadline 12 Nov, 12:00 PT.

---

## The order, and why

```
Stage 1  Truth pass and commit captures       ~1h
Stage 2  Environment and secrets              ~1h
Stage 3  AG Studio: grid bug, then judge it   ~4h
Stage 4  Deploy to Render                     ~5h     <-- everything else depends on this
Stage 5  Real sandbox wiring                  ~4h
Stage 6  Judge flow: hold, claim, pool, replay ~7h    <-- the thing judges touch
Stage 7  UI foundation: Shopify admin tokens  ~3h
Stage 8  UI: seller app                       ~6h
Stage 9  UI: buyer shop                       ~3h
Stage 10 UI: landing and judge guide          ~4h
Stage 11 Video                                ~6h
Stage 12 Submission                           ~2h
Stage 13 Shopify clip (bonus)                 ~4h
```

Stage 4 before Stage 6 because a judge flow you cannot open from the internet is not a judge flow. Stage 3 before Stage 4 because the dashboard is part of the deployed product and a half-fixed dashboard is a wasted deploy cycle.

---

## Rules for every stage

1. **One stage, one branch, one commit.** Commit message starts with `feat:` or `fix:` or `docs:`.
2. **Run the checks before you commit.** `make test-web` and `make test-agent`. The failing count must not grow. Current baseline: web 159/159, agent 373 passing (DB suites need Postgres).
3. **If a step is ambiguous, stop and write the question at the bottom of that stage's file.** Do not guess.
4. **If a step takes more than 1.5x its estimate, stop** and use the cut list in `risks.md`.
5. **Never commit `signoff/.env`.** It is gitignored and must stay that way.
6. **Anything you claim in the video or README needs a row in `signoff/docs/claims-ledger.md`.**

---

## Two corrections to what you were told earlier

Both were mistakes in the assessment I gave you on 26 Oct. They are fixed in the files.

1. **The AG Studio black squares are not "the watermark".** I said that as if it were established; it was a guess. The watermark is a licence warning printed to the console. The black squares are a separate, still-unexplained rendering fault. Stage 3 treats them as a bug to diagnose, not as an accepted limit.
2. **The grid rendering zero rows may not be a Studio bug at all.** A plausible and untested cause is two copies of `ag-grid-community` in a Vite dev server: a grid built against one copy can render an empty body against the other, which would explain the value widget working on the same data. I have not verified this. Stage 3 tests a production build before changing any code, because that test costs minutes and the alternative costs hours.

---

## Where things live

- Plans and code: `build-plan/v2/` (these files), `signoff/` (the app)
- Claims and evidence: `signoff/docs/claims-ledger.md`
- Decisions you change: `build-plan/v2/decision-log.md`
- What to cut when behind: `build-plan/v2/risks.md`

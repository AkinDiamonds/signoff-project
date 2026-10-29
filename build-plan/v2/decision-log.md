# Decision log

Every decision that would otherwise be re-litigated. Add a row when you change something; never delete a row.

## Locked on 27 October 2026

| # | Decision | Why | What it rules out |
|---|---|---|---|
| D1 | Thin `StoreAdapter` over the existing shop; no separate Luminary service | The shop already holds orders, tracking and messages. A second service adds a deploy and a database for an architecture diagram. | S3/S4 of the v1 plan |
| D2 | One deployment on the real PayPal sandbox | A single instance cannot run the stub and the sandbox at once: `APP_ENV=prod` refuses `PAYPAL_ENV=stub` | A hosted one-click stub demo |
| D3 | The stub demo stays in the repo and runs locally with one Docker command | Keeps the A-E scenarios for your own testing and for anyone who wants to reproduce | Claiming the hosted site runs the stub |
| D4 | Judges reach disputes through a held pool, claimed on demand | A webhook would otherwise spend a dispute before a judge arrives | Live dispute creation by judges |
| D5 | Approval links are surfaced on the demo workspace dispute page | The token currently only reaches the server log, so nobody can approve | Emailing links |
| D6 | AG Studio uses its native AI panel | Better for the AG Grid track; the existing proxy stays as the security boundary | The custom "Ask the dashboard" panel as the primary |
| D7 | UI reference is Shopify admin (Polaris) | The audience is small merchants; familiarity reads as credibility | Stripe, Linear, Mercury |
| D8 | Shopify real-store clip is a bonus, stage 13 | Nothing else depends on it | Promising it in the submission |
| D9 | Freeze 5 Nov, video 5-6 Nov, submit 10 Nov | The video is what reveals what is missing; a late video has no recovery time | Building until 8 Nov |
| D10 | Deployed services stay up until 15 Dec | The rules require availability for the whole judging period | Letting the credit lapse |

## Fill these in as you go

| # | When | Decision | Evidence |
|---|---|---|---|
| D11 | Stage 3 | Is the empty grid a dev-server artefact or a real bug? |  |
| D12 | Stage 3 | Was the black-square cause found? |  |
| D13 | Stage 3 | Proxy option A (allow Studio page tools) or B (questions only)? |  |
| D14 | Stage 5 | Days of usable life for a sandbox dispute, measured |  |
| D15 | Stage 6 | How a pool row is marked `done` |  |
| D16 | Stage 7 | Brand accent: keep teal for brand only, Shopify values for actions? |  |
| D17 | Stage 13 | Can a Shopify dev store take real PayPal payments? |  |

## Rules for changing a decision

1. Write the new row with the date and the reason.
2. If it changes a stage file, update that file in the same commit.
3. If it changes what you can claim in the submission, update `signoff/docs/claims-ledger.md` before the video.

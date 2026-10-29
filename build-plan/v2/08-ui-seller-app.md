# 08 — UI: the seller app

**Goal:** every seller screen looks like it belongs in Shopify admin, and a new user can answer "what is happening, what needs me, what do I do next" from any of them.
**Time:** 6 hours.
**Before you start:** Stage 7 done (tokens, shell, four components, `copy-rules.md`).

---

## The standard every screen is held to

Before you start a screen, open the reference screenshot it copies from `refs/notes.md` next to it. When you finish, put the two side by side and ask four questions:

1. Same density? Shopify fits roughly one idea per card.
2. Same type scale? One 20px title, 13px body, 12px labels. Nothing else.
3. Same restraint? Shopify uses one accent for actions and colour only for status.
4. Same plain language, per `copy-rules.md`?

If any answer is no, fix it before moving on.

---

## Screen 1 — Home (`/app`) — 75 min

Reference: screenshot 1 (dashboard).

**PROMPT.**

> Rebuild the merchant home page in `signoff/web/src/features/dashboard/DashboardPage.tsx` as a Shopify-style overview:
>
> 1. `PageHeader`: title "Disputes", description "What needs you today." No primary action.
> 2. A row of four compact metric cards, equal width, 16px padding, white, 8px radius, 1px border: **Open disputes**, **At risk**, **Recovered**, **Needs your approval**. Each shows a 24px number, a 12px secondary label, and one line of context. The approval card is a link to the filtered dispute list and is visually emphasised when the count is above zero.
> 3. A **Recent disputes** `DataTable` with columns: Dispute, Buyer reason, Amount, Verdict, Due. Five rows maximum, then a "View all disputes" link.
> 4. Everything below that — the custom widgets and the AG Studio panel — moves under a collapsed **Dashboard tools** disclosure that is closed by default. The home page must be readable in one screen at 390px wide.
>
> Keep the AG Studio workspace reachable: put **Open Studio builder** inside the disclosure.

**Check:** at 390px, the four metric cards stack to two columns and nothing overflows horizontally.

## Screen 2 — Disputes list (`/app/disputes`) — 60 min

Reference: screenshot 2 (orders list).

**PROMPT.**

> Rebuild the dispute list using `DataTable`:
>
> 1. `PageHeader`: "All disputes", description "Every dispute PayPal has opened for this store."
> 2. Filter row above the table: a status select, a reason select, and a search box that matches dispute id or order code. Filters live in the URL, as they already do.
> 3. Columns: Dispute (link, monospace id), Buyer reason (plain-language label, not the PayPal enum), Amount (right-aligned, tabular), Verdict (`StatusBadge`), Due (relative: "Due in 3 days", "Overdue by 1 day", with the absolute date underneath in 12px secondary).
> 4. Reason must never be shown as `MERCHANDISE_OR_SERVICE_NOT_RECEIVED`. Map it: "Item not received", "Not as described", and an "Other" fallback. Put the mapping in one exported function and test it.
> 5. Empty state: heading "No disputes yet", one sentence explaining that disputes appear here when PayPal opens one, and one action "See how it works" linking to `/guide`.

**Check:** a screenshot at 1440px, and a check that filtering by status keeps the URL shareable.

## Screen 3 — Dispute detail (`/app/disputes/:id`) — 90 min

Reference: screenshot 3 (order detail).

This is the screen the video spends most of its time on. Treat it as the most important page in the product.

**PROMPT.**

> Rebuild the dispute detail page to a two-column Shopify record layout:
>
> **Left column (about two thirds)**
> 1. `PageHeader` with the dispute id as the title, the plain-language reason as the description, and the amount and verdict as a `StatusBadge` beside it.
> 2. **What happened** card: the timeline, newest first, each entry with a time, a one-line summary and, where there is a rule id, the rule shown as a small monospace chip with a tooltip that explains it in plain English. This is the audit trail; it must be legible without any explanation.
> 3. **Evidence gathered** card: each item as a row with a source label (`Store`, `PayPal`, `Demo carrier`), what it proves in one sentence, and when it was fetched. If nothing was gathered, say why in one sentence.
> 4. **Buyer message** card: the untrusted text, clearly attributed and clearly marked as untrusted. Show it verbatim; never summarise it.
>
> **Right column (about one third)**
> 5. **Decision** card: the gate verdict, the rule id, and one sentence of why. If approval is needed, the **Open approval card** button from Stage 6 sits here, primary, full width.
> 6. **Details** card: amount, currency, due date, buyer, order, PayPal reference.
>
> **Rules:** the page must explain itself to someone who has never heard of a signing limit. The first time "rule G3-01" appears, a tooltip says what that rule protects. Do not use the word "fingerprint" anywhere a judge can see.

**Check:** read the page top to bottom as if you were the judge. If you have to ask "what does this mean" once, fix it.

## Screen 4 — Approval page (`/approve/:token`) — 60 min

Reference: screenshot 6 (confirmation sheet). This page stays standalone and mobile-first — no sidebar.

**PROMPT.**

> Keep the existing approval logic untouched; restyle only.
>
> 1. A single column, max-width 520px, 16px padding, white card on `#F1F1F1`.
> 2. Top: what is being asked, in one sentence — "Signoff wants to refund USD 50.00 on dispute PP-D-1002."
> 3. Then the evidence summary: three bullets maximum, each one line.
> 4. Then the gate reason and rule id, in the plain-English form.
> 5. Then a deadline line: "This request expires in 6 hours."
> 6. Then three full-width buttons, stacked: **Approve**, **Change the amount**, **Decline**. Approve is primary and dark; Decline is a quiet text button, not red, because declining is a normal outcome.
> 7. Changing the amount reveals a single input and a confirm step that repeats the final number.
> 8. All outcome screens (approved, declined, expired, already resolved, stale, invalid) use the same card with a `StatusBadge` and one sentence. No confetti, no emoji.

**Check:** approve a real dispute on a 390px phone, one-handed.

## Screen 5 — Charter (`/app/charter`) — 45 min

Reference: screenshot 4 (settings).

**PROMPT.**

> Rebuild the charter page as a Shopify settings form:
>
> 1. `PageHeader`: "Signing limits", description "What the agent may do without asking you."
> 2. Three setting rows, each: label at 13px semibold, helper text at 12px secondary underneath, then the control. Labels must be plain: "Refund without asking, up to", "Accept a claim without asking, up to", "Handle disputes up to".
> 3. Money inputs show the currency inside the field on the left and accept only two decimals.
> 4. A sticky save bar at the bottom appears only when something changed, with **Save** and **Discard**. This is the Shopify pattern and it removes the need for a modal.
> 5. Version history below as a simple list: "Version 3 — 27 Oct, 14:02 — refund limit raised from USD 25 to USD 40".
> 6. The conflict screen (someone else saved a newer version) becomes a banner at the top of the form, not a modal.

**Check:** change a limit, save, reload, confirm it persisted and the history row appeared.

## Screen 6 — Demo panel (`/app/demo`) — 30 min

**PROMPT.**

> Keep the five scenario buttons but restyle to Shopify: a two-column grid of cards, each with a title, a one-line description of what it shows, and a **Run this scenario** button. Show the pool counter as plain text above. Keep the frozen and cached banners, restyled as Shopify banners (full width, tinted background, 12px text).

## Screen 7 — Pool page (`/app/pool`) — 30 min

Restyle to the same card grid as the demo panel so the two feel like siblings. Keep the states from Stage 6.

---

## Global passes (do these last, once) — 45 min

**PROMPT.**

> Across `signoff/web`:
> 1. Replace every inline style hex with a token. Run `grep -rn "#[0-9A-Fa-f]\{6\}" signoff/web/src` and fix every hit that is not inside `tokens.ts`.
> 2. Replace every hard-coded gap with a `spacing` value.
> 3. Make every interactive element reachable by keyboard with a visible focus ring of 2px teal at 2px offset.
> 4. Add `lang="en"` and a single `<h1>` per page.
> 5. Run the axe scan in the existing Playwright specs and confirm zero serious or critical violations.

---

## Done when

- [ ] All seven screens match their reference screenshots side by side
- [ ] No raw hex outside `tokens.ts`; no raw gaps
- [ ] Every screen readable at 390px with no horizontal scroll
- [ ] A dispute id is never the only way to understand a row — plain-language reason is always shown
- [ ] axe scan clean
- [ ] Web suite passes, and every screenshot is saved under `build-plan/v2/refs/after/`

---

## If it goes wrong

**The detail page becomes too long.** Move the evidence card behind a disclosure. The timeline and the decision must be visible without scrolling.

**Tests break on renamed text.** Tests asserting copy should be updated to the new copy; tests asserting behaviour should not need changing. If a behaviour test breaks, you changed behaviour — revert.

---

## Cut

In this order: the "Dashboard tools" disclosure (hide Studio behind a route instead), the sticky save bar (plain save button), the charter history list, the Demo panel restyle (leave it, it is not in the judge path).

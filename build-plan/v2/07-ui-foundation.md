# 07 — UI foundation: the Shopify admin look

**Goal:** one set of tokens, one shell, one table, one badge, one empty state — all built to match Shopify admin, so stages 8-10 are assembly rather than invention.
**Time:** 3 hours.
**Before you start:** Stage 6 done, or Stage 4 done if you are running this in parallel while the deploy is blocked.

---

## What "Shopify admin" means, concretely

Your audience is small online merchants. Shopify admin is the screen they already stare at every day. Copying it does three things at once: it looks credible without being clever, it fits the audience, and it gives every later decision a reference so you stop guessing.

**Important:** the hex values below are close approximations of Shopify's Polaris system, from memory. Step 1 makes you capture the real ones from screenshots. Where the two disagree, the screenshots win.

---

## Step 1 — Capture the reference pack (45 min)

**YOU.** Sign up for a free Shopify trial or open any Shopify admin screenshots online. Collect and save **six** screenshots into `build-plan/v2/refs/`:

1. **Home / dashboard** — for the top bar, page title, and card layout.
2. **Orders list** — for the table: row height, header style, how statuses appear.
3. **Order detail** — for a record page: summary card, side panel, action buttons.
4. **Settings page** — for forms: label placement, helper text, save bar.
5. **Empty state** — any list with nothing in it.
6. **A confirmation or approval sheet** — for how Shopify asks "are you sure".

Then write `build-plan/v2/refs/notes.md` with one line per screenshot saying which Signoff screen will copy it. This file is the thing you check against when you are unsure.

**Why screenshots and not a written spec:** "make it look like Shopify" is not checkable. "The orders table has 44px rows, 12px uppercase grey headers, and pill badges" is.

## Step 2 — Record the measured values (30 min)

**YOU.** For each of these, look at screenshot 2 and 4 and write the real value in `refs/notes.md`. Then reconcile with the starting values below.

| Token | Starting value | Measure it as |
|---|---|---|
| App background | `#F1F1F1` | The area behind the cards |
| Surface | `#FFFFFF` | Card fill |
| Border | `#E1E1E1` | The 1px card and row divider |
| Text primary | `#303030` | Body and headings |
| Text secondary | `#616161` | Helper text, column headers |
| Primary action | `#303030` on white text | The main button (Shopify's is near-black, not blue) |
| Link / interactive | `#005BD3` | Links inside tables |
| Success badge | bg `#AEE9D1`, text `#0C5132` | "Paid", "Fulfilled" |
| Attention badge | bg `#FFD79D`, text `#5E4200` | "Unfulfilled", "Pending" |
| Critical badge | bg `#FED3D1`, text `#8E1F0B` | "Refunded", "Cancelled" |
| Card radius | `8px` | Card corners |
| Control radius | `8px` buttons, `8px` inputs | |
| Body font | Inter, 13px, line-height 20px | Table and body text |
| Heading font | Inter, 20px semibold, page title | Page title |
| Row height | `44px` | Table rows |
| Spacing | 4px scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 | Gaps between blocks |

**Decide one thing and write it down:** Signoff's current accent is teal `#0F766E`. Shopify's is near-black buttons with a blue link. Keep teal for *brand only* (the logo mark, the active nav indicator) and switch buttons and links to the Shopify values. Justification: a judge comparing will see the calm, familiar admin, and the teal keeps Signoff recognisable.

## Step 3 — Rewrite the tokens (45 min)

**PROMPT.**

> Rewrite `signoff/packages/ui/src/tokens.ts` so it matches the table in `build-plan/v2/refs/notes.md`. Requirements:
>
> 1. Keep every existing export name (`colors`, `spacing`, `typography`) so nothing breaks. Add new keys, do not rename old ones.
> 2. Add a `radius` object: `{ card: '8px', control: '8px', pill: '999px' }`.
> 3. Add a `shadow` object with one soft card shadow and one popover shadow.
> 4. Replace `typography.fontFamily` with `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` and add `fontSizeTablet: '13px'`, `fontSizePageTitle: '20px'`, `fontWeightSemibold: 600`.
> 5. Keep the `verdict` object's shape and labels exactly as they are — the tests assert on them — but change the badge colours to the Shopify success/attention/critical values. The verdict must still carry an icon and a text label, never colour alone.
> 6. Add `module`-level comments quoting which screenshot each value came from.
>
> Then run `npx vitest run` and fix only genuine breakages.

**Check:** `npx vitest run --reporter=dot` still passes. If a test asserts an old hex value, update the test to the new value and note it in `refs/notes.md`.

## Step 4 — Load the font (15 min)

**PROMPT.**

> Add Inter to the merchant app without a network dependency at runtime: install `@fontsource/inter`, import `@fontsource/inter/400.css`, `500.css` and `600.css` in `signoff/web/src/main.tsx`, and do the same in `signoff/shop/src/main.tsx`. If adding a dependency is not allowed by the repo rules, instead add a `@font-face` block pointing at a self-hosted `Inter.woff2` in `signoff/web/public/fonts/` and record the decision in `signoff/docs/decisions.md` as a new ADR.

**Check:** in devtools, the computed `font-family` on `body` starts with `Inter` and the request is served locally, not from Google.

## Step 5 — Build the shell (60 min)

**PROMPT.**

> Rebuild the merchant app shell in `signoff/web/src/app/` to match Shopify admin:
>
> 1. **Top bar**, 56px tall, white, 1px bottom border: left is the Signoff wordmark at 14px semibold plus a small "Sandbox demo" chip; right is the store name and nothing else. No global search.
> 2. **Left sidebar**, 240px, white, 1px right border: items 32px tall, 13px, 8px radius, 8px horizontal padding. Active item has a `#F1F1F1` background, dark text and a 3px teal bar on its left edge. Items: Home, Disputes, Demo disputes, Charter, Demo, Guide.
> 3. **Main content**: max-width 1200px, 32px padding, `#F1F1F1` background, white cards on top.
> 4. **Page header** component: title at 20px semibold, optional one-line description at 13px secondary, primary action aligned right on the same row, secondary actions before it.
> 5. Below 900px the sidebar collapses to a slide-over opened by a menu button in the top bar. Test at 390px.
>
> Keep every existing `data-testid` attribute that tests rely on. Add `data-testid="shell-topbar"` and `data-testid="shell-sidebar"`.

**Check:** the four shell Playwright smoke tests still pass, plus a manual look at 1440px and 390px.

## Step 6 — Build the four shared components (60 min)

**PROMPT.**

> In `signoff/packages/ui/src/components/`, bring these four to Shopify admin standard. Each needs tests.
>
> 1. `DataTable`: 44px rows, 12px uppercase secondary-colour headers with 8px letter-spacing, 1px `#E1E1E1` row dividers, no zebra striping, right-aligned numeric columns using tabular figures, hover row background `#FAFAFA`, focus ring on the row, and a `caption` prop for screen readers. It takes column definitions and rows; it must not paginate.
> 2. `StatusBadge`: pill, 20px tall, 12px text, the three Shopify palettes, always with a text label and never colour alone. Map `Allowed/Needs Approval/Denied` and the PayPal dispute states onto the three palettes.
> 3. `EmptyState`: a heading, one sentence of explanation, and one primary action. Nothing else. No illustrations.
> 4. `PageHeader`: as described in step 5.
>
> Use `spacing`, `radius` and `typography` from the tokens — no hard-coded pixel gaps.

**Check:**
```bash
npx vitest run signoff/packages/ui
```
plus a screenshot of each component in a scratch page.

## Step 7 — Freeze the vocabulary
**YOU.** Write `build-plan/v2/refs/copy-rules.md` with these rules. Stages 8-10 and the video follow it.

1. Say "dispute", "buyer", "refund", "evidence". Never "case", "claimant", "chargeback" unless it means exactly that.
2. Every button says what happens: "Approve $50 refund", not "Submit".
3. Every number has a currency and a source: "USD 107.50, from PayPal".
4. Helper text goes under the control, never in a placeholder.
5. No sentence over 20 words on a screen a judge sees.
6. Banned words: seamless, effortless, unlock, supercharge, revolutionise, leverage, robust, cutting-edge, AI-powered (as a descriptor).

---

## Done when

- [ ] `refs/` holds six screenshots and `notes.md` names the real measured values
- [ ] The shell matches the reference at 1440px and 390px
- [ ] `DataTable`, `StatusBadge`, `EmptyState`, `PageHeader` exist, tested, and use tokens only
- [ ] Inter loads locally
- [ ] The full web suite passes
- [ ] `copy-rules.md` exists

---

## If it goes wrong

**Tests fail on verdict colours.** Some test asserts the old hex. Update the assertion, not the design.

**The sidebar breaks the approval page.** The approval page is deliberately standalone and mobile-first. Keep it out of the shell — it should stay a bare page with no sidebar.

**Everything looks 4px off.** You are mixing the 4px scale with ad-hoc values. Replace every hard-coded gap with `spacing[n]`.

---

## Cut

In this order: the mobile slide-over nav (use a horizontal scrolling top nav under 900px), `DataTable`'s caption prop, Inter (fall back to the system stack).

# Signoff mockup parity audit

**Audit date:** 2026-11-04
**Deployed URL:** https://signoff-web.onrender.com
**Viewport used:** 390 × 844 CSS px, DPR 3, mobile UA, Chrome (Playwright `channel: 'chrome'`)
**Mockups:** Six historical concept boards covering 15 merchant screens; the image files have been removed from the current tree.
**Baseline screenshots:** `scratch/ui-audit/shots/` (`01-home.png` … `15-demo-scenarios.png`, `detail-clip-*.png`)

---

## 0. Read this first — two things block a faithful implementation

### 0.1 The local checkout is one commit behind the deployment

The deployed bundle is built from `origin/main` **`b6c77f8` — "feat(web): ship mobile-first merchant redesign"**. The working tree is at `970413d`, which does **not** contain the detail-page tab markup, the newer list rows, or the notification changes you can see in the browser.

Before changing anything:

```bash
git fetch origin
# preserve the auto-generated session stats first
git stash push -- .github/context-mode/sessions
git pull --ff-only origin main
```

Then confirm `git log -1 --oneline` shows `b6c77f8`. All file paths and line references below are for `b6c77f8`.

### 0.2 Data differences are not UI defects

The deployed sandbox currently has 4 open disputes and USD 274.00 at risk; the mockups show 3 / USD 253. Case IDs, timestamps, amounts, and unread counts will always differ. **Do not hard-code mockup values.** Match structure, hierarchy, typography, spacing, color, and copy *patterns*, using live data.

Two real data bugs are visible and should be fixed separately:

1. **Updates rows are duplicated** — the same notification (same timestamp, same text) is rendered twice. Fix the notifications query/join, and de-duplicate by `item.id` in the UI as a guard.
2. **Case Activity duplicates `Approval resolved`** at the same minute. Same root cause (duplicate ledger rows or a join), plus the UI renders every event 1:1. De-duplicate adjacent identical events for display and fix the projection.

---

## 1. Parity summary

Legend: 🔴 major structural mismatch · 🟠 right content, wrong presentation · 🟢 close

| # | Mockup screen | Deployed route | Status | Biggest gaps |
|---|---|---|---|---|
| 1 | Home — Daily workspace | `/app` | 🔴 | Wrong header/shell; flat list instead of cards; extra Review history; no "Upcoming deadline" card; money formats wrap |
| 2 | Disputes — Manage cases | `/app/disputes` | 🔴 | No count pill; search/filter layout wrong; 4 tabs vs 3; flat rows; two status badges instead of one pill; long due text; pagination |
| 3 | Updates — Case activity | `/app/notifications` | 🔴 | No unread pill next to title; filter isn't a segmented control; no icons/leading tiles; no unread dots; long timestamps; action links per row; duplicates |
| 4 | Reports | `/app/reports` | 🔴 | No scope segmented control; KPIs stacked not 2×2; extra triage/Studio/widgets; deadline radar/row wrong; no "Ask your dashboard" |
| 5 | Shipments | `/app/shipments` | 🟠 | Long green paragraph instead of banner; plain disclosure triangles; no status pills/timeline/chevron; missing lock note and "How simulation works" |
| 6 | More | `/app/more` | 🟠 | Section labels wrong case; no grouped cards/icons; extra Appearance row; Buyer shop styled as underlined link |
| 7 | Help | `/guide` | 🔴 | Not the mockup structure: no numbered accordions, extra resource card, giant always-open "What is real" table, default triangles |
| 8 | Demo scenarios | `/app/demo` | 🟠 | No "Sandbox only" pill/availability copy; card header/CTA layout wrong; no EXPECTED pills; reset button boxed; scenario label wraps |
| 9 | Demo disputes | `/app/pool` | 🟠 | Start over at top not bottom; wrong headings; empty state lacks icon/green button; finished-runs band missing |
| 10 | Case overview | `/app/disputes/:id` | 🔴 | Anchor links instead of tabs; one long page; wrong header hierarchy; no amber callout card; status card semantics wrong; buyer statement styling wrong |
| 11 | Evidence | same page | 🔴 | Not a tab; raw UUID/technical dump on screen; no grouped summary rows; no snapshot pill/time; refresh button/caption buried |
| 12 | Activity | same page | 🔴 | Not a tab; "Updates"/"History" header; raw timestamps/audit disclosures per row; missing clean dot timeline and "Technical details →" |
| 13 | Signing limits | `/app/policy` | 🟠 | Intro card and extra automation fields; USD label wraps U/S/D; review exceptions/version history expanded; save bar wrong |
| 14 | Settings | `/app/settings` | 🔴 | No icon rows/chevrons; Connections expanded inline; Signing preferences/Appearance prose; phone notifications collapsed; Sign out is a green button |
| 15 | Appearance | `/app/settings/appearance` | 🟠 | Native radios exposed; tiles uneven; no check badges; sections not cards; preview missing pill/button; Apply button green/not full-width |

---

## 2. Canonical design specification (from the mockups)

These values are sampled from `Signoff disputes board with corrected records.png` and re-used consistently across the other boards. Put them in `signoff/packages/ui/src/tokens.ts` (or a new `conceptTokens.ts`) and consume them from primitives — do **not** re-type hex values in pages.

### 2.1 Color

```ts
export const concept = {
  canvas:      '#FFFFFF', // phone screen background
  surface:     '#FFFFFF', // cards, header, nav
  subtle:      '#F6F6F5', // stat tiles, group bands, info banners
  border:      '#E7E6E2', // 1px card/row divider
  ink:         '#1B1B19', // titles and body
  muted:       '#6B6B66', // helper text, timestamps, secondary labels
  primary:     '#135E3D', // active tab, primary button, active nav
  primaryDark: '#07472C', // logo tile, selected check badges
  primarySoft: '#E5F2EA', // optional hover/selected tint
  pill: {
    amber:  { bg: '#FEE8B5', text: '#1B1B19' },
    green:  { bg: '#DCF6E6', text: '#1B1B19' },
    blue:   { bg: '#E3F1FD', text: '#1B1B19' },
    purple: { bg: '#EDE9FE', text: '#1B1B19' },
    gray:   { bg: '#F1F1EE', text: '#1B1B19' },
    red:    { bg: '#FBE3E1', text: '#A12A22' },
  },
  warningBg:   '#FDF3D9', // amber callout
  infoBg:      '#F6F6F5', // info callout
  dangerText:  '#A12A22', // destructive text link ("Reset my session")
  disabledBg:  '#E5E5E1',
  disabledText:'#8A8A84',
} as const;
```

Notes:
- Mockup pills use **near-black text on pastel backgrounds**, not semantic dark-green/amber text. The current `StatusBadge` uses dark colored text; change the *concept* badges to ink text.
- Keep the existing semantic `colors.verdict` for any non-concept surfaces.
- The mockup page background inside the phone is white; the warm gray `#F3F2F0` is the artwork canvas around the phone. Do not turn the app canvas gray.

### 2.2 Type

| Role | Mobile size / weight / tracking |
|---|---|
| Page title (Home, Disputes, Updates, Reports, Shipments, More, Help, Demo scenarios, Demo disputes, Signing limits, Settings, Appearance) | 40px / 800 / -0.03em, line-height 1.05 |
| Case title (`Item not received`) | 36px / 800 / -0.02em |
| Section heading (`Needs attention`, `Financial limits`, `Today`) | 22px / 750 / -0.01em |
| Card row title | 17–18px / 650 |
| Body / helper | 16px / 400, line-height 1.5 |
| Secondary / caption | 14px / 400, `muted` |
| Pill | 14px / 550, padding 5px 10px |
| Bottom-nav label | 13px / 500 (700 active) |
| Wordmark | 20px / 750 |
| Section label (WORKSPACE, PREFERENCES, SANDBOX TOOLS) | 12px / 700, uppercase, letter-spacing 0.08em, `muted` |

Current `typography.fontSizePageTitle` is 28px; the concept needs 40px on phones and 32px desktop. Add concept sizes rather than changing the global token in a way that breaks desktop.

### 2.3 Spacing / radius / chrome

- Screen horizontal padding: **20–24px** (mockup ~24px).
- Gap between major sections: **32px**; between cards: **14–16px**.
- Card padding: **18–20px**; grouped-row padding: **16px 18px**.
- Radius: card **16px**, button/input **10px**, pill **8px**, icon tile **10px**.
- Borders only — no drop shadows on concept cards.
- Header: 64px; logo 36px; right label 15px.
- Store selector row (Board 1 only): 56px, store icon 22px, label 18px, chevron right.
- Bottom nav: 64px + `env(safe-area-inset-bottom)`; 4 equal columns; **no 3px top border on the active item**; active item is primary-colored icon + label; inactive `#52605a`.
- Focus ring: change from blue `#2563eb` to primary `#135E3D` (2px, offset 3px). Keep it visible.

### 2.4 Icon set

The mockups use consistent 24px stroke icons (1.8–2px, round caps). Add a small internal `ConceptIcon` component (SVG sprite) with:

`store`, `chevron-down`, `chevron-right`, `chevron-left`, `search`, `filter`, `home`, `disputes` (list), `bell`, `more`, `calendar`, `clock`, `chart`, `truck`, `sliders`, `gear`, `help-circle`, `layers`, `file`, `external-link`, `user`, `link`, `shield`, `monitor`, `phone`, `message`, `alert-triangle`, `check`, `folder`, `lock`, `info`, `arrow-right`.

Bottom-nav active state: use the filled variants (`home-fill`, `list-fill`, `bell-fill`) or stroke width 2.4 + primary color. Do not use the current ASCII glyphs or default `<details>` triangles.

---

## 3. Shared components to build first

Create `signoff/packages/ui/src/components/concept/` and export from `signoff/packages/ui/src/index.ts`. Every page below assumes these exist.

| Component | Contract |
|---|---|
| `ConceptPageTitle` | `{ title, subtitle?, badge?: ReactNode, back?: ReactNode }` — 40px title row; badge sits to the right of the title (count pill / "12 unread"). No subtitle on screens where the mockup omits it. |
| `ConceptCard` | White surface, 1px border, 16px radius, optional `padding`, `as` element, `testId`. |
| `ConceptSectionLabel` | Uppercase 12px muted label. |
| `ConceptListGroup` | Card with no padding; children are `ConceptListRow`s separated by 1px borders. |
| `ConceptListRow` | `{ icon?, title, subtitle?, trailing?: 'chevron' | ReactNode, to?, onClick?, testId }` — 16px 18px padding, 22px leading icon, 10px gap, min-height 64. |
| `ConceptSegmented` | `{ options: {value,label}[], value, onChange, ariaLabel }` — track `#F1F1EE`, radius 10, 48px, equal segments; active `primary` bg + white text; supports 2–4 options; `role="tablist"`/`aria-pressed`. |
| `ConceptPill` | `{ tone: 'amber'|'green'|'blue'|'purple'|'gray'|'red', children, uppercase? }` — 8px radius, 5px 10px padding, ink text; `uppercase` for EXPECTED. |
| `ConceptStatTile` | `{ value, label, note? }` — `subtle` bg, 14px radius, 18px padding; value 30–34px/750; label 15px; note 13px muted. |
| `ConceptButton` | `{ variant: 'primary'|'secondary'|'text', fullWidth?, disabled? }` — 48–52px, 10px radius; primary `#135E3D`; secondary white + border; disabled `#E5E5E1`/`#8A8A84`. |
| `ConceptSearchField` | 52px, search icon left, no visible label, radius 10, border; accepts `id`, `data-testid`, placeholder. |
| `ConceptInfoBanner` | `{ tone: 'info'|'warning', icon, title?, children }` — `infoBg`/`warningBg`, 12px radius, 16px padding, 20px icon. |
| `ConceptEmptyState` | `{ icon, title, body, action? }` — centered card, 32px padding, 48px icon, 22px title, green full-width action. |
| `StoreSwitcherRow` | Store icon + "Signoff Shop" + chevron; 56px; shown only on Board-1 routes. |
| `ConceptTabs` | Real tabs (`role="tab"`, `aria-selected`, `aria-controls`) rendered as `ConceptSegmented`; used by case detail. |
| `formatMoneyCompact` | "USD 253" for tiles (no cents, space after code); **mockup Reports tile uses "USD253"** — if pixel-matching, add `space:false` option. |
| `formatDueShort` | "Due 20 Nov" / "No deadline" for list rows. |
| `formatDeadlineFull` | "18 Nov · 10:18 PM WAT" for the Home/Reports deadline card. Keep ISO in `<time dateTime>`. |

**Deadline formatter:** the mockups use WAT (West Africa Time). Use `Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })` and append `WAT` deterministically rather than relying on the runtime's `timeZoneName` (Chrome on Windows returns `GMT+1`). The current `Deadline` component prints "Due in 15 days (Nov 18, 2026, 10:18 PM GMT+1)"; keep it for desktop/aria and add the compact concept formatter.

---

## 4. Screen-by-screen defects and required changes

### 4.1 Home — `/app` (`DashboardPage.tsx`)

**Deployed:** top "Sandbox demo, fictional data." strip; header right "Signoff Shop"; no store selector; 2-up KPI tiles with a long explanatory paragraph and timestamp; "Needs attention" as a flat list with 4 items, each with `Order … · USD` heading, three separate status lines, and "Inspect case →"; extra "Review history"; a "Deadlines" list of 4 rows; "View all disputes" link.

**Mockup:** header right "Sandbox demo"; store selector row; title "Home" + "Your shop, at a glance."; two neutral stat tiles ("3 / Open disputes", "USD 253 / At risk"); "Needs attention" with one card per case (order + amount on one row, reason, one pastel status pill, one muted explanation, green "Inspect case →"); "Upcoming deadline" with one calendar card ("18 Nov · 10:18 PM WAT", "USD 85.00"); no review-history section, no explanatory paragraph, no "View all disputes".

**Changes**
1. Add `StoreSwitcherRow` under the header for `/app` only (see §4.0 shell).
2. Replace `PageHeader` with `ConceptPageTitle title="Home" subtitle="Your shop, at a glance."` (40px title).
3. KPI block: `display:grid; grid-template-columns:1fr 1fr; gap:12px`; each `ConceptStatTile`. Tile 1 value `kpis.data.open_disputes`, label "Open disputes". Tile 2 value `formatMoneyCompact(...)`, label "At risk" (rename from "Open disputed value"). Remove the paragraph from mobile; keep it in a visually hidden paragraph or a small info disclosure for accessibility.
4. "Needs attention": remove the `${attention.length} cases…` paragraph. Render each item as a `ConceptCard` (`padding:18`, `radius:14`, `gap:10`, margin-bottom 14) containing:
   - Row 1: `order_code ?? id` bold 17px left; `Money` right; chevron right (optional; mockup Home has no chevron — omit).
   - Row 2: `formatDisputeReason(reason)`.
   - Row 3: one `ConceptPill`:
     - `approval_execution_attention === 'NOT_RECORDED'` → amber, "Check execution"
     - `=== 'FAILED'` → amber/red, "Action failed"
     - `analysis_needs_review` → amber, "Check analysis"
     - `current_approval_available` → green, "Approval ready"
   - Row 4: muted explanation, e.g. "Approval saved · no execution recorded" (current string is correct).
   - Row 5: green link "Inspect case →".
   Keep the whole card an accessible `<Link>` with one accessible name; putting interactive chevrons inside a link is invalid.
5. Delete the "Review history" section on mobile (`display:none` under 900px or conditionally not rendered). The mockup has no equivalent.
6. Replace "Deadlines" with "Upcoming deadline": one `ConceptCard` row with a 22px calendar icon, date `formatDeadlineFull(nextDeadline)`, muted `order_code · amount`, and an optional chevron linking to the dispute. If there are more deadlines, add a muted "View all deadlines" text link to `/app/reports` below, not a full list.
7. Remove "View all disputes" from mobile (bottom nav already covers it).
8. Keep `data-testid` values: `dashboard-title`, `kpi-card-open`, `kpi-open-disputes`, `kpi-card-risk`, `kpi-dollars-at-risk`, `kpi-card-recovered`, `kpi-card-share`, etc. If a block moves off mobile, render it in a hidden container so existing tests still find it.

**Acceptance:** at 390px the page shows header → store row → title → 2 tiles → Needs attention cards → Upcoming deadline → bottom nav; no long paragraph, no Review history, no horizontal overflow; "USD 274.00" does not wrap the "USD" onto its own line (use `white-space:nowrap` and a compact format).

---

### 4.2 Disputes — `/app/disputes` (`DisputeListPage.tsx`)

**Deployed:** no count pill; a bordered filter card with a visible "Search disputes" label, input, and Filter button; 4 tab buttons (All / Needs attention / Waiting / Closed); flat rows separated by hairlines with `Order X` or `PP-…` left and amount right; two badge rows prefixed "PayPal:" and "Review:"; long due text "Due in 15 days (Nov 18, 2026, 10:18 PM GMT+1)"; `First page / Showing 5 items / Next page`.

**Mockup:** title "Disputes" + count pill "5"; search input ("Search cases", magnifier) + Filter button (funnel) on one row; three segmented tabs All / Attention / Waiting; separated rounded cards: order code + amount + chevron top row, reason, one pastel status pill + short due date; no pagination.

**Changes**
1. `ConceptPageTitle title="Disputes" badge={<ConceptPill tone="gray">{total}</ConceptPill>}`. Use `displayedItems.length` when the API has no total; add `aria-label="5 disputes"`.
2. Replace the filter `Card` with one 52px row:
   - `ConceptSearchField id="filter-search" data-testid="filter-search" placeholder="Search cases"` (keep the existing debounce logic).
   - `ConceptButton variant="secondary"` with a funnel icon + "Filter" (keep `ref`/dialog logic). No visible "Search disputes" label; add `aria-label`.
3. Segmented control: `All` / `Attention` / `Waiting` only. Keep `filters.view`; move the `closed` view into the filter sheet (status select or a "Closed" view option inside Filter). On desktop you may keep four.
4. List: replace the flat `<Link>` rows with `ConceptCard` items (margin-bottom 14, padding 18):
   - Top row: `order_code ?? id` (no "Order " prefix) bold 18px; `Money` right; chevron right.
   - Reason.
   - Bottom row: **one** `ConceptPill` + due text right.
     Status priority and labels:
     - `approval_execution_attention === 'NOT_RECORDED'` → amber "Needs execution check"
     - `analysis_needs_review` → amber "Check analysis"
     - `current_approval_available` → green "Approval saved"
     - `status === 'WAITING_FOR_BUYER_RESPONSE'` → blue "Waiting for buyer"
     - `status === 'WAITING_FOR_SELLER_RESPONSE'` → amber "Waiting for your response"
     - `status === 'UNDER_REVIEW'` → purple "Under review"
     - resolved/denied → gray/red.
   - Do **not** render the second "Review:" badge on mobile. Preserve both statuses in an `aria-label` on the link and keep the existing `data-testid` badges in a visually hidden container if tests require them.
5. Due: `formatDueShort` → "Due 20 Nov" / "No deadline". Put the long absolute string in `title` and `aria-label`.
6. Pagination: remove `First page / Showing N / Next page` from mobile. Implement infinite scroll (IntersectionObserver sentinel) or a single muted "Load more" button. If e2e tests require `pagination-prev-button` / `pagination-next-button`, render them visually hidden on mobile and keep them on desktop.
7. Remove the applied-filter chips from mobile (the Filter button can show a dot/count when filters are active). Keep them on desktop.
8. Keep `data-testid="disputes-table"`, `dispute-row-${id}`, `filter-search`, `filter-status`, `filter-reason`, `reset-filters-button`, `disputes-pagination`.

**Acceptance:** at 390px the top shows title + pill, search+filter row, 3 equal tabs; each case is a separated rounded card with exactly one pill and a short due label; no pagination; no second badge line.

---

### 4.3 Updates — `/app/notifications` (`NotificationsPage.tsx`)

**Deployed:** title with description; "All" and "Unread · 14 unread" small buttons; "Today" plain `<h2>`; rows with text + "· Unread", long timestamp, "View dispute" link, and a "More options" disclosure; Previous/Next; duplicates.

**Mockup:** title "Updates" + "12 unread" pill; full-width 2-segment All / Unread (All active); "Today" in a light gray rounded band; rows with a 40px pastel icon tile, bold title, muted `dispute · action` subtitle, right-aligned "7:29 AM" and a green unread dot; no per-row action links.

**Changes**
1. `ConceptPageTitle title="Updates" badge={<ConceptPill tone="gray">{unread_count} unread</ConceptPill>}`; drop the description on mobile.
2. `ConceptSegmented` full width: All / Unread; remove the duplicated "14 unread" from the Unread label.
3. Group heading: `ConceptSectionLabel` inside a `subtle` band (`border-radius:10px; padding:10px 14px`) reading "Today" / "Yesterday" / "Earlier".
4. Row layout: `<Link>` to the dispute with `display:grid; grid-template-columns:40px 1fr auto; gap:12px; padding:16px 0; border-bottom:1px solid border`.
   - Leading icon tile 40×40, radius 10, pastel bg:
     - message/confirmation → `message` icon, green-blue tint
     - evidence/action failed → `alert-triangle`, red tint
     - approval recorded → `check`, green tint
     - needs approval → `clock`/`alert`, amber tint
     - default → `bell`, gray tint.
     Derive from the notification text/kind; add a mapping next to `dayGroup`.
   - Title 17px/650, no "· Unread" suffix.
   - Subtitle 14px muted: `${dispute_id} · ${shortAction}` (mockup "SIGCQ2V2S7 · Verify outcome in PayPal"). Use the order code/short dispute id available in the item; if unavailable, omit the suffix.
   - Right column: timestamp `7:29 AM` for today, `Yesterday`, `2 Nov` otherwise; 13px muted; unread dot 8px primary below/next to it.
5. Remove "View dispute" and "More options" from the visible row. Keep mark-read functionality behind a small `⋯` icon button in the right column (accessible label "More options for …") or long-press; preserve `change.mutate`. The mockup shows no menu, so make it visually subtle.
6. Replace Previous/Next with infinite scroll / "Load more" (same as Disputes).
7. De-duplicate `query.data.items` by `id` for display (and fix the backend query).
8. Keep `data-testid` for mark-read if tests use it; add one to each row.

---

### 4.4 Reports — `/app/reports` (`ReportsPage.tsx`)

**Deployed:** long description; "View All Disputes →" button; a single bordered KPI strip with four stacked/horizontally wrapping cells (uppercase labels, 26px values); amber triage banner; "View non-resolved disputes" disclosure with a table; assumption text; "Dispute insights" with Deadline radar and a flat deadline card list; Authority meter; Decision timeline; "AG Studio Analytics Workspace"; assistant panel at the bottom.

**Mockup:** title "Reports"; scope segmented control "My session" (active) / "All time"; **2×2** neutral KPI tiles with `Scope: My session` under each; "Last updated just now"; "Deadline radar" with 0 Overdue / 0 Due in 48h / 3 Scheduled colored pills and one next-deadline row; "Ask your dashboard" + "Read-only" pill + search field.

**Changes**
1. `ConceptPageTitle title="Reports"` — no description on mobile. Remove the "View All Disputes" button from mobile.
2. Add a scope `ConceptSegmented` (`mine` / `all`) wired to `scope` state. This requires the KPI endpoint to accept scope:
   - `signoff/agent/app/api/kpis.py`: add `demo_session: Annotated[str | None, Header(alias="X-Demo-Session")] = None` and filter with the same `session_scope_predicate`/`demo_session_id` logic used in `disputes.py`. When `scope='mine'` and no session, return zeros (or a clear empty response) rather than all-time values.
   - `signoff/web/src/features/dashboard/api.ts`: `useKpis(scope, demoSession)` → pass `headers: { 'X-Demo-Session': demoSession }` via `apiClient.request` when scope is `mine`.
   - Reuse `getDemoSession()` from `features/demo/api.ts`.
   - If product does not want a backend change, render the control but keep "All time" selected and label "My session" disabled with an explanation — do not silently show all-time data under "My session".
3. KPI grid: `grid-template-columns: repeat(2, minmax(0,1fr)); gap:12px`; four `ConceptStatTile`s in mockup order:
   - Open disputes (`open_disputes`), note "Scope: My session"
   - Open disputed value (`formatMoneyCompact(dollars_at_risk)` — mockup "USD253"), note "Scope: My session"
   - Auto-resolution share (`share` or "—"), note "Scope: My session"
   - Known seller-favour value (`Money recovered`), note "Scope: My session"
   Remove uppercase labels; labels are 15px sentence case. Add "Last updated just now" (or a relative time from `kpis.dataUpdatedAt`) below the grid, 13px muted.
4. Deadline radar: `ConceptSectionLabel`/22px heading; three `ConceptPill`s with counts: red "0 Overdue", amber "0 Due in 48h", green "3 Scheduled" (plus "1 No deadline" as gray only if needed; mockup omits it). Reuse `DeadlineRadar` data.
5. Next-deadline row: `ConceptCard` row with calendar icon, "18 Nov 2026" bold, `PP-… · USD 85.00` muted, green "Scheduled" pill, chevron. Show one row (the earliest scheduled).
6. "Ask your dashboard": heading + "Read-only" `ConceptPill` + `ConceptSearchField` placeholder "Ask about deadlines…". Wire to the existing `AssistantPanel`/`askAssistant` (keep the read-only server guard). Place this section last, as in the mockup.
7. Hide on mobile: triage banner, "View non-resolved disputes" table, assumption paragraph, `WidgetsSection`, Authority meter, Decision timeline, and AG Studio. Keep them in the DOM under `display:none`/a "More analytics" disclosure if tests assert them; otherwise render on desktop only.
8. Keep test IDs (`dashboard-title`, `kpi-card-open`, `kpi-open-disputes`, `kpi-card-risk`, `kpi-dollars-at-risk`, `kpi-card-recovered`, `kpi-card-share`, `kpi-autonomous-share`, `kpi-hours-saved`, `kpi-needs-approval`, `dashboard-disputes-table`, etc.).

---

### 4.5 Shipments — `/app/shipments` (`ShipmentsPage.tsx`)

**Deployed:** title + description; a long pale-green paragraph; each shipment card has a default `▶` disclosure, order code + amount, "Simulated · Delivered" plain text, hidden controls/history; no timeline, pills, lock note, or footer.

**Mockup:** title "Shipments"; gray info banner with `i` icon: **Sandbox shipments** / "Events are simulated, not carrier-confirmed."; cards with order code + amount + chevron; green "Delivered" pill + neutral "Simulated UPS" pill; expanded card shows a dot/line timeline (In transit → Delivered with timestamps), then a lock row "Scenario locked: dispute exists"; other cards collapsed; footer "How simulation works" disclosure.

**Changes**
1. Remove the long paragraph from the page body. Move it into the "How simulation works" disclosure at the bottom.
2. Add `ConceptInfoBanner tone="info" icon="info" title="Sandbox shipments"` with body "Events are simulated, not carrier-confirmed."
3. Each shipment: `ConceptCard` with a real button/summary row:
   - Header: order code 18px bold, amount right, chevron down/up (not a default triangle). Use `<details><summary>` but style the marker away (`summary::-webkit-details-marker{display:none}`) and place a chevron icon.
   - Pills: green `stageLabel(stage)` (Delivered etc.) + gray `${carrier}` (e.g. "Simulated UPS").
   - Expanded: vertical 2px line with 8px dots; each milestone: bold `stageLabel(status)` and muted `3 Nov 2026, 8:10 AM`. Sort chronologically. Show first/last at minimum.
   - Lock row: `lock` icon + "Scenario locked: dispute exists" muted, with a top border. Derive from `!shipment.can_configure_scenario`.
   - Put the simulation controls ("Advance", "Simulate exception", "Withhold tracking", "Resume") inside a secondary "Simulation controls" disclosure within the expanded card, so the first screen matches the mockup.
   - Keep the history list behind "Simulated shipment history".
4. Footer `ConceptListRow`-style disclosure: `info` icon + "How simulation works" + chevron; body contains the current long explanation.
5. Remove the "Simulated ·" prefix from the visible stage line (the pills replace it).
6. Keep test IDs and the mutation logic (`base_version`, `request_id`, refresh).

---

### 4.6 More — `/app/more` (`MorePage.tsx`)

**Deployed:** "Workspace" / "Preferences & help" / "Sandbox tools" as 15px headings; flat rows with `strong` title + `<br>` description + `›`; extra Appearance row; Buyer shop as an underlined link.

**Mockup:** "More" + "Manage your workspace."; uppercase section labels WORKSPACE, PREFERENCES, SANDBOX TOOLS; grouped white cards with 16px radius and row separators; each row has a 22px icon, title only, chevron right; Preferences group contains **Settings and Help only**; Buyer shop is a separate card with store icon and external arrow.

**Changes**
1. `ConceptPageTitle title="More" subtitle="Manage your workspace."`.
2. Use `ConceptSectionLabel` for the three groups.
3. Wrap each group in `ConceptListGroup`; rows via `ConceptListRow` with icons:
   - Workspace: Reports (`chart`), Shipments (`truck`), Signing limits (`sliders`).
   - Preferences: Settings (`gear`), Help (`help-circle`).
   - Sandbox tools: Demo scenarios (`layers`), Demo disputes (`file`).
4. Remove the **Appearance** row from More (the mockup has Appearance only inside Settings). Keep it in Settings.
5. Remove row descriptions from mobile (move to `aria-description`/desktop).
6. Buyer shop: separate `ConceptCard` row with `store` icon + "Buyer shop" + `external-link`, opening in a new tab (`target="_blank"`, `rel="noreferrer"`).
7. Keep routes and `aria-label`s.

---

### 4.7 Help — `/guide` (`GuidePage.tsx`, `ViewSwitcher.tsx`)

**Deployed:** app shell but no mockup structure; Merchant/Buyer switcher; underlined nav links (Home/Disputes/Signing limits/Demo scenarios); "Help" title + long description; GitHub/MIT/video card; "Follow these five steps" with default `▶` disclosures labeled "Step 1: …"; an always-visible "What is real" table with 8 rows.

**Mockup:** title "Help" + "Test Signoff, step by step."; full-width Merchant/Buyer segmented control (Merchant active); numbered accordions 1–5 with circled numbers, bold titles, chevrons; step 1 expanded with "Choose an available sandbox case." + green "Open demo disputes →"; bottom `Real vs simulated` disclosure and `GitHub (sandbox and examples)` external link.

**Changes**
1. Replace the `ViewSwitcher` tabs with `ConceptSegmented` (Merchant/Buyer), full width.
2. `ConceptPageTitle title="Help" subtitle="Test Signoff, step by step."` (remove the long paragraph).
3. Remove the top resource card (GitHub/MIT/video) or move it into the bottom `Real vs simulated` disclosure.
4. Steps: `ConceptCard` or divider rows, each `<details>` with:
   - 28px numbered circle (primarySoft bg, primary text) 1–5
   - Title only ("Open a dispute", "Watch the agent", "Review a proposed action", "Inspect blocked injection", "Ask the dashboard") — no "Step N:" prefix
   - Chevron right that rotates on open
   - Step 1 body: "Choose an available sandbox case." + green "Open demo disputes →" link to `/app/pool`
   - Keep the existing step bodies/links, but style links as concept buttons; step 1's link text must be "Open demo disputes" (not "Open Dispute Pool").
   - Only step 1 open by default (mockup).
   - Keep `data-testid="guide-step-1"` … `guide-step-5`.
5. Bottom rows (inside a `ConceptListGroup`):
   - "Real vs simulated" + chevron → expands the existing matrix (restyle it as cards/rows). Do not show the table by default.
   - "GitHub (sandbox and examples)" + external icon → link.
6. Keep the buyer view content behind the Buyer segment.
7. Remove the underlined inline nav links (Home/Disputes/Signing limits/Demo scenarios); the bottom nav and step links already provide navigation.

---

### 4.8 Demo scenarios — `/app/demo` (`DemoPanel.tsx`)

**Deployed:** title + long subtitle; "Checking scenario availability…" or "X of Y transactions available"; cards with title + "Scenario A" monospace label, description, `View scenario` disclosure, then a "Run this scenario" button; a boxed "Reset my session" button with side explanation.

**Mockup:** title + green "Sandbox only" pill; subtitle "5 transactions available"; cards: title left + "View scenario →" right on the same row; green `EXPECTED` pill; muted description; centered "More scenarios below"; red text "Reset my session".

**Changes**
1. `ConceptPageTitle title="Demo scenarios" badge={<ConceptPill tone="green">Sandbox only</ConceptPill>} subtitle={`${poolSnapshot.available} transactions available`}` (fallback "Scenario availability is unavailable." — never leave "Checking…" indefinitely).
2. Card header: `display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:nowrap`; title 17px/650 with `min-width:0`; right-side text button "View scenario →" in primary. Remove the visible "Scenario A/B…" label (keep it in `data-testid`/`aria-label`).
3. Add `<ConceptPill tone="green" uppercase>EXPECTED</ConceptPill>` under the title (mockup shows it before the description).
4. Keep the `<details>` behavior: "View scenario →" opens the body with "Running creates a sandbox dispute and starts processing." + "Run this scenario" button. Style the button as primary, 44–48px.
5. Add "More scenarios below" centered muted text after the list (only if content follows / it is a scroll hint; safe to include).
6. Reset: replace the boxed button with a destructive text button (`color: dangerText`, no border, min-height 44) reading "Reset my session". Put the explanation "Session only · ledger preserved" below in 13px muted. Remove the side-by-side layout.
7. Fix the "Scenario D" wrap by removing the right label; add `white-space:nowrap` to the "View scenario →" link.
8. Keep `demo-panel-title`, `demo-pool-status`, `demo-scenario-card`, `demo-scenario-A-expected`, `demo-scenario-A`, `demo-reset-button`, etc.

---

### 4.9 Demo disputes — `/app/pool` (`JudgePoolPage.tsx`)

**Deployed:** title + "Choose a sandbox case to evaluate."; top-right "Start over" explanation + bordered button; "Available for Evaluation (0)"; empty state with no icon, blue underlined "Browse scenarios"; "Finished runs (0)" + italic line; no bottom reset.

**Mockup:** title + subtitle; "Available (0)"; empty card with folder icon, "No demo disputes available", "Choose a scenario to create a sandbox case.", green "Browse scenarios" button; "Finished runs (0)" + gray rounded band "No finished runs yet."; bottom "Start over" green bold + "Session only · ledger preserved".

**Changes**
1. `ConceptPageTitle title="Demo disputes" subtitle="Choose a case to evaluate."`.
2. Move Start over to the bottom: a `ConceptButton variant="text"` ("Start over") with `color: primary` and a muted line "Session only · ledger preserved". Keep `data-testid="pool-start-over-button"`.
3. Heading "Available (0)" (not "Available for Evaluation (0)").
4. Empty state: `ConceptEmptyState` inside a `ConceptCard` with `folder` icon 48px, title "No demo disputes available" (mockup wording; use it when `pooledDisputes.length===0`), body "Choose a scenario to create a sandbox case.", action `<Link to="/app/demo">Browse scenarios</Link>` styled as a primary full-width button.
5. Finished runs: heading; if 0, render a `subtle` rounded band (`#F6F6F5`, radius 10, padding 16) centered "No finished runs yet." — not italic text.
6. If items exist: cards with title/amount, reason, due, primary "Open this dispute" button; keep claim/409 behavior.
7. Keep `judge-pool-page`, `pool-empty-state`, `pool-start-over-button`, `claim-dispute-btn-${id}`, `finished-run-card-${id}`, etc.

---

### 4.10 Case detail — `/app/disputes/:id` (`DisputeDetailPage.tsx`)

The deployed page is a **single long scroll** with three raw anchor links (`Overview`, `Evidence`, `Activity`) at the very top, styled as default blue underlined links. The mockup is **three tabbed screens**. This is the largest change.

**Required structure**
- Back link `← Disputes` (text change; keep `breadcrumb-disputes-link`).
- Header block:
  - `Order {order_code}` (fallback `Case {id}`) in 14px muted — *not* the raw PayPal ID as the primary line.
  - Title = reason, 36px/800.
  - Amount = 34px/750 (`USD 144.00`).
  - Due = 15px muted: `Due 22 Nov · 9:31 AM WAT` (not red).
  - Move `Technical details`, `Copy dispute link`, and `Updated …` into a muted small row or the Activity > Technical details expansion; they must not dominate the header.
- Replace the anchor nav with `ConceptTabs` (or `ConceptSegmented`) directly below the header: `Overview | Evidence | Activity`, active primary. Implement as real tabs:
  ```tsx
  const [tab, setTab] = useState<'overview'|'evidence'|'activity'>('overview');
  ```
  Keep the existing `id="case-overview"`, `id="case-evidence"`, `id="case-activity"` on the tab panels so deep links/tests still work. Optionally sync `?tab=` in the URL.

**Overview tab**
1. Amber callout (`ConceptInfoBanner tone="warning" icon="alert-triangle" title="Approval saved"`): "No execution recorded. Check PayPal before taking another step." Use the existing `approvalState === 'APPROVE' || 'EDIT'` + `!executionState` condition. Use `#FDF3D9` bg and no border (mockup).
2. Status card (`ConceptCard` with 16px radius) with three rows:
   - **PayPal** → pill using `StatusBadge` semantics but concept styling: `WAITING_FOR_SELLER_RESPONSE` → amber "Waiting for your response"; `WAITING_FOR_BUYER_RESPONSE` → blue "Waiting for buyer"; `UNDER_REVIEW` → purple "Under review"; `RESOLVED` → green "Resolved".
   - **Decision** → purple "Needs review" when `latest_verdict === 'NEEDS_APPROVAL'`; green "Approved" for ALLOW; red "Declined" for DENY; gray "Not recorded" otherwise.
   - **Execution** → gray "Not recorded" when `executionState` is undefined or approval saved with no execution; green "Recorded" for CONFIRMED; red "Failed" for FAILED; amber "Queued"/"Sending" for QUEUED/INTENDED/SENT.
   Use two columns `label | pill` with 1px separators (mockup row style). Current `.seller-status-row` is close; restyle.
3. Buyer statement:
   - Heading exactly "Buyer statement" (rename from "What happened").
   - Remove the "Buyer Statement via PayPal" chip from the main row (or make it a 12px muted caption below).
   - `subtle` quote card, radius 12, padding 16, 32px quote glyph, italic 17px text.
   - Keep truncation + "Show more" for >200 chars.
4. Add a green "Inspect details →" text link under the quote; clicking it switches to the Evidence tab (or scrolls to the evidence panel on desktop).
5. Do not render the evidence/activity sections inside Overview on mobile.

**Evidence tab**
1. Back link `← Order {order_code}` and title "Evidence" 36–40px.
2. Green pill `High · 85/100` (combine `evidenceStrength` + `score`), and `Snapshot · 2 Nov, 11:14 PM` muted from the latest snapshot `captured_at`.
3. `ConceptInfoBanner tone="info" icon="info" title="Simulated delivery"` body "Not carrier-confirmed." when the evidence source is simulated.
4. Grouped summary card (`ConceptListGroup`):
   - Order match → `order_code`
   - Order total → `currency amount`
   - Items → `items.join(', ')`
5. Grouped detail card with expandable rows (`ConceptListRow` + disclosure):
   - Delivered → points (e.g. 40)
   - Tracking → points (25)
   - Buyer history → points (0)
   - Order details → points (20)
   Expand to show `component.detail`. Source: `snapshot.evidence.components` (`name`, `points`, `detail`). Map names: `delivered`→Delivered, `tracking`→Tracking, `buyer_history`→Buyer history, `completeness`→Order details.
6. Submission preview callout (`ConceptInfoBanner tone="info" icon="file"`): title "Submission preview", body "Notes only. Does not submit to PayPal." when `buildable && tracking_submission_count === 0`.
7. `ConceptButton variant="secondary" fullWidth` "Refresh evidence" (`refreshingEvidence` → "Refreshing evidence…"), followed by 13px muted "Does not submit to PayPal." Keep the existing POST and toasts.
8. Move all raw material — run IDs, payment reference, UUIDs, component explanation, notes, every milestone with `Record {uuid}`, capture-kind sentences — into a "Technical details" `<details>` below the button. This is the single biggest visual offender: the deployed page displays UUIDs and 4 long tracking bullets at full size.

**Activity tab**
1. Back link `← Order {order_code}`, title "Activity".
2. Timeline: 2px vertical line, 14px dots colored by event class, gap 24px. Each item:
   - Title bold 18px (map `renderTimelineEventContent` titles to the mockup's short labels):
     - `APPROVAL_RESOLVED` → "Approval recorded" (green dot)
     - `GATE_DECIDED` + NEEDS_APPROVAL → "Review required" (amber dot)
     - `PLAN_PROPOSED` → "Actions proposed" (gray dot)
     - `EVIDENCE_BUILT` → "Evidence gathered" (green dot)
     - `DISPUTE_SYNCED` → "Dispute synced" (gray dot)
     - `APPROVAL_REQUESTED` → "Review requested" (amber)
     - execution events → "Action sent"/"Action confirmed"/"Action failed" (green/red)
   - Subtitle: `Merchant approved · 2 Nov, 10:40 AM`, `Repeat-disputer rule · G5-01`, `Provide evidence · Send message`, `High strength · simulated tracking`. Use compact date/time (no year if current year).
   - Remove the per-row `<details>Audit reference` from the default view; collect all raw audit data under a single bottom "Technical details →" link/disclosure.
3. Bottom `Technical details →` text link opening a panel with event IDs/sequence/attempt IDs.
4. De-duplicate adjacent identical events (same kind + minute + payload) for display; fix the backend duplication.

**Preserve**
- `dispute-status-summary`, `detail-status-badge`, `dispute-buyer-message-panel`, `buyer-message-content`, `toggle-buyer-message-button`, `dispute-evidence-panel`, `evidence-strength-badge`, `decision-timeline`, `timeline-event-${seq}`, `dispute-decision-card`, `dispute-summary-card`, `decision-timeline-card`, `open-approval-card-button`, `breadcrumb-disputes-link`, `detail-header-amount`, `detail-amount`, `dispute-detail-id`, `detail-stale-indicator`.
- If inactive tab panels are kept mounted with `hidden`, tests that use `toBeVisible()` will fail; update tests to switch tabs or keep only the active panel mounted and scope test IDs accordingly.

---

### 4.11 Signing limits — `/app/policy` (`CharterPage.tsx`)

**Deployed:** a page-level `Card title="Signing limits"` with an intro paragraph, then "Financial limits" rows with long helpers and a currency prefix box that wraps `U/S/D` vertically at 390px; "Repeat disputer threshold" always visible; "Automatic actions" checkboxes + delivery select always visible; selected exclusion chips; "Review exceptions" collapsed; "Version history" fully expanded; sticky Discard+Save bar.

**Mockup:** title + "What Signoff may do without asking."; one card "Financial limits" with three inline rows (label/helper left, USD input right); one collapsed card "Review exceptions" with subtitle "Repeat buyer threshold: 2"; one row "Version history" with clock icon + chevron; full-width disabled gray "Save changes".

**Changes**
1. Subtitle → `What Signoff may do without asking.` (exact mockup copy).
2. Remove the outer `Card` title "Signing limits" and its intro paragraph.
3. Financial limits card:
   - `ConceptCard` with `ConceptSectionLabel`/22px "Financial limits".
   - Each row: `display:grid; grid-template-columns: minmax(0,1fr) 150px; gap:16px; align-items:center; padding:16px 0; border-bottom`.
   - Left: label 17px/600 + helper 14px muted.
   - Right: a 150px input group that **never wraps**: `display:flex; white-space:nowrap;` currency prefix `USD` fixed width 42px, input `width:100%`.
   - Copy:
     - "Offer a refund, up to" / "An offer is not a completed refund."
     - "Accept a claim, up to" / "Accepting concedes the claim."
     - "Handle disputes, up to" / helper can be empty (mockup shows none); keep an `aria-description` if needed.
   - Default values display as `25.00`, `25.00`, `100.00` (no `USD` inside the input value).
4. "Review exceptions": collapsed `ConceptCard` row with title + subtitle `Repeat buyer threshold: {value}` + chevron. Inside: the repeat threshold input, the never-auto reason/action checkbox groups, the missing-delivery select, and the automatic-evidence/message toggles. This moves the deployed "Automatic actions" section out of the main view while keeping every control.
5. "Version history": collapsed `ConceptListRow` with clock icon + chevron; expand to the current list. Show "Version 2 · Nov 3, 10:53 AM" + one muted line of limits. No raw IDs.
6. Save:
   - Full-width sticky bar above the bottom nav, one primary button "Save changes" (48px), disabled when not dirty — use `ConceptButton` disabled styles (`#E5E5E1` bg, `#8A8A84` text), not opacity 0.6 on green.
   - When dirty, show a secondary "Discard" text button next to it (or below); keep the leave-confirmation dialog.
   - Ensure `scroll-padding-bottom` so the bar does not cover the last field.
   - Keep `charter-save-button`, `charter-sticky-save-bar`, `charter-form`, `charter-version-history`, all field IDs/test IDs.
7. Remove the green `#F0FDFA` selected-checkbox styling if it clashes; use the concept primary/soft.

---

### 4.12 Settings — `/app/settings` (`SettingsPage.tsx`)

**Deployed:** "Your account" section + email; "Connections" heading + large green "Check connections" button + paragraph; a long diagnostics list with status pills for PayPal access/store/webhooks/worker/AI; "Signing preferences" prose + link; "Appearance" section + link; "Phone notifications" `<details>`; full-width green "Sign out" button.

**Mockup:** "Settings" + "Your workspace preferences."; one grouped list:
- Account (person icon) / email → chevron
- Connections (link icon) / "2 checks out of date" → chevron
- Signing limits (shield icon) / "Review authority and exclusions" → chevron
- Appearance (monitor icon) / "Light · Forest" → chevron
- Phone notifications (phone icon) / "Off" → chevron
- centered "Sign out" text at the bottom.

**Changes**
1. Subtitle → "Your workspace preferences."
2. Build one `ConceptListGroup` with five `ConceptListRow`s and icons.
   - Account: email from `session.data?.email`; `to`/onClick opens an account panel (or no-op if none).
   - Connections: subtitle computed from `data`: count states that are not `verified` (e.g. "2 checks out of date"). `to` opens a Connections panel/modal that contains the current `Check connections` button, explanatory paragraph, PayPal sandbox details, and the five `Connection` disclosures. This preserves all diagnostics without dominating the Settings screen.
   - Signing limits: subtitle "Review authority and exclusions", `to="/app/policy"`.
   - Appearance: subtitle `${display label} · ${accent label}` (e.g. "Light · Forest"), `to="/app/settings/appearance"`.
   - Phone notifications: subtitle "Off"/"On" from the phone notification state; expand the existing `PhoneNotifications` in a sheet/disclosure.
3. Remove the standalone "Signing preferences" and "Appearance" sections (their links live in the rows).
4. Sign out: centered primary-colored text button (`ConceptButton variant="text"`), not a full-width green filled button. Keep the logout logic.
5. Keep all existing behavior: `integrations` query, `check` mutation, `signOut`, toasts. Add test IDs if missing.

---

### 4.13 Appearance — `/app/settings/appearance` (`AppearancePage.tsx`, `appearance.tsx`)

**Deployed:** "← Settings" underlined link; title + subtitle; "Display" with three bordered tiles but native radio circles visible and "Use device setting" wrapping to 3 lines; "Accent color" as a 2×2 wrap of native radio + circle; preview card with order "EXAMPLE-01", "Review case" text, "Review dispute" button; green enabled "Apply appearance".

**Mockup:** "‹ Settings" chevron back; title "Appearance"; sections inside `subtle`/white cards:
- Display: 3 equal tiles (Light selected with 2px primary border + check badge, Dark, Device), preview swatch + centered label.
- Accent: 4 equal tiles in one row (Forest selected with border + check inside the circle), labels below.
- Preview: mini case `SIGC5GT7ZA`, `USD24.00`, green "Check execution" pill, dark green "Inspect case" button.
- Full-width gray disabled "Apply appearance".

**Changes**
1. Back link: `‹ Settings` with a chevron icon, no underline.
2. Remove the subtitle on mobile (or keep it visually hidden).
3. Display: `grid-template-columns: repeat(3, 1fr); gap:10px`; each tile `min-height:104px; padding:12px; border:1.5px solid; border-radius:12px`; swatch 48px tall; label centered 14px; **hide the native radio** (`position:absolute; opacity:0`) but keep it focusable/label-associated; selected tile `border-color: primary` + check badge (18px circle, primary bg, white check) at top-right. Label "Device" (not "Use device setting"; use `aria-label="Use device setting"` on the input).
4. Accent: `grid-template-columns: repeat(4, 1fr); gap:10px`; tile `padding:12px 8px; border:1.5px solid; border-radius:12px`; 36px color circle with white ✓ when selected; label below 14px; selected border primary. Hide native radios. Remove the current wrapping flex.
5. Preview: wrap in a `ConceptCard`; label "Preview" (not "Preview · example case"); mini row with order `SIGC5GT7ZA` (or keep EXAMPLE-01 if product prefers; mockup uses SIGC5GT7ZA), amount `USD24.00`, green "Check execution" pill, dark green full-width "Inspect case" button. Use the selected accent for the button.
6. Apply: full-width `ConceptButton`, disabled/gray until `display/accent` differ from saved; enabled primary when dirty. Keep `appearance.apply`, `saved` status.
7. Keep test IDs and the `data-display` behavior.

---

## 5. Implementation order for an agent

Do this in phases; do not restyle pages before the primitives exist.

### Phase 0 — sync and baseline
1. `git fetch && git pull --ff-only origin main` (stash session stats first). Confirm `b6c77f8`.
2. `npm install`.
3. Re-run the capture script in `scratch/ui-audit/capture.mjs` to refresh the "before" screenshots.
4. `npm run lint && npm run test:web && npm run build` to confirm a green baseline.

### Phase 1 — tokens + primitives
1. Add `signoff/packages/ui/src/conceptTokens.ts` (or extend `tokens.ts`) with §2 values.
2. Add `ConceptIcon` and the primitives in `signoff/packages/ui/src/components/concept/`.
3. Export from `signoff/packages/ui/src/index.ts`.
4. Add unit tests for `formatDueShort`, `formatDeadlineFull`, `formatMoneyCompact`, and `ConceptSegmented` keyboard behavior.

### Phase 2 — shell
1. `Layout.tsx`: remove/restyle the sandbox banner (put "Sandbox demo" in the header right; keep the banner text in an `sr-only` node), header 64px with primary logo, store selector row on `/app`, `/app/disputes`, `/app/notifications`, new bottom nav (icons, no top border, no unread badge, safe-area), primary focus ring, `padding-bottom` reserve.
2. Verify all four nav states (Home/Disputes/Updates/More) and the `aria-current` behavior.

### Phase 3 — pages (suggested order: simplest → hardest)
1. More (`MorePage.tsx`) — proves the list/icon primitives.
2. Settings + Appearance — proves the grouped rows and selection tiles.
3. Signing limits — proves inline inputs and sticky save.
4. Shipments — proves disclosures/timeline.
5. Demo disputes + Demo scenarios — proves empty states and cards.
6. Home — proves stat tiles and case cards.
7. Disputes — proves search/segmented/cards.
8. Updates — proves icon tiles and grouped bands.
9. Reports — needs the KPI scope backend change.
10. Help — restructure `/guide`.
11. Case detail + tabs (Overview/Evidence/Activity) — last; most complex.

### Phase 4 — data/formatting helpers
1. `formatMoneyCompact` (no cents; optional no-space for Reports tiles).
2. `formatDueShort` / `formatDeadlineFull` with WAT.
3. Status-to-pill mapping shared by Home/Disputes/Detail (one function, not duplicated).
4. Notification icon mapping.
5. Deduplicate notifications and adjacent timeline events.
6. KPI scope header + backend filter.

### Phase 5 — verification
1. Screenshot every route at 390×844 (and 320/375/430 for overflow) with Playwright/Chrome; save to `scratch/ui-audit/after/`.
2. Compare each after-shot against the matching mockup board at the same width; check:
   - header/store row/nav;
   - title size and count pill;
   - card grouping/radius/border;
   - one status pill per case (not two);
   - short due dates;
   - no raw UUIDs;
   - no extra sections;
   - money does not wrap.
3. Assert no horizontal overflow: `document.documentElement.scrollWidth <= 390`.
4. Run `npm run lint`, `npm run test:web`, `npm run test:types`, `npm run build`.
5. Run e2e smoke + axe (`signoff/e2e/specs/shell.smoke.spec.ts` and the mobile specs); fix any test that depended on removed visible text by scoping to the new concept components, not by reintroducing the old UI.
6. Deploy: push to `main`; Render rebuilds. Confirm the new bundle hash and re-run the screenshot sweep against the live URL. Do not assume the deploy succeeded from a green build alone.

---

## 6. Preserve these behaviors (do not regress)

- Approval vs execution semantics: "Approval saved" never implies an action was sent or a dispute resolved. Keep the `NOT_RECORDED`/`FAILED` states and the duplicate-action warning.
- Status/verdict semantics and all `data-testid` attributes used by Vitest/e2e. If a visible element is removed, keep an `sr-only` or visually hidden equivalent, or update the test deliberately.
- Dispute filters in the URL (`status`, `reason`, `scope`, `view`, `q`, `cursor`), the filter dialog focus trap, and scroll restoration.
- The demo-session header (`X-Demo-Session`) and scope semantics.
- Evidence refresh behavior, toasts, and "no PayPal action" messaging.
- Charter dirty tracking, no-op save guard, conflict (409) comparison, leave confirmation, field validation/focus.
- Appearance apply guards and `data-display` dark/device behavior.
- Shipment mutation versioning/idempotency and the scenario lock.
- Notifications mark-read mutation.
- Accessibility: labelled controls, focus-visible, 44px targets, no color-only status (pills always have text).

---

## 7. Open product decisions (ask before implementing)

1. **Board 1 store selector**: only Board 1 shows a store dropdown. Should it be global or only on Home/Disputes/Updates? Recommendation: only Board 1 routes for exact parity, with a follow-up to standardize.
2. **Disputes "Closed" view**: the mockup has 3 tabs; the app has 4 views. Recommendation: 3 tabs on mobile; move Closed into Filter. Confirm.
3. **Home "Review history" and full "Deadlines" list**: the mockup omits both. Recommendation: hide on mobile, keep on desktop/Reports. Confirm.
4. **Reports analytics** (triage banner, non-resolved table, widgets, Authority meter, Decision timeline, AG Studio): hide on mobile, keep on desktop or behind "More analytics". Confirm.
5. **Help "What is real" matrix**: keep behind "Real vs simulated" rather than deleting. Confirm.
6. **Reports scope**: implementing "My session" requires a KPI backend filter. If that is out of scope, show the control disabled with an explanation rather than mislabeling all-time data.
7. **Exact currency typography**: mockup mixes "USD253", "USD 253", and "USD 24.00". Recommendation: compact tiles "USD 253" (or "USD253" for pixel parity), rows "USD 24.00".

---

## 8. File map

| Concern | File |
|---|---|
| Shell, header, bottom nav | `signoff/web/src/app/Layout.tsx` |
| More | `signoff/web/src/app/MorePage.tsx` |
| Home | `signoff/web/src/features/dashboard/DashboardPage.tsx` |
| Reports (+ assistant) | `signoff/web/src/features/dashboard/ReportsPage.tsx`, `AssistantPanel.tsx`, `api.ts` |
| Disputes list | `signoff/web/src/features/disputes/DisputeListPage.tsx` |
| Case detail + tabs | `signoff/web/src/features/disputes/DisputeDetailPage.tsx` |
| Activity timeline | `signoff/web/src/features/disputes/timeline.tsx` |
| Updates | `signoff/web/src/features/notifications/NotificationsPage.tsx` |
| Shipments | `signoff/web/src/features/fulfillment/ShipmentsPage.tsx` |
| Signing limits | `signoff/web/src/features/charter/CharterPage.tsx` |
| Settings | `signoff/web/src/features/settings/SettingsPage.tsx` |
| Appearance | `signoff/web/src/features/settings/AppearancePage.tsx`, `appearance.tsx` |
| Phone notifications | `signoff/web/src/features/settings/PhoneNotifications.tsx` |
| Help | `signoff/web/src/features/site/GuidePage.tsx`, `ViewSwitcher.tsx` |
| Demo scenarios | `signoff/web/src/features/demo/DemoPanel.tsx` |
| Demo disputes | `signoff/web/src/features/demo/JudgePoolPage.tsx` |
| Tokens | `signoff/packages/ui/src/tokens.ts` |
| Primitives | `signoff/packages/ui/src/components/concept/*`, `index.ts` |
| KPI scope (backend) | `signoff/agent/app/api/kpis.py`; reuse `session_scope_predicate` from `disputes.py` |
| Demo session header | `signoff/packages/api-client/src/client.ts` (`X-Demo-Session`, `getDisputes`) |

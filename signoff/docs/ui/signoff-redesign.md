# Signoff × Notion: mobile-first UI adaptation plan

Prepared 3 November 2026. Live browser review of the deployed merchant application, with official Notion product images and documentation as visual references. This is a design and implementation specification, not an implementation or a claim that backend inconsistencies have been fixed. The user selected restrained green, extra-spacious layouts, and light mode first. Five concept boards covering 15 mobile views were then generated and shown in the conversation.

## 1. Scope and evidence

The landing page was excluded. The review followed the merchant application's visible navigation, its Help links, and all five dispute links present in the signed-in list. It did not enumerate source-code routes, create a dispute, run a scenario, reset a session, approve a dispute, send a buyer message, refresh evidence, enable notifications, or initiate a payment. The separate Buyer shop is a different application and is outside this merchant-dashboard redesign. Undiscoverable, token-only, or permission-dependent routes cannot be certified as inspected without source access or live links.

| View | Observed route | Review result |
|---|---|---|
| Login | /login | Inspected and used for sign-in. No credential screenshot retained. |
| Home | /app | Attention queue, deadlines, summary. |
| Dispute list | /app/disputes | Search, status, reason, session scope; five records. |
| Dispute details | /app/disputes/:id | All five currently linked records inspected; distinct states documented below. |
| Updates | /app/notifications | Notifications, unread state, links, individual mark-read controls. |
| More | /app/more | Reports, Shipments, Rules, Settings, Help, external Buyer shop. |
| Reports | /app/reports | Deadlines, summary metrics, embedded AG Studio, read-only question assistant, timeline, radar, authority meters. |
| Shipments | /app/shipments | Three simulated delivered shipments; scenario controls locked. |
| Rules | /app/policy | Signing limits, automation permissions, exclusions, history, save/discard. |
| Charter alias | /app/charter | Displays the same signing-limits form. |
| Settings | /app/settings | Account, connection health, signing preferences, appearance, phone notification controls. |
| Appearance | /app/settings/appearance | Light/dark/device, four accent choices, preview and apply. |
| Help | /guide | Merchant/buyer perspective tabs, five-step guide, evaluation resources, real/simulated matrix. |
| Demo scenarios | /app/demo | Five scenario cards and session reset. |
| Demo disputes | /app/pool | Empty available/finished sections and Start over. |

### Dispute states actually observed

| Case suffix | Amount | Observed UI state | Design implication |
|---|---|---|---|
| WWC-10195206 | USD 85 | Analysis could not finish; no action recorded; list shows UNKNOWN | Show actionable analysis failure, not an unexplained uppercase verdict. |
| MYR-10195637 | USD 24 | Approval saved; no execution recorded; no current approval card | Separate historical decision from current action availability. |
| KIU-10195895 | USD 144 | Same saved-approval state; evidence snapshots with simulated tracking | Make evidence origin, snapshot date, and submission contents explicit. |
| MBX-10190372 | USD 10 | Waiting for buyer; no review pending; evidence unavailable | Use a neutral waiting state and hide inapplicable response prompts. |
| TFU-10196099 | USD 21 | Allowed review verdict; action recorded as failed; later history includes confirmation for another action | Model outcomes per action and attempt. A single success/failure badge is insufficient. |

### Review side effect to disclose

The fixed Save bar on Rules overlapped the bottom navigation. A semantic click on More triggered Save and created Charter version 2. No fields had been edited; the visible values remained USD 25 auto-offer, USD 25 auto-accept, USD 100 autonomous dispute size, and repeat threshold 2. No rollback was attempted because that would require another state change. This is an observed interaction hazard, not a hypothetical concern. Screenshot 08b records the overlapping control region; version 2 was confirmed in the rendered version-history text.

## 2. What to borrow from Notion

Official references: [Notion mobile](https://www.notion.com/mobile), [Notion for mobile](https://www.notion.com/help/notion-for-mobile), [Sidebar navigation](https://www.notion.com/help/navigate-with-the-sidebar), and [Database views](https://www.notion.com/help/views-filters-and-sorts). The gallery includes official mobile home, mobile project board, and desktop database images. These are real product references, not generated redesigns.

Observed visual language: neutral canvas, strong page title, very little decoration, small contextual icons, fine separators, compact toolbars, restrained pastel tags, and content arranged as readable sections. Mobile references use clear navigation controls and single-column content. Notion's documentation explicitly distinguishes mobile controls from desktop hover interactions. The Signoff design must expose every essential action to touch.

Borrow the hierarchy and restraint. Keep Signoff's merchant-control identity and its domain-specific distinctions. Do not add an editable block canvas, drag handles, arbitrary page nesting, or decorative database controls unless they serve an existing workflow. The target is a focused dispute workspace with Notion's calmness.

## 3. Critical findings and priorities

| Priority | Finding | Required response |
|---|---|---|
| P0 | Rules Save bar overlaps mobile navigation and intercepted a navigation click | Define one bottom-layer stack; test actual hit targets and keyboard states. |
| P0 | Allowed verdict can coexist with failed execution; saved approval can coexist with no action | Distinguish PayPal case status, policy decision, approval record, and per-action execution. |
| P1 | Home counts historical review states as attention work even when no live approval exists | Derive actionable queue from current action availability; label historical counts accurately. |
| P1 | Reports summary shows 3 open / USD 253; embedded BI shows 5 open / 28,400 cents | Align metric scope, labels, units, refresh time and definitions; investigate data mapping. |
| P1 | Pool says three finished runs exist while its count is zero | Render empty copy from actual result count. |
| P1 | Same deadline appears as 18 days in detail and 19 in list | Use one relative-time calculation and one shared clock/rounding rule. |
| P1 | Large filter form and verbose mobile table rows consume the first screen | Replace with compact search/views/filters and concise mobile records. |
| P1 | Reports' embedded analytics and Help layout can produce a wide, shrunken mobile presentation | Contain horizontal width, remove fixed minimum widths, test nested widgets. |
| P2 | Guide uses a different marketing-style shell and outdated navigation wording | Bring it into the application shell; update links and terminology. |
| P2 | Technical IDs and raw enums compete with useful context | Preserve technical details behind labelled disclosure controls. |
| P2 | Repeated default cards, large blank gaps, inconsistent link/button styling | Apply a shared spacing, type, action, and section system. |

## 4. Proposed design tokens

These values are proposed Signoff specifications, not measurements claimed to be Notion's internal tokens. Final accent usage is pending the user's answer.

| Token | Light specification | Usage |
|---|---|---|
| Canvas | #FFFFFF | Main working surface. |
| Subtle surface | #F7F7F5 | Secondary groups, toolbars, skeletons. |
| Hover/pressed | #EFEFEC / #E7E7E3 | Visible interaction feedback. |
| Main text | #252521 | Titles, values, body. |
| Secondary text | #686861 | Descriptions and metadata; verify contrast at final size. |
| Border | #E7E7E2 | Decorative dividers; use a stronger border for interactive input boundaries. |
| Input border | #8B8B83 | Form control boundary where needed for contrast. |
| Forest accent | #1F5A42 | Proposed brand action/link accent. |
| Focus | 2px #2563EB, 2px offset | Keyboard focus independent of selected accent. |
| Success | #E5F1E9 with #24513C | Confirmed execution only. |
| Attention | #F8EBCF with #6C4B16 | Review needed, approaching deadlines. |
| Failure | #F8E5E4 with #842F2C | Failed action, blocked execution. |
| Neutral tag | #ECECE8 with #4C4C46 | Waiting, historical, not recorded. |
| Information | #E5EDF5 with #294D6C | Sync information, factual notices. |

Use an accessible system sans-serif stack. Body 16px/24px; compact metadata 13px/18px; labels 14px/20px medium; page title 28px/34px semibold; section heading 18px/24px semibold; desktop title 32px/40px. Avoid 12px dense body copy. Financial values use tabular numerals. Full technical identifiers use a readable monospace treatment only in expanded details. Inputs stay at least 16px to avoid mobile zoom behavior.

Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48px. Mobile page gutter 20px, falling to 16px at 320px. Section gap 28–32px; row padding 14–16px; control gap 8px. Input/action minimum touch box 44×44px, primary actions preferably 48px high. Icons 18–20px inside the larger touch box. Radii: 4px tags, 6px buttons/inputs, 8px grouped surfaces, 12px sheets. Use dividers more often than shadowed cards. Shadows are reserved for overlays and sheets.

Dark mode uses a near-black canvas (#191919), raised surface (#222222), primary text (#E7E7E4), secondary text (#ADADA5), borders (#373732), and separately tuned status palettes. Do not invert the light palette mechanically. All final color pairs need measured accessibility checks.

## 5. Mobile shell and layout contract

Design first at 390×844 CSS pixels; verify at 320, 360, 375, 390, 414 and 430px widths. A desktop browser viewport is a responsive review, not a substitute for physical iOS and Android testing.

1. Keep a subtle sandbox strip, approximately 24px high, with the exact simulation meaning accessible. Avoid a large permanent warning banner.
2. Use a 52–56px top bar: small Signoff mark and workspace name at left; contextual menu at right. Avoid repeating a large logo above every heading. Back navigation belongs in detail-page headers.
3. Main content starts below the actual header height, never under it. Page title follows with 20–24px separation and a short optional subtitle.
4. Keep bottom tabs Home, Disputes, Updates, More. Use one consistent line-icon family and visible 11–12px labels. Active state combines weight, icon treatment, and a subtle neutral/forest surface; color alone is insufficient. Show unread count only on Updates, capped at 99+.
5. Bottom navigation height is 64px plus `env(safe-area-inset-bottom)`. Reserve matching content padding. Do not put a second fixed bar at the same bottom coordinate.
6. On Rules, a dirty-state action bar lives above navigation: bottom offset equals the full navigation footprint. Main content reserves the combined height. Alternatively, hide global tabs during a clearly labelled full-screen edit mode; select one pattern consistently after prototype review.
7. On live approval review, use the same above-navigation action slot. Only show actions backed by a current valid approval. The default screenshot state must not invent an Approve button for the stale cases observed.
8. When the keyboard is open, keep focused fields visible; action and navigation regions must not cover the caret or validation. Test browser address-bar expansion and safe areas.
9. Preserve scroll position and filters when returning from a dispute. Use route-based navigation with browser Back support. Avoid reseting the page after every background update.
10. A single global overlay stack owns popovers, sheets, dialogs, and toasts. Body scroll locks while a modal sheet is open; focus enters the sheet and returns to its trigger on close.

No page-level horizontal scrolling. Long IDs wrap or truncate visually with full value accessible. Only explicitly labelled data or code regions may scroll horizontally. Set grid/flex children to `min-width:0`; ensure vendor widgets obey their container width.

## 6. Screen-by-screen specification

### Login

White canvas, small Signoff mark, one direct title, and a 320–400px-wide form. Mobile fields span the available width. Keep Email, Password, a 44px show/hide control, and one primary Sign in button. Use persistent labels and inline validation. Show a quiet sandbox note below. Pending submission has one progress state and prevents duplicate submissions. Failed sign-in keeps the email and returns focus to the useful error. Do not show technical authentication messages as raw errors. No landing-page work is included.

### Home

Top: page icon, Home title, concise subtitle. Then a two-column summary strip with Open disputes and Open disputed value, including currency. At 320px allow wrapping without clipping. These numbers are secondary to the actionable queue.

Next: Needs attention, a count, and compact rows. Each row contains a human-readable order reference or case identifier, amount aligned right, a short issue line, and an explicit next-step label. The observed stale approvals should read “Approval saved · execution not recorded” with “Inspect case,” not “Approve now.” Failed analysis should appear if it requires merchant review. Review-state history alone must not create a live approval count.

Then Upcoming deadlines, sorted soonest first. Show “18 Nov · 10:18 PM WAT” with the relative interval in secondary text; exact local date and timezone come from the same timestamp. Raw UTC is available in details. Last: a quiet View all disputes link and last-updated indicator. The first phone viewport should reveal the summary and the first attention item at normal text size; treat this as a layout target, not a reason to shrink text.

### Dispute list

Header: Disputes with count. Search is a single 44px field; Filter opens a bottom sheet with Status, Reason and Scope. Selected filters appear as removable chips with a Clear all action. Default scope and semantics must match the actual dataset; never silently mix session and all-store records.

Under search, horizontal view tabs: All, Needs attention, Waiting, Closed. These are proposed saved views, requiring supported data predicates. Historical “Needs Approval” is not equivalent to a valid current approval token.

Mobile record layout: first line order reference / USD amount; second line reason; third line separate case-status and next-step tags; fourth line deadline when present. Aim for roughly 112–144px per common record at default text size. Use a full-row navigation target with a chevron; avoid nested conflicting click areas. Full PayPal ID remains in details or secondary text when no order exists. Never print six repeated field labels per record. Empty search results distinguish “no matches” from “no disputes.” Pagination states state the current count and expose a usable next-page action only when available.

### Dispute detail: overview and evidence

Header: Back, order reference or short case name, amount, buyer reason, and a compact deadline property. “No deadline” is neutral and never prefixed with “Respond by.” Add a section navigation row Overview / Evidence / Activity, or jump links with clear scroll behavior; choose one in prototype and use it for all cases.

Place the next-step callout immediately after the summary. Examples: “Analysis needs review,” “Approval saved; execution not recorded,” “Waiting for buyer,” or “Evidence action failed.” Then show a three-part status property group: PayPal case state, Signoff decision state, execution state. Each has its own label and timestamp/source when available.

Buyer statement is a quote block, visibly attributed and treated as untrusted buyer content. Never present buyer instructions as application controls.

Evidence section: strength tag with scoring explanation, snapshot time/source, order match, items and amount, delivery origin, tracking facts, and submission preview. Put “Simulated · not carrier-confirmed” beside the delivery claim, not only in a footnote. Current store records and historical decision evidence must be distinct. For the observed USD 144 case, make the 85/100 score inspectable and show that order-note content differs from carrier-confirmed tracking. Missing evidence gets a neutral state with precise missing fields. Do not retain a historical HIGH badge as if it describes an unavailable current snapshot.

Submission preview opens as a read-only expandable block. Refresh evidence uses a secondary control with the existing accurate explanation that it does not submit to PayPal or run the agent. Avoid refreshing during the visual audit.

### Dispute detail: decision and execution

Render policy reason in plain language before rule ID. Example: “Repeat buyer disputes require your review,” followed by G5-01 under technical detail. Show proposed actions separately: Provide evidence and Send message each get a proposal summary, approval status, attempt history and execution result.

For an actual current approval, show the exact action, destination, amount/currency if relevant, contents, expiration, and consequences before the action controls. Use an explicit verb such as Approve evidence submission. Do not introduce swipe-to-approve or let opening a notification authorize execution. On stale/expired/resolved approvals, remove approval controls and explain the state. Recheck validity before action submission; disable duplicate requests and resolve expiry without preserving an active-looking button.

“Allowed” means a policy decision. “Approval saved” means merchant consent recorded. “Dispatched” means a request was sent. “Confirmation recorded” is not an independently verified PayPal outcome. Only a verified result may display final success wording. For mixed outcomes, show “1 action failed · 1 confirmation recorded,” with each action expandable. A red overall failure must not obscure a later successful different action, and a green decision must not imply all execution succeeded.

### Activity and technical details

Use a vertical timeline with event name, meaningful summary, local date/time, and source. Group repeated events by run/attempt without discarding audit records. Default to the latest relevant entries, with Show earlier activity. Full run IDs, payload references, webhook details and raw enums live in a Technical details disclosure. Technical failures get a concise human summary and expandable diagnostic detail. Timestamps include the date across day boundaries. Keep links copyable without causing surrounding-row navigation.

### Updates

Title Updates matches the navigation label. Use All / Unread view tabs, an unread count, and grouped Today / Yesterday / Earlier sections. Each notification is a compact row with event icon, specific action/case context when supplied, relative time, and unread dot. Row opens the case. A separately accessible menu contains mark read/unread; do not make swipe the only control. Avoid repeated large boxed “View dispute” and “Mark read” buttons. Duplicates may be visually grouped only when event identity and state are preserved. Do not infer unread state from age. Maintain an error/retry state if a read-state update fails.

### More

Present two simple lists: Workspace (Reports, Shipments, Signing limits) and Preferences & help (Settings, Appearance if a direct shortcut is useful, Help). Put Demo scenarios and Demo disputes in a clearly named Sandbox tools group. Label Buyer shop as an external destination; do not make it look like a merchant settings page. Rows have one line icon, title, optional short subtitle, chevron, and a 48–56px minimum touch height. Remove duplicated global navigation chrome.

### Reports

Title Reports, then explicit scope and date/filter controls. First section: Open disputes and Open disputed value. Secondary metrics: known seller-favour disputed amounts, automatic-resolution share and estimated time saved. The estimate needs its 20-minute assumption, a definition, and a neutral unavailable state. No fabricated percentage when no denominator exists.

Resolve the 3-versus-5 and dollars-versus-cents discrepancies before giving all metrics equal visual authority. The current numbers may reflect different predicates; this was not verified from source. A common selector should define “open,” session scope, currency, included records, and refresh time for all widgets. A BI widget that uses all records should be labelled “All disputes,” not “Open disputes.”

Mobile analytics stack: deadline summary, deadline rows, authority meters, decision timeline, then read-only question assistant. On desktop they can form a two-column grid. Avoid duplicating the full dispute list above the analytics. AG Studio is constrained within its parent, with trial branding preserved if required by its licence; investigate the trial status separately rather than hiding it cosmetically. Layout editing belongs behind an explicit secondary mode. Read-only assistant answers must cite the relevant app records and never contain live approval controls. Suggested questions are compact chips; input and answer remain within the viewport.

### Shipments

Use compact order rows containing order, amount, delivery-state tag and simulated label. Opening a row reveals tracking and the milestone timeline. A short page-level explanation introduces the sandbox; longer behavior details expand under How this works. Keep simulated tracking distinct from carrier evidence throughout.

Locked scenarios show one clear reason beside the controls. If all scenario controls are unavailable, put them in expanded detail rather than making three disabled buttons dominate each row. Preserve accessible disabled reasons. Refreshing shipment milestones must not imply submission of dispute evidence or modification of historical decision snapshots. Test long tracking strings and all shipment states, not just delivered.

### Signing limits and Charter alias

One page title: Signing limits. Group fields into Financial limits, Automatic actions, Review exceptions, and Version history. Financial fields have currency prefix, clear action labels, existing value, and short consequence text. Keep auto-offer and auto-accept distinct: making an offer is not a completed refund; accepting a claim concedes it.

Use numeric decimal entry for currency and integer entry for repeat threshold. Validate against real backend constraints rather than inventing limits. Preserve decimal precision; do not silently convert invalid input to zero. Align error messages with their fields and focus the first invalid input on submission.

Automatic evidence and messages are separate permission rows. Missing delivery evidence gets a labelled selection with its existing caveat. Excluded reasons and actions use grouped, searchable selection sheets if the lists become long; each selected exclusion remains visible as a removable item. Avoid a wall of uppercase enum labels.

Save stays disabled until the effective form differs from the loaded version. Dirty state enables Save changes and Discard in the reserved action slot. Saving displays progress; success shows the returned version and timestamp. Handle version conflicts with a review of server and local values, not a blind overwrite. Leaving with unsaved edits offers Keep editing or Discard changes. A no-op save should not create another version if backend behavior can be updated safely. Both /app/policy and /app/charter must use the same components and consistent navigation label.

### Settings

Grouped rows: Account, Connections, Signing preferences, Appearance, Notifications. Keep account identity private in shareable mockups; use a fictional merchant address. Connection status rows show name, current status, last checked and a disclosure for diagnostics. Distinguish live checks from observed activity: webhook received and worker heartbeat do not prove PayPal access or model response success. Out of date is a freshness state, not automatically a disconnected state. Check connections is a deliberate secondary action with result-level feedback.

Notification setup is a compact explanation plus device-appropriate instructions. Ask browser permission only after an explicit Enable notifications action. Local display testing and server push delivery have separate labels and feedback. Do not bury the important statement that notification opening never approves an action. Sign out remains deliberate and separate from other settings.

### Appearance

Theme choices appear as three preview tiles or segmented cards with radio semantics: Light, Dark, Device. Accent options use named swatches with a checkmark, not color alone. Include a realistic small dispute-row and action preview, not only a generic button. Apply appears in a safe action slot, disabled when unchanged. Respect device mode and selected accent without making danger/success tags change semantic color. Dark mode needs the same hierarchy and accessibility review as light mode.

### Help / guide

Use the merchant shell and a clear Help title. Keep five testing steps as expandable numbered sections; explain prerequisites and link to the correct screen. Separate merchant and buyer guidance with a simple segmented switch. Replace stale “ask the dashboard at /app” wording with the real Reports location. Real/simulated matrix becomes a stacked definition list on mobile, with the table retained on wide screens. Repository and licence links remain secondary resources. Demo claims must match observed behavior; avoid promising available runs or outcomes unsupported by current data. Marketing header anchor links should not lead to missing sections on the guide page.

### Demo scenarios

A clearly marked sandbox screen with availability count and five concise scenario rows. Each row explains setup, expected policy behavior, and whether it creates records or starts a run. Scenario badges wrap below titles on narrow screens. Opening a scenario exposes its detail and intentional Run control; the audit must not run one merely to see styling. Separate Reset my session into a labelled section explaining that the ledger remains preserved. Disable unavailable scenarios with a useful reason. Running state shows the current stage and links to the actual created case when available.

### Demo disputes / pool

One page title, available and finished sections with real counts. Empty copy is generated from those counts. If no finished runs exist, say so and link to Demo scenarios; do not promise three. Start over describes the exact session effect before action. If rows exist, show case reference, scenario, state, amount and next useful action. Reuse dispute and activity components rather than creating a second visual language.

## 7. Shared interaction and state catalogue

Every data view needs: initial loading, refreshing with existing data, successful data, empty dataset, filtered empty result, partial data, stale data, recoverable failure, authorization failure and session expiry. Keep successful data visible during noncritical refresh. Show a last-successful timestamp; do not replace a useful screen with a permanent Syncing label.

Every form needs: unchanged, dirty, invalid, submitting, success, failure, and concurrent-change states. Every action needs a pending lock, explicit result and retry rules. Failed financial or dispute actions must not offer blind automatic retries without backend idempotency and state checks. Toasts supplement persistent state rather than replacing it. Success toasts may dismiss; blocking failures remain inspectable.

Filters use a full-width mobile bottom sheet with title, close, labelled fields, result-aware Apply and Clear. Changes remain local until applied. Sheet content scrolls independently with the footer visible. Desktop uses the same fields in a popover. Dialogs support Escape, focus trapping, labelled titles and restoration. Reduced motion removes sliding transitions; normal transitions are brief, approximately 120–180ms, and never delay an urgent action.

## 8. Desktop adaptation

At approximately 768px, allow two-column summary groups where they remain readable. At 1024px, introduce a 224–240px neutral sidebar, replacing bottom navigation. Sidebar has the same destination names, workspace switch area and sandbox-tool group. Keep a narrow reading measure for long explanations (roughly 680–760px); list/report areas can expand to 1120–1280px. Do not stretch a rules form across an ultrawide monitor.

Dispute list becomes a semantic table with concise columns; use the same record model as mobile. Detail can split into a main evidence/reply column and a 280–320px context column. Important state and warnings remain in the main reading order. Desktop actions may sit in a right-hand review panel; mobile keeps the reserved bottom action slot. Test 200% zoom so desktop can collapse back into the mobile layout without loss.

## 9. Accessibility and content rules

Verify WCAG AA text contrast, non-text control contrast, visible focus, logical headings, labelled fields, semantic tabs and radios, status announcements, keyboard navigation and screen-reader reading order. Do not rely on a tiny colored dot to communicate failure or unread state. Touch controls meet 44px minimum size with adequate separation. At 200% text size, rows and buttons grow and bottom bars remain usable. Do not put critical content in hover tooltips.

Use “Not recorded” instead of UNKNOWN where that is the correct meaning. Preserve “Unavailable” when data is missing and “Not checked” when a check has not been performed; these are different. Use sentence case and a stable domain vocabulary. Use one currency formatter, one deadline formatter and one status mapper. Show timezone explicitly at decision points; use Africa/Lagos/WAT for this review's user-facing examples with optional UTC detail. Keep IDs and raw audit records available without making them the headline.

## 10. Implementation work breakdown

This sequence is repository-agnostic; actual files and libraries must be established from the code before changes.

1. Inventory route definitions and shared layout components; reconcile them with this observed route list. Identify token-only approval views, auth states, error boundaries, and any role-based screens not exposed in this session. Confirm where financial and execution state is computed.
2. Fix the Rules/navigation overlap before broad styling. Add shared bottom-stack dimensions, content insets, layer ownership and hit-target tests. Disable no-change saves and review version creation semantics.
3. Define design tokens, font scale, icon family, buttons, inputs, links, tags, dividers, callouts and disclosures. Replace scattered hard-coded green/blue/amber styling with semantic tokens.
4. Build AppShell, TopBar, BottomNavigation, DesktopSidebar and ContextActionBar. Migrate every route to the shell, including Help and sandbox tools. Confirm scroll restoration and safe areas.
5. Define status/amount/deadline adapters and a shared notion of scope. Add distinct policy, approval and per-action execution data models. Resolve report metrics with backend owners or source evidence.
6. Implement reusable DisputeRow, DisputeTable, ViewTabs, FilterSheet, StatusProperties, EvidenceSnapshot, ExecutionAttempt and ActivityTimeline. Use stable record IDs and preserve URL filter state.
7. Migrate Home and Disputes first; validate the five live case states with fixtures. Then migrate detail and evidence; maintain existing authorization and submission logic.
8. Migrate Updates and More, then Shipments and Reports. Contain third-party analytics width. Retain required vendor attribution. Align assistant data scope and labels with metrics.
9. Migrate Signing limits, Settings and Appearance with dirty tracking and clear success/error states. Confirm no visual component can imply a permission change without a deliberate saved action.
10. Migrate Help, Demo scenarios and Pool; fix content mismatches and shared terminology. Reconcile aliases and outdated links.
11. Run accessibility, responsive, state and browser checks below. Review generated screenshots against the approved mockups. Validate real devices before release.
12. Release incrementally after review, with telemetry for UI errors and failed operations that excludes credentials, tokens and private content. Retain the existing deployment rollback path.

## 11. Acceptance checks

| Area | Concrete acceptance |
|---|---|
| Mobile geometry | No page-level horizontal overflow at 320–430px; vendor analytics and guide content fit. |
| Fixed regions | Last field, timeline event and row remain reachable above safe areas and all fixed controls. |
| Click interception | Clicking every visible tab on Rules cannot submit the form; pointer coordinates and keyboard activation target the same intended control. |
| Save behavior | Unchanged rules cannot create a version; dirty save creates one intended version; failure preserves edits. |
| Status truth | Allowed never implies execution success; historical approval never exposes an expired action. |
| Mixed actions | A failed evidence action and separately confirmed message remain distinguishable. |
| Evidence | Simulated tracking is labelled near each relevant claim and in previews; snapshot provenance survives refresh. |
| Metrics | Summary and analytics reconcile record scope, units and totals, or clearly disclose their different definitions. |
| Time | List/detail/home use the same exact due timestamp and relative-time rule; no “Respond by No deadline.” |
| Empty states | Pool zero counts never promise finished runs; unavailable metrics never become zero accidentally. |
| Navigation | Back restores list filters and scroll; all discovered routes and aliases render the shared shell. |
| Forms | Decimal currency input, integer validation, error focus, pending lock and conflict handling work. |
| Accessibility | Keyboard-only flow, screen-reader labels, 200% text/zoom, contrast, reduced motion and focus restoration checked. |
| Devices | Physical iOS Safari/PWA and Android Chrome/PWA, not only desktop viewport simulation. |
| Notifications | Opening a notification cannot authorize a dispute action; permission prompting is user initiated. |

Use meaningful interaction tests for the overlap regression, no-op save, approval expiry, mixed execution outcomes, filter restoration and contradictory-count prevention. Use visual comparisons for the shared components and each unique page. Avoid brittle tests that merely repeat CSS values.

## 12. Mockup direction and delivered set

Start with a mobile visual board containing Home, compact Disputes, Case overview, Evidence, Signing limits, and Updates. Use separate readable screen images rather than cramming the entire app into one tiny sheet. Follow with More/Settings, Appearance, Reports, Shipments, Help, Demo scenarios and Pool to complete unique layouts. A small desktop companion can show the sidebar, database table and two-column case view after mobile is settled.

Use fictional merchant identity and the observed sandbox amounts/states where useful. Label any unobserved live approval example as an illustrative state. Show the realistic “Approval saved; execution not recorded” case as well as any conceptual approval-ready screen. Do not silently turn an existing failed case into a successful one for visual polish.

Approved direction: restrained forest-green accents, extra-spacious information density, and light mode first. Delivered five image boards: (1) Home, Disputes, Updates; (2) Case overview, Evidence, Activity; (3) Signing limits, Settings, Appearance; (4) Reports, Shipments, More; (5) Help, Demo scenarios, Demo disputes. Corrected versions of boards 1 and 4 replace their earlier sample-data variants. These generated concepts are shown in the conversation; they are not live screenshots or deployed UI. Exact behavior, colors, labels and state mappings must follow this specification and be verified during implementation. Login has a specification above but was not included in the five mobile application boards.

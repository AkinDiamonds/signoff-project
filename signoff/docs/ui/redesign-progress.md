# Signoff mobile-first redesign progress

Starting point: clean `work` at `e7331ca`. Remote `main` (`970413d`) added the design specification, HTML plan, and six concept images under `signoff/docs/ui`; it did not add merchant application features beyond the starting commit. Existing documents deleted in that remote commit were preserved. The requested `signoff-audit.html` filename is not present; the available HTML plan is `Signoff_Notion_Mobile_First_Plan.html`.

## Route checklist

- [x] Login — focused, labelled sign-in form, pending lock and safe error text.
- [~] Home — KPI summary, current approval queue, review history and deadlines updated. The approval flag uses the server’s pending, expiry and fingerprint checks; historical verdicts are kept separate. Latest analysis failures and saved approvals with no recorded execution or a recorded failure are projected separately.
- [~] Disputes — compact mobile rows, staged filter sheet, URL filters, and shared deadline formatter; all-session and current demo-session scope and All / Needs attention / Waiting / Closed views now use server filters before pagination; a missing demo session yields no results. Search resolves case IDs and order references across the filtered result set before pagination.
- [~] Case detail and approval — separate status lines, evidence provenance, section links, expiry guard and correlated execution events when recorded IDs exist. Action attempts are grouped by recorded execution ID; older events without IDs remain unassociated in the activity history.
- [~] Updates — renamed, compact rows and all/unread page filter; date groups, a separate mark-read menu and server-side unread pagination added.
- [x] More — grouped workspace, preferences, help and sandbox links.
- [~] Reports — summary first, scope/units disclosed, non-USD values excluded from the USD Studio sum, wide analytics opt-in and scrollable, and mobile insights reordered.
- [~] Shipments — simulated provenance retained, with compact expandable shipment rows and progressively disclosed controls.
- [~] Signing limits and Charter alias — safe bottom stack, semantic dirty tracking, no-op save guard, validation focus, leave confirmation and conflict comparison; financial and automation headings, expandable review exceptions, and removable selected exclusions added.
- [~] Settings and Appearance — appearance apply guards, neutral surfaces and dark/device preferences retained; display tiles and a fictional case preview added; connection diagnostics and notification setup are progressively disclosed.
- [~] Help — merchant shell, perspective switch, expandable steps and responsive labelled matrix.
- [~] Demo scenarios and Demo disputes — explicit sandbox controls, expandable scenario actions, truthful availability/empty copy and reset explanation.

## Completed and investigated

- Signing-limit save and navigation overlap, no-op/reverted save, conflict comparison, and unsaved navigation handling.
- Deadline rounding now uses one shared formatter; local date/time and timezone are shown with an ISO timestamp available on the time element.
- The KPI endpoint counts seller-response cases or current, unexpired approvals bound to the current dispute fingerprint; Studio had counted all loaded disputes and summed cents. Labels now disclose those different scopes, expired/stale approvals no longer inflate the KPI, and the Studio USD sum excludes non-USD rows.
- The former session selector changed the URL but never affected the API request. It now sends an opaque demo-session identifier in a header and the server narrows the query; all-session is the default. Dispute views and search are evaluated before pagination.
- The dispute list now includes read-only current-approval, failed-analysis and saved-approval execution summaries. The latter follows the resolved decision and queued job; opening a case and resolving an approval still perform their existing checks.
- The read-only timeline now retains existing execution IDs and failure text, allowing the UI to associate attempts with their recorded action. No ledger, gate or executor behavior was altered.

## Validation and remaining work

- Frontend lint, TypeScript, client freshness, enum parity and 221 Vitest tests passed. Web/shop production builds passed with a local placeholder API URL; Vite reported large chunks.
- Backend Ruff, strict mypy and all three import contracts passed. The focused ledger regression passed; a SQLite approval/ledger subset passed 11 tests, and the full ledger test file passed 14 tests with local networking. The default test database was absent; an isolated local `signoff_test_codex_redesign` database was created and migrated. The full backend suite passed 688 tests on the isolated database; focused tests for the final order-search and mixed-attempt projections also passed.
- System Chromium with the mock API passed six targeted mobile interaction checks, three demo/Rules mock-flow checks, and four mobile smoke checks. Axe found no serious or critical violations across 15 light-mode pages and five key pages in both light and dark mode. Automated route sweeps checked page width at 320, 375, 390, 430 and 1280 px; the filter dialog, focus restoration and a focused Rules field were checked at the four mobile widths. A CSS 200% zoom sweep of merchant routes found no page-level overflow. These are desktop browser emulations, not physical devices or a full accessibility audit.
- Screenshots of unique merchant routes at 390 and 1280 px are in `/workspace/signoff-screenshots`; the filter and dark case have additional captures. Mock data was used; no live mutations or merchant settings changes were performed.
- Complete route acceptance, manual screen-reader and contrast review, true browser 200% zoom, and physical iOS/Android keyboard and safe-area testing remain outstanding. Global order-reference search resolves each candidate through the existing store lookup before pagination and may need performance work for large stores. Existing event records without execution IDs cannot be reliably matched to an action.

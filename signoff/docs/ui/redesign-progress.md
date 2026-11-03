# Signoff mobile-first redesign progress

Starting point: clean `work` at `e7331ca`. Remote `main` (`970413d`) added the design specification, HTML plan, and six concept images under `signoff/docs/ui`; it did not add merchant application features beyond the starting commit. Existing documents deleted in that remote commit were preserved. The requested `signoff-audit.html` filename is not present; the available HTML plan is `Signoff_Notion_Mobile_First_Plan.html`.

## Route checklist

- [x] Login — focused, labelled sign-in form, pending lock and safe error text.
- [~] Home — KPI summary, current approval queue, review history and deadlines updated. The approval flag uses the server’s pending, expiry and fingerprint checks; historical verdicts are kept separate. Analysis-failure and unsent-execution queue entries still need a supported list projection.
- [~] Disputes — compact mobile rows, staged filter sheet, URL filters, and shared deadline formatter; the API does not support session scope, so the ineffective session selector was removed and all-session scope is disclosed. Proposed saved views remain outstanding.
- [~] Case detail and approval — separate status lines, evidence provenance, section links, expiry guard and correlated execution events when recorded IDs exist. Older events without IDs cannot be attributed; complete per-action grouping and all detail layouts still need review.
- [~] Updates — renamed, compact rows and all/unread page filter; date groups added; the notification menu remains outstanding.
- [x] More — grouped workspace, preferences, help and sandbox links.
- [~] Reports — summary first, scope/units disclosed, non-USD values excluded from the USD Studio sum, wide analytics opt-in and scrollable; full mobile widget redesign remains outstanding.
- [~] Shipments — simulated provenance retained, with compact expandable shipment rows and progressively disclosed controls.
- [~] Signing limits and Charter alias — safe bottom stack, semantic dirty tracking, no-op save guard, validation focus, leave confirmation and conflict comparison; section grouping and full selection-sheet redesign remain outstanding.
- [~] Settings and Appearance — appearance apply guards, neutral surfaces and dark/device preferences retained; display tiles and a fictional case preview added; settings disclosure and full contrast review remain outstanding.
- [~] Help — merchant shell, perspective switch, expandable steps and responsive matrix; full content and assistive-technology review remains outstanding.
- [~] Demo scenarios and Demo disputes — explicit sandbox controls, truthful availability/empty copy and reset explanation; full row redesign remains outstanding.

## Completed and investigated

- Signing-limit save and navigation overlap, no-op/reverted save, conflict comparison, and unsaved navigation handling.
- Deadline rounding now uses one shared formatter; local date/time and timezone are shown with an ISO timestamp available on the time element.
- The KPI endpoint counts seller-response cases or pending approvals; Studio had counted all loaded disputes and summed cents. Labels now disclose those different scopes and the Studio USD sum excludes non-USD rows.
- The former session selector changed the URL but never affected the API request. It was removed rather than implying a filter that does not exist.
- The dispute list now includes a read-only current-approval flag using pending, expiry and fingerprint checks; opening a case and resolving an approval still perform their existing checks.
- The read-only timeline now retains existing execution IDs and failure text, allowing the UI to associate attempts with their recorded action. No ledger, gate or executor behavior was altered.

## Validation and remaining work

- Frontend lint, TypeScript, client freshness, enum parity and 217 Vitest tests passed. Web/shop production builds passed with a local placeholder API URL; Vite reported large chunks.
- Backend Ruff, strict mypy and all three import contracts passed. The focused ledger regression passed; a SQLite approval/ledger subset passed 11 tests. The full backend suite stopped progressing after 55 tests and was interrupted; its full result remains unverified.
- System Chromium with the mock API passed six mobile mock-flow and interaction checks and four mobile smoke checks, including a shell axe check. Automated route sweeps checked page width at 320, 375, 390, 430 and 1280 px; the filter dialog, focus restoration and a focused Rules field were checked at the four mobile widths. These are desktop browser emulations, not physical devices or a full accessibility audit.
- Screenshots of unique merchant routes at 390 and 1280 px are in `/workspace/signoff-screenshots`; the filter and dark case have additional captures. Mock data was used; no live mutations or merchant settings changes were performed.
- Complete route acceptance, a full contrast/screen-reader/200% zoom audit, physical iOS/Android keyboard and safe-area testing, and the complete backend suite remain outstanding. Existing event records without execution IDs cannot be reliably matched to an action.
